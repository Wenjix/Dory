/**
 * Execution Engine
 *
 * Orchestrates plan execution with:
 * - Step-by-step execution with condition checks
 * - Thorough cancellation (plan status + bot.stop())
 * - Smart re-planning (only for actionable failures, dedup check)
 */

import { createLogger, prettyJson } from '@dory/shared';
import type { Plan, PlanStep, ExecutionResult, StepResult } from './types';
import { executeStep, evaluateCondition } from './plan-executor';
import { captureState } from './state-manager';
import { createPlan } from './reasoning-agent';
import { MinecraftBot } from '../bot/minecraft-bot';
import type { LLMProvider } from '../llm/types';

const logger = createLogger('ExecutionEngine');

// ─── Active Plans ─────────────────────────────────────────────────────────────

/** One active plan per session */
const activePlans = new Map<string, Plan>();

export function getActivePlan(sessionId: string): Plan | null {
  return activePlans.get(sessionId) || null;
}

// ─── Re-planning Configuration ────────────────────────────────────────────────

const MAX_REPLAN_ATTEMPTS = 2;

/** Errors that are terminal -- no point re-planning */
const TERMINAL_ERRORS = [
  'unknown tool',
  'bot disconnected',
  'not connected',
  'plan was cancelled',
  'interrupted',
];

/**
 * Determine if a failure is actionable (worth re-planning)
 * vs terminal (would just fail the same way again).
 */
function isActionableFailure(error: string): boolean {
  const lower = error.toLowerCase();
  return !TERMINAL_ERRORS.some((term) => lower.includes(term));
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

/**
 * Cancel the active plan for a session.
 * Marks plan as cancelled AND calls bot.stop() to immediately
 * abort in-game actions (pathfinding, digging, collecting).
 */
export async function cancelPlan(
  sessionId: string,
  bot: MinecraftBot
): Promise<void> {
  const plan = activePlans.get(sessionId);
  if (!plan) {
    return;
  }

  logger.info(`[${sessionId}] CANCELLING plan ${plan.id}`);

  // Mark as cancelled -- the execution loop checks this
  plan.status = 'cancelled';

  // Immediately stop all bot actions
  try {
    await bot.stop();
  } catch (err) {
    logger.warn(`[${sessionId}] Error stopping bot during cancel: ${(err as Error).message}`);
  }

  // Remove from active plans AFTER stopping (so isPlanCancelled works during step)
  activePlans.delete(sessionId);

  logger.info(`[${sessionId}] Plan ${plan.id} cancelled and bot stopped`);
}

// ─── Plan Execution ───────────────────────────────────────────────────────────

/**
 * Execute a plan step-by-step.
 *
 * @param plan - The plan to execute
 * @param bot - MinecraftBot instance
 * @param llm - LLM provider (for re-planning)
 * @param replanAttempts - Current re-plan attempt count
 */
export async function executePlan(
  plan: Plan,
  bot: MinecraftBot,
  llm: LLMProvider,
  replanAttempts = 0
): Promise<ExecutionResult> {
  const { sessionId } = plan;

  logger.info(`[${sessionId}] Executing plan ${plan.id} (${plan.steps.length} steps):\n${prettyJson({
    id: plan.id,
    reasoning: plan.reasoning,
    steps: plan.steps.map(s => ({ id: s.id, tool: s.tool, params: s.parameters, expected: s.expectedOutcome })),
  })}`);

  plan.status = 'executing';
  activePlans.set(sessionId, plan);

  // Send reasoning to user
  if (plan.reasoning) {
    await sendProgress(sessionId, plan.reasoning);
  }

  // ── Step loop ────────────────────────────────────────────────────────────
  for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
    // Check cancellation (status may be mutated externally by cancelPlan)
    if ((plan.status as string) === 'cancelled' || !activePlans.has(sessionId)) {
      logger.info(`[${sessionId}] Plan cancelled, stopping execution`);
      return {
        success: false,
        plan,
        summary: 'Plan cancelled by user',
        error: 'Interrupted by new request',
      };
    }

    const step = plan.steps[i];
    plan.currentStepIndex = i;

    logger.info(
      `[${sessionId}] Step ${i + 1}/${plan.steps.length}: ${step.id} (${step.tool})`
    );

    // Condition check
    if (!evaluateCondition(step.condition, plan)) {
      logger.info(`[${sessionId}] Step ${step.id} condition not met, skipping`);
      step.status = 'skipped';
      plan.updatedAt = new Date();
      continue;
    }

    // Execute
    step.status = 'running';
    plan.updatedAt = new Date();

    const result = await executeStep(step, plan, bot, sessionId);

    // Post-execution cancellation check
    if ((plan.status as string) === 'cancelled') {
      return {
        success: false,
        plan,
        summary: 'Plan cancelled during execution',
        error: 'Interrupted by new request',
      };
    }

    // Save result on step
    step.result = {
      success: result.success,
      data: result.data,
      stateSnapshot: result.stateSnapshot,
      error: result.error,
    };

    logger.info(`[${sessionId}] Step ${step.id} (${step.tool}) → ${result.success ? 'OK' : 'FAILED'}: ${result.data?.message || result.error || ''}`);

    if (!result.success) {
      // Cancellation-related failure
      if (
        result.error?.includes('cancelled') ||
        result.error?.includes('interrupted')
      ) {
        return {
          success: false,
          plan,
          summary: 'Plan cancelled by user',
          error: result.error,
        };
      }

      // Step failed -- try re-planning
      step.status = 'failed';
      step.error = result.error;
      plan.updatedAt = new Date();

      return await handleFailure(plan, step, bot, llm, replanAttempts);
    }

    // Step succeeded
    step.status = 'completed';
    plan.updatedAt = new Date();
  }

  // ── All steps completed ──────────────────────────────────────────────────
  logger.info(`[${sessionId}] Plan ${plan.id} completed successfully`);
  plan.status = 'completed';
  activePlans.delete(sessionId);

  const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
  return {
    success: true,
    plan,
    summary: `Completed ${completedCount} steps successfully.`,
  };
}

// ─── Failure Handling & Smart Re-planning ─────────────────────────────────────

async function handleFailure(
  plan: Plan,
  failedStep: PlanStep,
  bot: MinecraftBot,
  llm: LLMProvider,
  replanAttempts: number
): Promise<ExecutionResult> {
  const { sessionId } = plan;
  const errorMsg = failedStep.error || 'Unknown error';

  // 1. Check if we've exhausted retries
  if (replanAttempts >= MAX_REPLAN_ATTEMPTS) {
    logger.error(`[${sessionId}] Max re-plan attempts (${MAX_REPLAN_ATTEMPTS}) reached`);
    plan.status = 'failed';
    activePlans.delete(sessionId);
    return {
      success: false,
      plan,
      summary: `Failed after ${MAX_REPLAN_ATTEMPTS} attempts. Last error: ${errorMsg}`,
      error: errorMsg,
    };
  }

  // 2. Check if failure is terminal (not worth re-planning)
  if (!isActionableFailure(errorMsg)) {
    logger.info(`[${sessionId}] Terminal failure, skipping re-plan: ${errorMsg}`);
    plan.status = 'failed';
    activePlans.delete(sessionId);
    return {
      success: false,
      plan,
      summary: `Plan failed (terminal): ${errorMsg}`,
      error: errorMsg,
    };
  }

  // 3. Re-plan
  logger.info(
    `[${sessionId}] Re-planning (attempt ${replanAttempts + 1}/${MAX_REPLAN_ATTEMPTS})...`
  );
  await sendProgress(sessionId, "That didn't work as expected. Let me try a different approach...");

  let newPlan: Plan;
  try {
    const currentState = captureState(bot);
    newPlan = await createPlan(
      {
        userRequest: plan.userRequest,
        currentState,
        failureContext: {
          lastFailedStep: failedStep,
          failureReason: errorMsg,
          previousPlan: plan,
        },
      },
      bot,
      llm,
      sessionId
    );
  } catch (err) {
    logger.error(`[${sessionId}] Re-planning failed: ${(err as Error).message}`);
    plan.status = 'failed';
    activePlans.delete(sessionId);
    return {
      success: false,
      plan,
      summary: `Re-planning failed: ${(err as Error).message}`,
      error: (err as Error).message,
    };
  }

  // 4. Dedup check: if the new plan's first step is identical to the failed step,
  //    it would just fail again -- skip it.
  if (newPlan.steps.length > 0) {
    const firstNew = newPlan.steps[0];
    if (
      firstNew.tool === failedStep.tool &&
      JSON.stringify(firstNew.parameters) === JSON.stringify(failedStep.parameters)
    ) {
      logger.warn(
        `[${sessionId}] New plan's first step is identical to the failed step (${failedStep.tool}). ` +
          `Aborting re-plan to avoid infinite loop.`
      );
      plan.status = 'failed';
      activePlans.delete(sessionId);
      return {
        success: false,
        plan,
        summary: `Re-plan produced same steps -- giving up. Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  logger.info(`[${sessionId}] New plan created, resuming execution...`);
  return await executePlan(newPlan, bot, llm, replanAttempts + 1);
}

// ─── Progress Updates ─────────────────────────────────────────────────────────

let progressCallback:
  | ((sessionId: string, message: string) => Promise<void>)
  | null = null;

export function setProgressCallback(
  cb: (sessionId: string, message: string) => Promise<void>
): void {
  progressCallback = cb;
}

async function sendProgress(sessionId: string, message: string): Promise<void> {
  logger.info(`[${sessionId}] Progress: ${message}`);
  if (progressCallback) {
    try {
      await progressCallback(sessionId, message);
    } catch {
      // Don't let progress callback failures disrupt execution
    }
  }
}
