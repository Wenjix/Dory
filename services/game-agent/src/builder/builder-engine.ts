/**
 * Builder Engine - Orchestrates AI structure generation.
 *
 * Flow: description → build prompt → LLM call → extract JS → sandbox execute → place blocks
 *
 * Ported from MineGenAI's service.py and core.py, adapted for Dory AI's architecture.
 * Instead of generating .schem files, we place blocks directly in the world
 * via /setblock commands for a live progressive building experience.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@dory/shared';
import { MinecraftBot } from '../bot/minecraft-bot';
import { getLLMClient } from '../llm/instance';
import { createLLMClient } from '../llm/client';
import type { LLMProvider } from '../llm/types';
import { getBlockIdListText } from './block-validator';
import { extractJsCode, executeBuildCode, type BlockPlacement } from './js-sandbox';
import { placeBlocks, clearArea, type PlacerOptions, type PlacerResult } from './block-placer';
import { Vec3 } from 'vec3';

const logger = createLogger('builder-engine');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuildRequest {
  /** Natural language description of what to build */
  description: string;
  /** Player username (used to find their position/direction) */
  playerUsername?: string;
  /** Optional explicit build coordinates (overrides auto-positioning) */
  position?: { x: number; y: number; z: number };
  /** Minecraft version string for prompt (default: "1.20.4") */
  minecraftVersion?: string;
  /** Block placement delay in ms (default: 20) */
  blockDelayMs?: number;
}

export interface BuildResult {
  success: boolean;
  message: string;
  blocksPlaced?: number;
  totalBlocks?: number;
  position?: { x: number; y: number; z: number };
  durationMs?: number;
  cancelled?: boolean;
}

// ── Active builds (for cancellation) ──────────────────────────────────────────

const activeBuilds = new Map<string, { aborted: boolean }>();

/**
 * Cancel an active build for a given session.
 */
export function cancelBuild(sessionId: string): boolean {
  const signal = activeBuilds.get(sessionId);
  if (signal) {
    signal.aborted = true;
    activeBuilds.delete(sessionId);
    logger.info(`Build cancelled for session ${sessionId}`);
    return true;
  }
  return false;
}

/**
 * Check if a build is currently active for a session.
 */
export function isBuildActive(sessionId: string): boolean {
  return activeBuilds.has(sessionId);
}

// ── Builder LLM (can be a separate, more capable model) ───────────────────────

let builderLLM: LLMProvider | null = null;

/**
 * Get or create the LLM client for structure generation.
 *
 * Uses a dedicated, high-capability model for building since structure
 * generation requires strong spatial reasoning and one-shot code generation.
 *
 * Recommended: gpt-5.2 (OpenAI) or claude-sonnet-4-20250514 (Anthropic)
 *
 * Env vars:
 *   BUILDER_LLM_PROVIDER  - "openai" | "anthropic" | "mistral" (default: "openai")
 *   BUILDER_LLM_MODEL     - Model name (default: "gpt-5.2")
 *   OPENAI_API_KEY         - Required if using OpenAI
 *
 * If not configured, falls back to the game agent's default LLM.
 */
function getBuilderLLM(): LLMProvider | null {
  if (builderLLM) return builderLLM;

  // Try dedicated builder config first
  const provider = process.env.BUILDER_LLM_PROVIDER;
  const model = process.env.BUILDER_LLM_MODEL;

  if (provider) {
    try {
      builderLLM = createLLMClient({
        provider: provider as any,
        model: model || undefined,
      });
      logger.info(`Builder using dedicated LLM: ${provider} / ${builderLLM.model}`);
      return builderLLM;
    } catch (err) {
      logger.warn(`Failed to create builder LLM (${provider}), falling back to default: ${(err as Error).message}`);
    }
  }

  // Fall back to game agent's default LLM
  return getLLMClient();
}

// ── Prompt Loading ────────────────────────────────────────────────────────────

interface Prompts {
  SYS_GEN: string;
  USR_GEN: string;
  SYS_GEN_NAME: string;
  USR_GEN_NAME: string;
}

let cachedPrompts: Prompts | null = null;

function loadPrompts(): Prompts {
  if (cachedPrompts) return cachedPrompts;

  const filePath = join(__dirname, 'prompts.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

  cachedPrompts = {
    SYS_GEN: Array.isArray(raw.SYS_GEN) ? raw.SYS_GEN.join('') : raw.SYS_GEN,
    USR_GEN: raw.USR_GEN || '%DESCRIPTION%',
    SYS_GEN_NAME: raw.SYS_GEN_NAME || '',
    USR_GEN_NAME: raw.USR_GEN_NAME || '%DESCRIPTION%',
  };

  return cachedPrompts;
}

// ── Position Calculation ──────────────────────────────────────────────────────

/**
 * Find the ground level (highest non-air block) at a given x, z.
 */
function getGroundLevel(bot: MinecraftBot, x: number, z: number): number {
  for (let y = 256; y >= 0; y--) {
    const block = bot.bot.blockAt(new Vec3(x, y, z));
    if (block && block.name !== 'air') {
      return y + 1; // build on top of this block
    }
  }
  return 64; // default ground level
}

/**
 * Calculate the build position in front of the player, facing them.
 * Offsets ~12 blocks in the direction the player is looking.
 */
function calculateBuildPosition(
  bot: MinecraftBot,
  playerUsername?: string
): { x: number; y: number; z: number } | null {
  // Find the player
  const username = playerUsername || findNearestPlayerUsername(bot);
  if (!username) {
    logger.warn('No player found - falling back to bot position');
    const pos = bot.position;
    return {
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z),
    };
  }

  const player = bot.bot.players[username];
  if (!player?.entity) {
    logger.warn(`Player ${username} not visible - falling back to bot position`);
    const pos = bot.position;
    return {
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z),
    };
  }

  const playerPos = player.entity.position;
  // Prefer headYaw (actual look direction) over body yaw (can lag behind)
  const playerYaw = (player.entity as any).headYaw ?? player.entity.yaw;

  // Direction formula matches the proven raycast in vision.ts (getBlockPlayerIsLookingAt)
  // Look direction: (-sin(yaw), -cos(yaw))
  const distance = 15;
  const dx = -Math.sin(playerYaw) * distance;
  const dz = -Math.cos(playerYaw) * distance;

  const buildX = Math.floor(playerPos.x + dx);
  const buildZ = Math.floor(playerPos.z + dz);
  const buildY = getGroundLevel(bot, buildX, buildZ);

  logger.info(
    `Build position: (${buildX}, ${buildY}, ${buildZ}) - ` +
    `${distance} blocks in front of ${username} at (${Math.floor(playerPos.x)}, ${Math.floor(playerPos.y)}, ${Math.floor(playerPos.z)}) ` +
    `[yaw=${playerYaw.toFixed(2)} rad / ${(playerYaw * 180 / Math.PI).toFixed(0)}°, dx=${dx.toFixed(1)}, dz=${dz.toFixed(1)}]`
  );

  return { x: buildX, y: buildY, z: buildZ };
}

function findNearestPlayerUsername(bot: MinecraftBot): string | null {
  const players = Object.values(bot.bot.players).filter(
    (p) => p.entity && p.username !== bot.username
  );
  if (players.length === 0) return null;

  const nearest = players.reduce((prev, curr) => {
    const prevDist = bot.bot.entity.position.distanceTo(prev.entity!.position);
    const currDist = bot.bot.entity.position.distanceTo(curr.entity!.position);
    return currDist < prevDist ? curr : prev;
  });

  return nearest.username;
}

// ── Main Build Function ───────────────────────────────────────────────────────

/**
 * Generate and build a structure from a natural language description.
 *
 * This is the main entry point for the builder system:
 * 1. Calculates build position (in front of player)
 * 2. Builds the LLM prompt with block list and description
 * 3. Calls LLM to generate JavaScript build code
 * 4. Executes the code in a sandbox to get block placements
 * 5. Places blocks progressively in the world
 */
export async function generateAndBuild(
  bot: MinecraftBot,
  request: BuildRequest
): Promise<BuildResult> {
  const sessionId = bot.sessionId;
  const startTime = Date.now();

  // ── 1. Check for active builds ──────────────────────────────────────────
  if (isBuildActive(sessionId)) {
    return {
      success: false,
      message: 'A build is already in progress. Say "stop building" to cancel it first.',
    };
  }

  // ── 2. Get LLM client ──────────────────────────────────────────────────
  const llm = getBuilderLLM();
  if (!llm) {
    return {
      success: false,
      message: 'LLM client not initialized. Check your API key configuration.',
    };
  }

  logger.info(`Using LLM for building: ${llm.name} / ${llm.model}`);

  // ── 3. Calculate build position ─────────────────────────────────────────
  const buildPos = request.position || calculateBuildPosition(bot, request.playerUsername);
  if (!buildPos) {
    return {
      success: false,
      message: 'Could not determine build position. No player found nearby.',
    };
  }

  logger.info(`Generating structure: "${request.description}" at (${buildPos.x}, ${buildPos.y}, ${buildPos.z})`);

  // ── 4. Build the prompt ─────────────────────────────────────────────────
  const prompts = loadPrompts();
  const blockIdList = getBlockIdListText();
  const mcVersion = request.minecraftVersion || '1.20.4';

  const systemPrompt = prompts.SYS_GEN
    .replace('%MINECRAFT_VERSION%', mcVersion)
    .replace('%BUILD_SPEC%', request.description)
    .replace('%BLOCK_TYPES_LIST%', blockIdList);

  // ── 5. Call LLM ─────────────────────────────────────────────────────────
  // Note: we intentionally do NOT emit events during the design phase.
  // The voice agent prompt tells Dory AI to give a heads-up before sending the command,
  // so the player already knows to wait. Emitting here causes Dory AI to narrate
  // prematurely ("blocks are going up!") before anything is actually placed.

  let llmResponse: string;
  try {
    logger.info('Calling LLM to generate build code...');
    const response = await llm.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.description },
      ],
      temperature: 0.7,
      max_tokens: 32000, // Complex structures need room for detailed code
    });

    llmResponse = response.message.content || '';
    logger.info(`LLM response received (${llmResponse.length} chars)`);
  } catch (err) {
    logger.error(`LLM call failed: ${(err as Error).message}`);
    return {
      success: false,
      message: `Failed to generate build code: ${(err as Error).message}`,
    };
  }

  // ── 6. Extract JS code ──────────────────────────────────────────────────
  const jsCode = extractJsCode(llmResponse);
  if (!jsCode) {
    logger.error('No <code> block found in LLM response');
    return {
      success: false,
      message: 'The AI did not produce valid build code. Try rephrasing your description.',
    };
  }

  logger.info(`Extracted JS code (${jsCode.length} chars)`);

  // ── 7. Execute in sandbox ───────────────────────────────────────────────
  let placements: BlockPlacement[];
  try {
    placements = executeBuildCode(jsCode, buildPos.x, buildPos.y, buildPos.z);
  } catch (err) {
    logger.error(`Sandbox execution failed: ${(err as Error).message}`);
    return {
      success: false,
      message: `Build code execution failed: ${(err as Error).message}`,
    };
  }

  if (placements.length === 0) {
    return {
      success: false,
      message: 'The generated code produced no blocks. Try a different description.',
    };
  }

  logger.info(`Generated ${placements.length} block placements`);

  // ── 8. Place blocks ─────────────────────────────────────────────────────

  // Register abort signal for cancellation
  const abortSignal = { aborted: false };
  activeBuilds.set(sessionId, abortSignal);

  // Announce the build in Minecraft chat before suppressing command feedback
  bot.chat(`Starting structure generation at ${buildPos.x}, ${buildPos.y}, ${buildPos.z} — placing ${placements.length} blocks!`);

  // Suppress /setblock feedback in Minecraft chat during build
  bot.chat('/gamerule sendCommandFeedback false');

  try {
    const placerResult = await placeBlocks(bot, placements, sessionId, {
      blockDelayMs: request.blockDelayMs ?? 20,
      abortSignal,
    });

    // Re-enable command feedback and clean up
    bot.chat('/gamerule sendCommandFeedback true');
    activeBuilds.delete(sessionId);

    return {
      success: placerResult.success,
      message: placerResult.message,
      blocksPlaced: placerResult.blocksPlaced,
      totalBlocks: placerResult.totalBlocks,
      position: buildPos,
      durationMs: Date.now() - startTime,
      cancelled: placerResult.cancelled,
    };
  } catch (err) {
    bot.chat('/gamerule sendCommandFeedback true');
    activeBuilds.delete(sessionId);
    logger.error(`Block placement failed: ${(err as Error).message}`);
    return {
      success: false,
      message: `Block placement failed: ${(err as Error).message}`,
      durationMs: Date.now() - startTime,
    };
  }
}
