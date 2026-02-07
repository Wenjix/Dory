/**
 * Block Validator - Validates and normalizes Minecraft block names.
 *
 * Ported from MineGenAI's core.py _normalize_block() and _load_allowed_blocks().
 * Validates block types against an allowed list and handles block states.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@dory/shared';

const logger = createLogger('block-validator');

let allowedBlocks: Set<string> | null = null;

/**
 * Load the allowed block list from block-id-list.txt.
 * Cached after first load.
 */
export function loadAllowedBlocks(): Set<string> {
  if (allowedBlocks) return allowedBlocks;

  try {
    const filePath = join(__dirname, 'block-id-list.txt');
    const content = readFileSync(filePath, 'utf-8');
    allowedBlocks = new Set(
      content.split('\n').map((line) => line.trim()).filter(Boolean)
    );
    logger.info(`Loaded ${allowedBlocks.size} allowed block types`);
    return allowedBlocks;
  } catch (err) {
    logger.error('Failed to load block list', { error: (err as Error).message });
    return new Set();
  }
}

/**
 * Normalize a block type string and validate it against the allowed list.
 *
 * Handles:
 * - Adding "minecraft:" prefix if missing
 * - Validating against allowed block list
 * - Formatting block states deterministically (sorted key=value pairs)
 *
 * @returns Normalized block string like "minecraft:oak_planks[facing=north,half=top]"
 *          or null if the block is not allowed
 */
export function normalizeBlock(
  blockType: string,
  blockStates?: Record<string, string> | null
): string | null {
  if (!blockType) return null;

  const allowed = loadAllowedBlocks();

  let base = blockType.trim();
  if (!base.startsWith('minecraft:')) {
    base = `minecraft:${base}`;
  }

  // Strip any inline states for the membership check
  const baseId = base.split('[')[0];

  if (!allowed.has(baseId)) {
    logger.debug(`Skipping unsupported block: ${baseId}`);
    return null;
  }

  // Attach block states if provided
  if (blockStates && typeof blockStates === 'object' && Object.keys(blockStates).length > 0) {
    const sorted = Object.entries(blockStates)
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    return `${baseId}[${sorted.join(',')}]`;
  }

  return baseId;
}

/**
 * Get the raw block ID list as a string (for injection into prompts).
 */
export function getBlockIdListText(): string {
  try {
    const filePath = join(__dirname, 'block-id-list.txt');
    return readFileSync(filePath, 'utf-8');
  } catch {
    logger.error('Failed to read block-id-list.txt');
    return '';
  }
}
