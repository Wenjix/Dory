/**
 * Reasoning Agent
 *
 * Creates structured plans from user requests using our LLM provider.
 * Adapted from readyplayerx, using Dory AI's provider-agnostic LLM client.
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger, prettyJson } from '@dory/shared';
import type { LLMProvider } from '../llm/types';
import type { Plan, ReasoningRequest, ReasoningResponse } from './types';
import { captureState, formatStateForLLM } from './state-manager';
import { buildPlanningPrompt } from './prompts';
import { MinecraftBot } from '../bot/minecraft-bot';

const logger = createLogger('ReasoningAgent');

/**
 * Create a plan from a user request.
 *
 * @param request - The reasoning request (user message + optional failure context)
 * @param bot - The MinecraftBot instance (for state capture)
 * @param llm - The LLM provider to use
 * @param sessionId - Session identifier
 */
export async function createPlan(
  request: ReasoningRequest,
  bot: MinecraftBot,
  llm: LLMProvider,
  sessionId: string
): Promise<Plan> {
  logger.info(`[${sessionId}] Creating plan for: "${request.userRequest}"`);

  // Capture current game state
  let stateContext = 'No current state available.';
  try {
    const state = request.currentState ?? captureState(bot);
    stateContext = formatStateForLLM(state);
  } catch (err) {
    logger.warn(`[${sessionId}] Failed to capture state: ${(err as Error).message}`);
  }

  // Build failure context if re-planning
  let failureContext: Parameters<typeof buildPlanningPrompt>[1] | undefined;
  if (request.failureContext) {
    failureContext = {
      failedStepId: request.failureContext.lastFailedStep.id,
      failedTool: request.failureContext.lastFailedStep.tool,
      failureReason: request.failureContext.failureReason,
      previousPlanReasoning: request.failureContext.previousPlan.reasoning || '',
    };
  }

  // Build the full planning system prompt
  const systemPrompt = buildPlanningPrompt(stateContext, failureContext);

  // User message
  const userMessage = `User request: "${request.userRequest}"

Create a plan to fulfill this request. Output ONLY the JSON plan, no additional text.`;

  try {
    logger.info(`[${sessionId}] Calling LLM (${llm.name}/${llm.model}) for plan...`);

    const response = await llm.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2, // Low temperature for structured output
      max_tokens: 2048,
    });

    const text = response.message.content || '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in LLM response: ${text.substring(0, 200)}`);
    }

    const planData: ReasoningResponse = JSON.parse(jsonMatch[0]);

    // Validate
    if (!planData.steps || planData.steps.length === 0) {
      throw new Error('LLM returned a plan with no steps');
    }

    validateReasoningMatchesPlan(planData, sessionId);

    logger.info(`[${sessionId}] Plan created (${planData.steps.length} steps):\n${prettyJson(planData)}`);

    // Convert to Plan format
    const plan: Plan = {
      id: uuidv4(),
      sessionId,
      userRequest: request.userRequest,
      steps: planData.steps.map((step, index) => ({
        id: `step_${index}`,
        order: step.order ?? index,
        tool: step.tool,
        parameters: step.parameters || {},
        expectedOutcome: step.expectedOutcome,
        condition: step.condition || { type: 'always' as const, check: '' },
        status: 'pending' as const,
      })),
      status: 'pending',
      currentStepIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      reasoning: planData.reasoning,
    };

    logger.info(
      `[${sessionId}] Plan structure: ${plan.steps.map((s) => `${s.id}:${s.tool}`).join(' → ')}`
    );

    return plan;
  } catch (error) {
    logger.error(`[${sessionId}] Error creating plan: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Validate that the reasoning is consistent with the plan steps.
 * Logs warnings but does not throw (non-blocking).
 */
function validateReasoningMatchesPlan(
  planData: ReasoningResponse,
  sessionId: string
): void {
  const reasoning = (planData.reasoning || '').toLowerCase();
  const steps = planData.steps || [];

  // Check for skip/avoid keywords that might contradict having steps
  const skipKeywords = ['skip', "don't", "won't", 'not doing', 'already has'];
  const hasSkipKeyword = skipKeywords.some((kw) => reasoning.includes(kw));

  if (hasSkipKeyword && steps.length > 0) {
    logger.warn(
      `[${sessionId}] Reasoning contains skip/avoid keywords but plan has ${steps.length} steps. ` +
        `Reasoning: "${planData.reasoning}". Check consistency!`
    );
  }
}
