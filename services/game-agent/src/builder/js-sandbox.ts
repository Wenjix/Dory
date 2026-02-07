/**
 * JS Sandbox - Executes LLM-generated JavaScript build code safely.
 *
 * Ported from MineGenAI's core.py _execute_js_build().
 * Uses Node.js `vm` module to run code in a restricted context.
 * The sandbox injects safeSetBlock/safeFill helpers that collect
 * block placements into an array without actually modifying the world.
 *
 * For a hackathon this is fine. For production, consider `isolated-vm`.
 */

import * as vm from 'vm';
import { createLogger } from '@dory/shared';
import { normalizeBlock } from './block-validator';

const logger = createLogger('js-sandbox');

export interface BlockPlacement {
  x: number;
  y: number;
  z: number;
  block: string;
}

/**
 * Extract JavaScript code from LLM response (between <code> tags).
 */
export function extractJsCode(text: string): string | null {
  if (!text) return null;
  const match = text.match(/<code>\s*([\s\S]*?)\s*<\/code>/i);
  return match ? match[1] : null;
}

/**
 * Execute LLM-generated JS build code in a sandbox.
 *
 * The code should define a `buildCreation(startX, startY, startZ)` function
 * that calls safeSetBlock() and safeFill() to place blocks.
 *
 * @returns Array of block placements collected during execution
 */
export function executeBuildCode(
  code: string,
  startX: number,
  startY: number,
  startZ: number,
  timeoutMs: number = 30_000
): BlockPlacement[] {
  // Transform any lingering async/await to sync (safety net)
  let cleanCode = code
    .replace(/\basync\s+function\b/g, 'function')
    .replace(/\bawait\s+/g, '');

  const placements = new Map<string, BlockPlacement>();

  // ── Block placement callbacks ───────────────────────────────────────────────

  function setBlock(
    x: number, y: number, z: number,
    blockType: string,
    options?: { blockStates?: Record<string, string>; mode?: string }
  ): void {
    try {
      const bx = Math.floor(Number(x));
      const by = Math.floor(Number(y));
      const bz = Math.floor(Number(z));
      if (isNaN(bx) || isNaN(by) || isNaN(bz)) return;

      const blockStates = options?.blockStates ?? null;
      const mode = options?.mode;
      const block = normalizeBlock(String(blockType), blockStates);
      if (!block) return;

      const key = `${bx},${by},${bz}`;
      if (mode === 'keep' && placements.has(key)) return;

      placements.set(key, { x: bx, y: by, z: bz, block });
    } catch (err) {
      logger.debug(`setBlock error: ${(err as Error).message}`);
    }
  }

  function fillRegion(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    blockType: string,
    options?: {
      blockStates?: Record<string, string>;
      mode?: string;
      replaceFilter?: string;
      replaceFilterStates?: Record<string, string>;
    }
  ): void {
    try {
      let bx1 = Math.floor(Number(x1)), by1 = Math.floor(Number(y1)), bz1 = Math.floor(Number(z1));
      let bx2 = Math.floor(Number(x2)), by2 = Math.floor(Number(y2)), bz2 = Math.floor(Number(z2));
      if ([bx1, by1, bz1, bx2, by2, bz2].some(isNaN)) return;

      // Ensure min <= max
      if (bx1 > bx2) [bx1, bx2] = [bx2, bx1];
      if (by1 > by2) [by1, by2] = [by2, by1];
      if (bz1 > bz2) [bz1, bz2] = [bz2, bz1];

      const blockStates = options?.blockStates ?? null;
      const mode = options?.mode;
      const replaceFilter = options?.replaceFilter;

      const block = normalizeBlock(String(blockType), blockStates);
      if (!block) return;

      // Derive replace filter base id
      let replaceBase: string | null = null;
      if (replaceFilter) {
        replaceBase = String(replaceFilter).startsWith('minecraft:')
          ? String(replaceFilter)
          : `minecraft:${replaceFilter}`;
      }

      const outlineOnly = mode === 'outline' || mode === 'hollow';

      for (let ix = bx1; ix <= bx2; ix++) {
        for (let iy = by1; iy <= by2; iy++) {
          for (let iz = bz1; iz <= bz2; iz++) {
            // Outline/hollow: skip interior blocks
            if (outlineOnly) {
              const atSurface =
                ix === bx1 || ix === bx2 ||
                iy === by1 || iy === by2 ||
                iz === bz1 || iz === bz2;
              if (!atSurface) continue;
            }

            const key = `${ix},${iy},${iz}`;

            // Keep mode: don't overwrite existing
            if (mode === 'keep' && placements.has(key)) continue;

            // Replace mode: only replace matching blocks
            if (mode === 'replace' && replaceBase !== null) {
              const existing = placements.get(key);
              const existingBase = existing ? existing.block.split('[')[0] : 'minecraft:air';
              if (existingBase !== replaceBase) continue;
            }

            placements.set(key, { x: ix, y: iy, z: iz, block });
          }
        }
      }
    } catch (err) {
      logger.debug(`fillRegion error: ${(err as Error).message}`);
    }
  }

  // ── Build sandbox context ─────────────────────────────────────────────────

  const sandbox = {
    safeSetBlock: setBlock,
    safeFill: fillRegion,
    safeFillBiome: () => { /* biome not supported */ },
    console: {
      log: (...args: any[]) => logger.debug(`[sandbox] ${args.join(' ')}`),
      warn: (...args: any[]) => logger.debug(`[sandbox warn] ${args.join(' ')}`),
      error: (...args: any[]) => logger.debug(`[sandbox error] ${args.join(' ')}`),
    },
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Number,
    String,
    Array,
    Object,
    JSON,
    Promise: {
      all: () => null,
      resolve: (v: any) => v,
    },
  };

  // ── Execute ───────────────────────────────────────────────────────────────

  try {
    const context = vm.createContext(sandbox);
    const fullCode = `${cleanCode}\nbuildCreation(${startX}, ${startY}, ${startZ});`;
    vm.runInContext(fullCode, context, { timeout: timeoutMs });
  } catch (err) {
    logger.error(`Sandbox execution error: ${(err as Error).message}`);
    throw new Error(`Build code execution failed: ${(err as Error).message}`);
  }

  // Return sorted placements (bottom-up for visual effect)
  const result = Array.from(placements.values());
  result.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);

  logger.info(`Sandbox produced ${result.length} block placements`);
  return result;
}
