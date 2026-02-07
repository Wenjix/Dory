/**
 * Builder Module - AI-powered structure generation for Minecraft.
 *
 * Generates structures from natural language descriptions using LLM code generation
 * and places them progressively in the world via /setblock commands.
 */

export { generateAndBuild, cancelBuild, isBuildActive } from './builder-engine';
export type { BuildRequest, BuildResult } from './builder-engine';
export { extractJsCode, executeBuildCode } from './js-sandbox';
export type { BlockPlacement } from './js-sandbox';
export { placeBlocks, clearArea } from './block-placer';
export { normalizeBlock, loadAllowedBlocks, getBlockIdListText } from './block-validator';
