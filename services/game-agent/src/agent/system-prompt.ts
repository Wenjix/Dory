/**
 * System Prompt Builder
 *
 * Constructs the system prompt for the LLM with:
 * - Base identity and behavior rules
 * - Current game state snapshot
 * - Personality (future: injected per session)
 */

import { MinecraftBot } from '../bot/minecraft-bot';
import { getVisiblePlayers } from '../actions/vision';

// ─── Base Prompt ──────────────────────────────────────────────────────────────

const BASE_PROMPT = `You are Dory, an AI companion playing Minecraft alongside a human player. You are helpful, friendly, and capable of performing in-game actions through tools.

## Your Behavior

1. **Act, don't just talk.** When the player asks you to do something (build, collect, follow, etc.), use the appropriate tool immediately. Don't just describe what you would do.
2. **Be concise.** Keep your text responses short and natural - 1-2 sentences is ideal. You're a gaming buddy, not a lecturer.
3. **Use game knowledge.** You know Minecraft well - block names, crafting recipes, mob behavior, biomes, etc.
4. **Be aware of your state.** Check your inventory, position, and surroundings before attempting actions. If you need materials, say so.
5. **Handle failures gracefully.** If a tool fails, explain what went wrong briefly and suggest an alternative.
6. **Respond to context.** If the player says "here" or "there", use vision tools to understand where they mean.
7. **One action at a time.** Execute tools sequentially. Don't try to do too many things at once.

## Tool Usage Rules

- When the player says "follow me" or "come here", use movement tools.
- When the player references "where I'm looking" or "right here", use player-POV tools (what_is_player_looking_at, build_*_where_player_looking).
- When asked to build something, check inventory first with has_item or get_inventory.
- When asked "what do you see" or "look around", use vision tools.
- Always prefer player-POV building tools when the player is directing placement.`;

// ─── State Snapshot ───────────────────────────────────────────────────────────

/**
 * Build a state context string from the current bot state.
 * This gets appended to the system prompt so the LLM knows the current situation.
 */
export function buildStateContext(bot: MinecraftBot): string {
  const pos = bot.position;
  const health = bot.health;
  const food = bot.food;

  // Inventory summary
  const items = bot.bot.inventory.items();
  const inventorySummary =
    items.length > 0
      ? items.map((i) => `${i.count}x ${i.name}`).join(', ')
      : 'empty';

  // Nearby players
  const playersResult = getVisiblePlayers(bot);
  const playersSummary =
    playersResult.players.length > 0
      ? playersResult.players
          .map((p) => `${p.username} (${p.distance.toFixed(0)}m away at ${p.position.x.toFixed(0)}, ${p.position.y.toFixed(0)}, ${p.position.z.toFixed(0)})`)
          .join(', ')
      : 'none visible';

  return `
## Current Game State
- **Your position:** (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})
- **Health:** ${health}/20
- **Hunger:** ${food}/20
- **Inventory:** ${inventorySummary}
- **Nearby players:** ${playersSummary}`;
}

// ─── Full System Prompt ───────────────────────────────────────────────────────

/**
 * Build the complete system prompt for a session.
 *
 * @param bot - The MinecraftBot instance (for state injection)
 * @param personality - Optional personality override (future use)
 */
export function buildSystemPrompt(
  bot: MinecraftBot,
  personality?: string
): string {
  const parts: string[] = [];

  // Base identity
  parts.push(BASE_PROMPT);

  // Personality override (future: per-session personality)
  if (personality) {
    parts.push(`\n## Your Personality\n${personality}`);
  }

  // Current game state
  try {
    parts.push(buildStateContext(bot));
  } catch {
    parts.push('\n## Current Game State\nUnable to read game state.');
  }

  return parts.join('\n');
}
