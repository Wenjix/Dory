/**
 * Plan Executor
 *
 * Executes individual plan steps and resolves parameter references
 * ($step_N, $state, $player shorthands).
 */

import { createLogger, prettyJson } from '@dory/shared';
import type { Plan, PlanStep, StepResult, StateSnapshot } from './types';
import { executeTool } from '../tools/executor';
import { captureState } from './state-manager';
import { MinecraftBot } from '../bot/minecraft-bot';

const logger = createLogger('PlanExecutor');

// ─── Cancellation ─────────────────────────────────────────────────────────────

/**
 * Check if a plan has been cancelled.
 * The execution engine sets plan.status = 'cancelled' and the executor checks it
 * before and after each operation.
 */
function isPlanCancelled(plan: Plan): boolean {
  return plan.status === 'cancelled';
}

// ─── Step Execution ───────────────────────────────────────────────────────────

/**
 * Execute a single plan step.
 *
 * @param step - The step to execute
 * @param plan - The full plan (for parameter resolution and cancellation)
 * @param bot - MinecraftBot instance
 * @param sessionId - Session ID for logging
 */
export async function executeStep(
  step: PlanStep,
  plan: Plan,
  bot: MinecraftBot,
  sessionId: string
): Promise<StepResult> {
  logger.info(`[${sessionId}] Executing step ${step.id}: ${step.tool}`);

  // Check cancellation before starting
  if (isPlanCancelled(plan)) {
    logger.info(`[${sessionId}] Plan cancelled, aborting step ${step.id}`);
    return { success: false, error: 'Plan was cancelled' };
  }

  try {
    // ── Handle special planning-only tools ────────────────────────────────
    if (step.tool === 'wait') {
      const resolved = resolveParameters(step.parameters, plan, bot);
      const seconds = resolved.seconds || resolved.duration || 1;
      const ms = Math.max(0, Math.min(seconds * 1000, 60_000));

      logger.info(`[${sessionId}] Waiting ${seconds}s...`);
      await new Promise((r) => setTimeout(r, ms));

      return {
        success: true,
        data: { message: `Waited ${seconds} second(s)`, waited: seconds },
      };
    }

    // Check cancellation after param resolution
    if (isPlanCancelled(plan)) {
      return { success: false, error: 'Plan was cancelled' };
    }

    // ── Resolve parameters ────────────────────────────────────────────────
    const resolvedParams = resolveParameters(step.parameters, plan, bot);
    logger.info(`[${sessionId}] Step ${step.id} params:\n${prettyJson(resolvedParams)}`);

    // Check cancellation before tool execution
    if (isPlanCancelled(plan)) {
      return { success: false, error: 'Plan was cancelled' };
    }

    // ── Execute the tool ──────────────────────────────────────────────────
    const result = await executeTool(bot, step.tool, resolvedParams);

    logger.info(`[${sessionId}] Step ${step.id} result: success=${result.success}, msg="${result.message}"`);

    // Capture state after execution
    let stateSnapshot: StateSnapshot | undefined;
    try {
      stateSnapshot = captureState(bot);
    } catch {
      // Non-critical
    }

    // Extract structured data from tool result for $step_N references
    const extractedData = extractResultData(result.message, step.tool);

    return {
      success: result.success,
      data: {
        message: result.message,
        ...extractedData,
      },
      stateSnapshot,
      error: result.success ? undefined : result.message,
    };
  } catch (error) {
    const msg = (error as Error).message;
    logger.error(`[${sessionId}] Step ${step.id} failed: ${msg}`);
    return { success: false, error: msg };
  }
}

// ─── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate whether a step should run based on its condition.
 */
export function evaluateCondition(
  condition: PlanStep['condition'],
  plan: Plan
): boolean {
  if (!condition || condition.type === 'always') {
    return true;
  }

  try {
    const value = resolveReference(condition.check, plan);

    if (condition.type === 'if') {
      return !!value;
    }
    if (condition.type === 'if_not') {
      return !value;
    }
  } catch {
    // If we can't resolve the condition, default to true (run the step)
    logger.warn(`Could not evaluate condition "${condition.check}", defaulting to true`);
  }

  return true;
}

// ─── Parameter Resolution ─────────────────────────────────────────────────────

/**
 * Resolve all parameter references in a parameters object.
 */
function resolveParameters(
  params: Record<string, any>,
  plan: Plan,
  bot: MinecraftBot
): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    resolved[key] = resolveValue(value, plan, bot);
  }
  return resolved;
}

function resolveValue(value: any, plan: Plan, bot: MinecraftBot): any {
  if (typeof value !== 'string' || !value.startsWith('$')) {
    return value;
  }

  logger.debug(`Resolving reference: ${value}`);

  // $step_N.field — references to previous step results
  // LLM generates paths like "$step_0.result.position.x" or "$step_0.success"
  // step.result = { success, data: { message, ...extracted }, error }
  const stepMatch = value.match(/^\$step_(\d+)\.(.+)$/);
  if (stepMatch) {
    const stepIndex = parseInt(stepMatch[1]);
    let fieldPath = stepMatch[2];
    const step = plan.steps.find((s) => s.order === stepIndex);
    if (!step?.result) {
      throw new Error(`Cannot resolve ${value}: step_${stepIndex} not executed yet`);
    }

    // Strip leading "result." — LLM writes $step_0.result.X but we're already
    // accessing step.result, so "result.X" would double-nest.
    if (fieldPath.startsWith('result.')) {
      fieldPath = fieldPath.slice('result.'.length);
    }

    // Try step.result first (for "success", "error"), then step.result.data (for extracted fields)
    let resolved = getNestedValue(step.result, fieldPath);
    if (resolved === undefined && step.result.data) {
      resolved = getNestedValue(step.result.data, fieldPath);
    }
    if (resolved === undefined) {
      throw new Error(`Cannot resolve ${value}: field "${fieldPath}" not found`);
    }
    return resolved;
  }

  // $state.field
  const stateMatch = value.match(/^\$state\.(.+)$/);
  if (stateMatch) {
    const fieldPath = stateMatch[1];
    const state = captureState(bot);
    const result = getNestedValue(state, fieldPath);
    if (result === undefined) {
      throw new Error(`Cannot resolve ${value}: "${fieldPath}" not in state`);
    }
    return result;
  }

  // $player.position.x/y/z shorthand
  const playerMatch = value.match(/^\$player\.position\.(x|y|z)$/);
  if (playerMatch) {
    const coord = playerMatch[1] as 'x' | 'y' | 'z';
    const state = captureState(bot);
    if (!state.player.position) {
      throw new Error(`Cannot resolve ${value}: player not visible`);
    }
    return state.player.position[coord];
  }

  // Unresolvable reference -- return as-is
  logger.warn(`Could not resolve reference: ${value}, using as literal`);
  return value;
}

/**
 * Resolve a single reference string (used by condition evaluation).
 */
function resolveReference(ref: string, plan: Plan): any {
  const stepMatch = ref.match(/^\$step_(\d+)\.(.+)$/);
  if (stepMatch) {
    const stepIndex = parseInt(stepMatch[1]);
    let fieldPath = stepMatch[2];
    const step = plan.steps.find((s) => s.order === stepIndex);
    if (!step?.result) return undefined;

    // Strip leading "result." to avoid double-nesting
    if (fieldPath.startsWith('result.')) {
      fieldPath = fieldPath.slice('result.'.length);
    }

    // Try step.result first, then step.result.data
    let resolved = getNestedValue(step.result, fieldPath);
    if (resolved === undefined && step.result.data) {
      resolved = getNestedValue(step.result.data, fieldPath);
    }
    return resolved;
  }
  return undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((cur, prop) => {
    return cur && cur[prop] !== undefined ? cur[prop] : undefined;
  }, obj);
}

/**
 * Extract structured data from tool result messages for $step_N references.
 */
function extractResultData(message: string, toolName: string): Record<string, any> {
  const data: Record<string, any> = {};

  // Position extraction from get_position
  if (toolName === 'get_position') {
    const posMatch = message.match(/X=([\d.-]+).*Y=([\d.-]+).*Z=([\d.-]+)/);
    if (posMatch) {
      data.position = {
        x: parseFloat(posMatch[1]),
        y: parseFloat(posMatch[2]),
        z: parseFloat(posMatch[3]),
      };
    }
  }

  // Player look-target: extract block position and adjacent position
  // Format: "Player is looking at grass_block at (-71, 63, -22), ... Adjacent position: (-71, 64, -22)"
  if (toolName === 'what_is_player_looking_at') {
    const blockMatch = message.match(
      /looking at (\w+) at \(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/
    );
    if (blockMatch) {
      data.blockName = blockMatch[1];
      data.position = {
        x: parseFloat(blockMatch[2]),
        y: parseFloat(blockMatch[3]),
        z: parseFloat(blockMatch[4]),
      };
    }
    const adjMatch = message.match(
      /Adjacent position: \(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/
    );
    if (adjMatch) {
      data.adjacentPosition = {
        x: parseFloat(adjMatch[1]),
        y: parseFloat(adjMatch[2]),
        z: parseFloat(adjMatch[3]),
      };
    }
  }

  // Block scan extraction
  if (toolName === 'scan_area') {
    const blocksMatch = message.match(/Found \d+ block types nearby: ([^.]+)/);
    if (blocksMatch) {
      data.blocks = blocksMatch[1].split(',').map((b: string) => b.trim());
    }
  }

  return data;
}
