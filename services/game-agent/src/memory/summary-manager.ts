/**
 * Summary Manager
 *
 * LLM-powered incremental summary generation.
 * Uses previous summary + new memories to produce refined summaries.
 *
 * Summary hierarchy:
 *   Session  — updated incrementally during play + on session end
 *   Daily    — aggregates today's session summaries
 *   Profile  — master user profile, updated on session end
 *
 * Adapted from readyplayerx — uses Dory's provider-agnostic LLM client
 * instead of direct Anthropic SDK. No embeddings.
 */

import type { MemorySummary, Memory } from './types.js';
import { getMemoriesCollection, getSummariesCollection } from './database.js';
import { extractTextFromSummary } from './text-extractor.js';
import { getLLMClient } from '../llm/instance.js';
import { ObjectId } from 'mongodb';

// ═══════════════════════════════════════════════════════════════════════════
// LLM Prompts
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_SUMMARY_PROMPT = `You are a Memory Summary Agent for Dory, an AI Minecraft gaming companion.
Your job is to produce a rich, structured session summary from gameplay memories.

You will receive:
1. Previous session summary (if this session was already summarized before)
2. New memories since the last summary update

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "narrative": "A 3-5 sentence third-person narrative capturing the full arc of the session — what the player asked Dory to do, what happened, any setbacks, and the outcome. Be specific: mention block types, item names, structure types, player names.",
  "keyHighlights": [
    "List 3-7 specific things that happened, e.g. 'Collected 20 oak logs near spawn', 'Built a cobblestone wall', 'Died to a creeper at night'"
  ],
  "achievements": [
    { "description": "Notable accomplishment", "category": "building|crafting|combat|exploration|social" }
  ],
  "preferences_learned": [
    "Any preferences the player expressed or implied, e.g. 'prefers oak wood for building', 'likes exploring caves'"
  ],
  "mood": "Overall vibe: productive, exploratory, frustrated, chaotic, relaxed, ambitious, social, etc.",
  "nextSuggestion": "A concrete suggestion for next time based on what happened, e.g. 'Craft iron armor before exploring caves again'"
}

Guidelines:
- If the previous summary exists, BUILD on it — don't repeat the same info, focus on what's new.
- Be specific with Minecraft details (block types, item names, biomes, mob types).
- Achievements should only include genuinely notable things (not every single action).
- If the session was short or uneventful, keep the output brief — don't pad it.`;

const USER_PROFILE_PROMPT = `You are a Memory Profile Agent for Dory, an AI Minecraft gaming companion.
Your job is to build a comprehensive, evolving player profile that Dory uses to personalize every interaction.

You will receive:
1. Current user profile (if one exists — update and refine it, don't start from scratch)
2. Latest session summary (most recent gameplay)
3. All semantic memories (preferences, personality observations, goals)

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "narrative": "A 4-6 sentence portrait of who this player is. Describe their personality, what they enjoy doing in Minecraft, how they interact with Dory, their skill level, and what motivates them. Write it as if briefing a new companion about this player. Be warm but factual.",
  "personality": {
    "traits": ["3-6 personality traits like 'creative', 'patient', 'adventurous', 'methodical', 'social', 'competitive'"],
    "communicationStyle": "How they talk to Dory: casual, enthusiastic, brief, detailed, humorous, demanding, etc.",
    "playStyle": "Their Minecraft play style: creative builder, survival specialist, explorer, redstone engineer, farmer, combat-focused, etc."
  },
  "preferences": {
    "buildingStyle": "Their building preferences: modern, medieval, rustic, minimalist, etc. or 'unknown' if not enough data",
    "favoriteMaterials": ["Preferred blocks/materials if known, e.g. 'oak_planks', 'stone_bricks'"],
    "favoriteActivities": ["Activities they enjoy: building, mining, exploring, farming, combat, crafting, etc."],
    "dislikes": ["Things they've expressed disliking or avoiding"]
  },
  "goals": {
    "activeGoals": ["Current goals they're working toward"],
    "completedGoals": ["Goals they've already achieved"],
    "aspirations": ["Longer-term ambitions mentioned even casually"]
  },
  "relationship": "A 1-2 sentence guide for how Dory should interact with this specific player. Consider their personality, communication style, and preferences. E.g. 'This player likes quick, enthusiastic responses and appreciates when Dory takes initiative. Keep suggestions practical and action-oriented.'"
}

Guidelines:
- Weight RECENT information more heavily than old data — people's preferences evolve.
- If the current profile exists, REFINE it. Update traits, add new preferences, mark completed goals. Don't lose old information unless contradicted.
- Be specific to Minecraft: mention block types, biomes, activities, not generic traits.
- If there's limited data, say so honestly rather than inventing traits.
- The "relationship" field is critical — it directly shapes how Dory talks to this player.`;

const DAILY_SUMMARY_PROMPT = `You are a Memory Summary Agent for Dory, an AI Minecraft gaming companion.
Your job is to create a daily summary that captures the full picture of what happened today.

You will receive:
1. Previous daily summary (if the day was already summarized — update it)
2. Today's session summaries (one per play session)

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "narrative": "A 3-5 sentence summary of the day's gameplay. Mention how many sessions were played, the most notable events across all sessions, any progress on goals, and the overall arc of the day.",
  "highlights": [
    "Top 3-7 highlights across all sessions, e.g. 'Built first house in the plains biome', 'Collected enough iron for full armor set', 'Explored a cave and found diamonds'"
  ],
  "progress": "Summary of any goal progress: what moved forward, what was completed, what got blocked. Say 'No specific goal progress' if none.",
  "mood": "Overall mood of the day: productive, chaotic, chill, ambitious, frustrating, etc.",
  "totalPlaytime": "Rough estimate if inferable, otherwise 'unknown'"
}

Guidelines:
- Synthesize across sessions — find the day's overall story, don't just list session summaries.
- Highlight the MOST interesting or important things, not everything.
- If there was only one session, the daily summary can be brief.`;

// ═══════════════════════════════════════════════════════════════════════════
// Session Summary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update session summary incrementally.
 * Uses previous summary + new memories since last update.
 */
export async function updateSessionSummary(
  userId: string,
  sessionId: string
): Promise<ObjectId | null> {
  console.log(`[Summary Manager] Updating session summary for ${sessionId}`);

  try {
    const memoriesCol = getMemoriesCollection();
    const summariesCol = getSummariesCollection();

    // Existing summary (if any)
    const existing = (await summariesCol.findOne({
      userId,
      summaryType: 'session',
      'period.sessionId': sessionId,
    })) as MemorySummary | null;

    // All memories for this session
    const memories = (await memoriesCol
      .find({ userId, sessionId })
      .sort({ timestamp: 1 })
      .toArray()) as Memory[];

    if (memories.length === 0) {
      console.log(`[Summary Manager] No memories for session ${sessionId}`);
      return null;
    }

    // New memories since last update
    const since = existing?.lastUpdated || new Date(0);
    const newMemories = memories.filter((m) => m.timestamp > since);

    console.log(
      `[Summary Manager] Total: ${memories.length}, new: ${newMemories.length}`
    );

    // ── LLM narrative generation ────────────────────────────────────────
    let narrative = '';
    let keyHighlights: string[] = [];
    let mood = 'productive';
    let llmAchievements: Array<{ description: string; timestamp: Date; category: string }> = [];
    let llmPreferences: string[] = [];

    const llm = getLLMClient();
    if (llm && newMemories.length > 0) {
      try {
        const descs = newMemories
          .map((m) => {
            if (m.type === 'episodic') return `- ${m.data.description}`;
            if (m.type === 'semantic')
              return `- Learned: ${m.data.key} = ${JSON.stringify(m.data.value)}`;
            return `- ${m.textContent}`;
          })
          .join('\n');

        const prev = existing?.content.narrative
          ? `Previous summary: ${existing.content.narrative}\n\n`
          : '';

        const resp = await llm.complete({
          messages: [
            { role: 'system', content: SESSION_SUMMARY_PROMPT },
            { role: 'user', content: `${prev}New memories:\n${descs}` },
          ],
          temperature: 0.3,
          max_tokens: 800,
        });

        const raw = resp.message.content?.trim() || '{}';
        const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        narrative = parsed.narrative || '';
        keyHighlights = parsed.keyHighlights || [];
        mood = parsed.mood || 'productive';
        // Merge LLM-generated achievements
        if (parsed.achievements && Array.isArray(parsed.achievements)) {
          for (const a of parsed.achievements) {
            llmAchievements.push({
              description: a.description || a,
              timestamp: new Date(),
              category: a.category || 'general',
            });
          }
        }
        // Capture learned preferences
        if (parsed.preferences_learned && Array.isArray(parsed.preferences_learned)) {
          llmPreferences = parsed.preferences_learned;
        }
      } catch (err) {
        console.warn('[Summary Manager] Session LLM call failed:', err);
      }
    }

    // ── Aggregate stats ─────────────────────────────────────────────────
    const stats = aggregateStats(memories);

    const keyEvents = memories
      .filter((m) => m.importance > 0.6 && m.type === 'episodic')
      .map((m) => ({
        description: (m as any).data.description as string,
        timestamp: m.timestamp,
        importance: m.importance,
      }))
      .slice(0, 10);

    // Merge achievements: existing + LLM-generated (deduplicated)
    const existingAchievements = existing?.content.achievements || [];
    const allAchievements = [...existingAchievements];
    for (const a of llmAchievements) {
      if (!allAchievements.some((e) => e.description === a.description)) {
        allAchievements.push(a);
      }
    }

    const summary: MemorySummary = {
      userId,
      summaryType: 'session',
      period: {
        start: memories[0].timestamp,
        end: memories[memories.length - 1].timestamp,
        sessionId,
      },
      content: {
        narrative,
        keyEvents,
        achievements: allAchievements,
        learned: memories
          .filter((m) => m.type === 'semantic')
          .map((m) => ({
            key: (m as any).data.key,
            value: (m as any).data.value,
            confidence: (m as any).data.confidence,
            source: 'session',
          })),
        statistics: stats,
      },
      textContent:
        narrative ||
        `Session with ${memories.length} events. ${keyHighlights.join('. ')}`,
      sourceMemoryIds: memories.map((m) => m._id!),
      sourceMemoryCount: memories.length,
      previousSummaryId: existing?._id,
      createdAt: existing?.createdAt || new Date(),
      lastUpdated: new Date(),
      version: (existing?.version || 0) + 1,
    };

    // Store metadata outside the typed shape
    (summary as any).metadata = { mood, keyHighlights, preferencesLearned: llmPreferences };

    // Upsert
    if (existing) {
      await summariesCol.updateOne({ _id: existing._id }, { $set: summary });
      console.log(`[Summary Manager] Updated session summary v${summary.version}`);
      return existing._id;
    } else {
      const res = await summariesCol.insertOne(summary as any);
      console.log(`[Summary Manager] Created session summary: ${res.insertedId}`);
      return res.insertedId;
    }
  } catch (error) {
    console.error('[Summary Manager] Error updating session summary:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// User Profile
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update user profile incrementally.
 * Uses current profile + latest session + all semantic memories.
 */
export async function updateUserProfile(
  userId: string
): Promise<ObjectId | null> {
  console.log(`[Summary Manager] Updating user profile for ${userId}`);

  try {
    const memoriesCol = getMemoriesCollection();
    const summariesCol = getSummariesCollection();

    const existingProfile = (await summariesCol.findOne({
      userId,
      summaryType: 'user_profile',
    })) as MemorySummary | null;

    const latestSession = (await summariesCol.findOne(
      { userId, summaryType: 'session' },
      { sort: { lastUpdated: -1 } }
    )) as MemorySummary | null;

    const semanticMemories = (await memoriesCol
      .find({ userId, type: 'semantic' })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray()) as Memory[];

    const sessionCount = await summariesCol.countDocuments({
      userId,
      summaryType: 'session',
    });

    console.log(
      `[Summary Manager] Profile input: ${semanticMemories.length} semantic memories, ${sessionCount} sessions`
    );

    // ── LLM profile generation ──────────────────────────────────────────
    let profileData: any = {
      narrative: '',
      personality: { traits: [], communicationStyle: 'unknown', playStyle: 'unknown' },
      preferences: { buildingStyle: 'unknown', favoriteActivities: [], dislikes: [] },
      goals: { activeGoals: [], completedGoals: [] },
      relationship: 'friendly and helpful',
    };

    const llm = getLLMClient();
    if (llm && semanticMemories.length > 0) {
      try {
        const memCtx = semanticMemories
          .map((m) => {
            const d = (m as any).data;
            return `- ${d.category}: ${d.key} = ${JSON.stringify(d.value)}`;
          })
          .join('\n');

        const prevProfile = existingProfile?.content.narrative
          ? `Current profile:\n${existingProfile.content.narrative}\nPersonality: ${JSON.stringify(existingProfile.content.personality)}\nPreferences: ${JSON.stringify(existingProfile.content.preferences)}\n\n`
          : '';

        const sessionCtx = latestSession?.content.narrative
          ? `Latest session:\n${latestSession.content.narrative}\n\n`
          : '';

        const resp = await llm.complete({
          messages: [
            { role: 'system', content: USER_PROFILE_PROMPT },
            {
              role: 'user',
              content: `${prevProfile}${sessionCtx}All known info about user:\n${memCtx}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1200,
        });

        const raw = resp.message.content?.trim() || '{}';
        const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        profileData = { ...profileData, ...JSON.parse(cleaned) };
      } catch (err) {
        console.warn('[Summary Manager] Profile LLM call failed:', err);
      }
    }

    const profile: MemorySummary = {
      userId,
      summaryType: 'user_profile',
      period: {
        start: existingProfile?.period.start || new Date(),
        end: new Date(),
      },
      content: {
        narrative: profileData.narrative,
        keyEvents: [],
        achievements: [],
        learned: semanticMemories.slice(0, 10).map((m) => ({
          key: (m as any).data.key,
          value: (m as any).data.value,
          confidence: (m as any).data.confidence,
          source: 'profile',
        })),
        statistics: {
          tasksCompleted: 0,
          tasksFailed: 0,
          resourcesCollected: {},
          structuresBuilt: 0,
          deaths: 0,
          sessionsPlayed: sessionCount,
        },
        preferences: profileData.preferences,
        personality: profileData.personality,
        goals:
          profileData.goals?.activeGoals?.map((g: string) => ({
            description: g,
            status: 'active' as const,
            startedAt: new Date(),
          })) || [],
      },
      textContent:
        profileData.narrative ||
        `User with ${sessionCount} sessions and ${semanticMemories.length} known preferences.`,
      sourceMemoryIds: semanticMemories.map((m) => m._id!),
      sourceMemoryCount: semanticMemories.length,
      previousSummaryId: existingProfile?._id,
      createdAt: existingProfile?.createdAt || new Date(),
      lastUpdated: new Date(),
      version: (existingProfile?.version || 0) + 1,
    };

    (profile as any).metadata = { relationship: profileData.relationship };

    if (existingProfile) {
      await summariesCol.updateOne(
        { _id: existingProfile._id },
        { $set: profile }
      );
      console.log(`[Summary Manager] Updated user profile v${profile.version}`);
      return existingProfile._id;
    } else {
      const res = await summariesCol.insertOne(profile as any);
      console.log(`[Summary Manager] Created user profile: ${res.insertedId}`);
      return res.insertedId;
    }
  } catch (error) {
    console.error('[Summary Manager] Error updating user profile:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Daily Summary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update daily summary — aggregates today's session summaries.
 */
export async function updateDailySummary(
  userId: string,
  date: Date = new Date()
): Promise<ObjectId | null> {
  console.log(
    `[Summary Manager] Updating daily summary for ${userId} on ${date.toDateString()}`
  );

  try {
    const summariesCol = getSummariesCollection();

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existingDaily = (await summariesCol.findOne({
      userId,
      summaryType: 'daily',
      'period.start': { $gte: dayStart },
      'period.end': { $lte: dayEnd },
    })) as MemorySummary | null;

    const sessionSummaries = (await summariesCol
      .find({
        userId,
        summaryType: 'session',
        'period.start': { $gte: dayStart },
        'period.end': { $lte: dayEnd },
      })
      .toArray()) as MemorySummary[];

    if (sessionSummaries.length === 0) {
      console.log(`[Summary Manager] No sessions today for ${userId}`);
      return null;
    }

    console.log(`[Summary Manager] Found ${sessionSummaries.length} sessions today`);

    // ── LLM narrative ───────────────────────────────────────────────────
    let narrative = '';
    let highlights: string[] = [];

    const llm = getLLMClient();
    if (llm) {
      try {
        const sessionNarr = sessionSummaries
          .map((s) => s.content.narrative || 'Session with various activities')
          .join('\n- ');

        const prev = existingDaily?.content.narrative
          ? `Previous daily summary: ${existingDaily.content.narrative}\n\n`
          : '';

        const resp = await llm.complete({
          messages: [
            { role: 'system', content: DAILY_SUMMARY_PROMPT },
            { role: 'user', content: `${prev}Today's sessions:\n- ${sessionNarr}` },
          ],
          temperature: 0.3,
          max_tokens: 600,
        });

        const raw = resp.message.content?.trim() || '{}';
        const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        narrative = parsed.narrative || '';
        highlights = parsed.highlights || [];
      } catch (err) {
        console.warn('[Summary Manager] Daily LLM call failed:', err);
      }
    }

    // ── Aggregate stats from sessions ───────────────────────────────────
    const stats = {
      tasksCompleted: 0,
      tasksFailed: 0,
      resourcesCollected: {} as Record<string, number>,
      structuresBuilt: 0,
      deaths: 0,
      sessionsPlayed: sessionSummaries.length,
    };

    for (const s of sessionSummaries) {
      stats.tasksCompleted += s.content.statistics.tasksCompleted;
      stats.tasksFailed += s.content.statistics.tasksFailed;
      stats.deaths += s.content.statistics.deaths;
      stats.structuresBuilt += s.content.statistics.structuresBuilt;
      for (const [res, cnt] of Object.entries(s.content.statistics.resourcesCollected)) {
        stats.resourcesCollected[res] = (stats.resourcesCollected[res] || 0) + cnt;
      }
    }

    const daily: MemorySummary = {
      userId,
      summaryType: 'daily',
      period: { start: dayStart, end: dayEnd },
      content: {
        narrative,
        keyEvents: sessionSummaries.flatMap((s) => s.content.keyEvents).slice(0, 10),
        achievements: sessionSummaries.flatMap((s) => s.content.achievements).slice(0, 5),
        learned: sessionSummaries.flatMap((s) => s.content.learned),
        statistics: stats,
      },
      textContent:
        narrative ||
        `Day with ${sessionSummaries.length} sessions. ${highlights.join('. ')}`,
      sourceMemoryIds: sessionSummaries.flatMap((s) => s.sourceMemoryIds),
      sourceMemoryCount: sessionSummaries.reduce(
        (sum, s) => sum + s.sourceMemoryCount,
        0
      ),
      previousSummaryId: existingDaily?._id,
      createdAt: existingDaily?.createdAt || new Date(),
      lastUpdated: new Date(),
      version: (existingDaily?.version || 0) + 1,
    };

    if (existingDaily) {
      await summariesCol.updateOne({ _id: existingDaily._id }, { $set: daily });
      console.log(`[Summary Manager] Updated daily summary v${daily.version}`);
      return existingDaily._id;
    } else {
      const res = await summariesCol.insertOne(daily as any);
      console.log(`[Summary Manager] Created daily summary: ${res.insertedId}`);
      return res.insertedId;
    }
  } catch (error) {
    console.error('[Summary Manager] Error updating daily summary:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Session End Handler
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Called when a session ends.
 * Updates session summary, daily summary, and user profile.
 */
export async function onSessionEnd(
  userId: string,
  sessionId: string
): Promise<void> {
  console.log(`[Summary Manager] Session ended: ${sessionId}`);

  try {
    await updateSessionSummary(userId, sessionId);
    await updateDailySummary(userId);
    await updateUserProfile(userId);
    console.log('[Summary Manager] All summaries updated for session end');
  } catch (error) {
    console.error('[Summary Manager] Error on session end:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function aggregateStats(
  memories: Memory[]
): MemorySummary['content']['statistics'] {
  const stats = {
    tasksCompleted: 0,
    tasksFailed: 0,
    resourcesCollected: {} as Record<string, number>,
    structuresBuilt: 0,
    deaths: 0,
  };

  for (const m of memories) {
    if (m.type !== 'episodic') continue;
    const ev = m.data.event;
    if (ev === 'task_completed') stats.tasksCompleted++;
    if (ev === 'task_failed') stats.tasksFailed++;
    if (ev === 'death') stats.deaths++;
    if (ev === 'structure_built') stats.structuresBuilt++;
    if (ev === 'resource_collected') {
      const match = m.data.description?.match(/Collected (\d+)x (\w+)/);
      if (match) {
        stats.resourcesCollected[match[2]] =
          (stats.resourcesCollected[match[2]] || 0) + parseInt(match[1]);
      }
    }
  }

  return stats;
}
