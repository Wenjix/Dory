/**
 * Memory Retrieval Service
 *
 * Query functions for fetching memories and summaries from MongoDB.
 * Used by API routes, system prompt enrichment, and the voice agent.
 */

import type { Memory, MemorySummary, SummaryType, MemoryType } from './types.js';
import { getMemoriesCollection, getSummariesCollection } from './database.js';

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export async function getMemories(filters: {
  userId: string;
  sessionId?: string;
  type?: MemoryType;
  tags?: string[];
  minImportance?: number;
  limit?: number;
  skip?: number;
}): Promise<Memory[]> {
  const col = getMemoriesCollection();
  const query: any = { userId: filters.userId };

  if (filters.sessionId) query.sessionId = filters.sessionId;
  if (filters.type) query.type = filters.type;
  if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
  if (filters.minImportance) query.importance = { $gte: filters.minImportance };

  return col
    .find(query)
    .sort({ timestamp: -1 })
    .limit(filters.limit || 50)
    .skip(filters.skip || 0)
    .toArray();
}

export async function getRecentMemories(
  userId: string,
  limit: number = 20
): Promise<Memory[]> {
  return getMemoriesCollection()
    .find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export async function getSummaries(filters: {
  userId: string;
  summaryType?: SummaryType;
  sessionId?: string;
  limit?: number;
}): Promise<MemorySummary[]> {
  const col = getSummariesCollection();
  const query: any = { userId: filters.userId };

  if (filters.summaryType) query.summaryType = filters.summaryType;
  if (filters.sessionId) query['period.sessionId'] = filters.sessionId;

  return col
    .find(query)
    .sort({ 'period.end': -1 })
    .limit(filters.limit || 10)
    .toArray();
}

export async function getUserProfile(
  userId: string
): Promise<MemorySummary | null> {
  return getSummariesCollection().findOne({
    userId,
    summaryType: 'user_profile',
  });
}

export async function getLatestSessionSummary(
  userId: string
): Promise<MemorySummary | null> {
  return getSummariesCollection().findOne(
    { userId, summaryType: 'session' },
    { sort: { 'period.end': -1 } }
  );
}

// ---------------------------------------------------------------------------
// System Context (for prompt enrichment)
// ---------------------------------------------------------------------------

/**
 * Build a text block summarising everything Dory knows about a user.
 * Used to inject into the game agent's system prompt.
 */
export async function getSystemContext(userId: string): Promise<string> {
  const parts: string[] = [];

  // User profile
  const profile = await getUserProfile(userId);
  if (profile?.content.narrative) {
    parts.push(`## Player Profile\n${profile.content.narrative}`);

    if (profile.content.personality) {
      const p = profile.content.personality;
      if (p.traits?.length) parts.push(`Personality: ${p.traits.join(', ')}`);
      if (p.playStyle) parts.push(`Play style: ${p.playStyle}`);
      if (p.communicationStyle) parts.push(`Communication: ${p.communicationStyle}`);
    }

    if (profile.content.preferences) {
      const prefs = Object.entries(profile.content.preferences)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');
      if (prefs) parts.push(`Preferences: ${prefs}`);
    }

    if (profile.content.goals?.length) {
      const active = profile.content.goals
        .filter((g) => g.status === 'active')
        .map((g) => g.description);
      if (active.length) parts.push(`Active goals: ${active.join(', ')}`);
    }
  }

  // Latest session
  const session = await getLatestSessionSummary(userId);
  if (session?.content.narrative) {
    parts.push(`\n## Last Session\n${session.content.narrative}`);
  }

  // Recent semantic memories (preferences, knowledge)
  const semantics = await getMemories({
    userId,
    type: 'semantic',
    limit: 10,
    minImportance: 0.5,
  });
  if (semantics.length > 0) {
    const items = semantics.map((m) => `- ${m.textContent}`).join('\n');
    parts.push(`\n## Known Facts\n${items}`);
  }

  return parts.length > 0
    ? parts.join('\n')
    : 'No previous memory data for this user.';
}

// ---------------------------------------------------------------------------
// Stats (for dashboard)
// ---------------------------------------------------------------------------

export async function getMemoryStats(userId: string): Promise<{
  totalMemories: number;
  byType: Record<string, number>;
  totalSummaries: number;
  bySummaryType: Record<string, number>;
}> {
  const memCol = getMemoriesCollection();
  const sumCol = getSummariesCollection();

  const [totalMemories, totalSummaries, typeCounts, summaryTypeCounts] =
    await Promise.all([
      memCol.countDocuments({ userId }),
      sumCol.countDocuments({ userId }),
      memCol
        .aggregate([
          { $match: { userId } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .toArray(),
      sumCol
        .aggregate([
          { $match: { userId } },
          { $group: { _id: '$summaryType', count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

  const byType: Record<string, number> = {};
  for (const t of typeCounts) byType[t._id] = t.count;

  const bySummaryType: Record<string, number> = {};
  for (const t of summaryTypeCounts) bySummaryType[t._id] = t.count;

  return { totalMemories, byType, totalSummaries, bySummaryType };
}
