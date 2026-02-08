/**
 * Planning System Types
 *
 * Data structures for the planning and execution system.
 * Adapted from readyplayerx, simplified for Dory AI.
 */

// ─── Plan ─────────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  sessionId: string;
  userRequest: string;
  steps: PlanStep[];
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  createdAt: Date;
  updatedAt: Date;
  /** Brief explanation of the plan (shown to user) */
  reasoning?: string;
}

export interface PlanStep {
  /** e.g. "step_0", "step_1" */
  id: string;
  /** Execution order (0, 1, 2, ...) */
  order: number;
  /** Tool name from our registry (e.g. "collect_resource", "craft_item") */
  tool: string;
  /** Tool parameters - can contain $step_N and $state references */
  parameters: Record<string, any>;
  /** What we expect to happen (for validation / re-planning context) */
  expectedOutcome?: string;
  /** When to execute this step */
  condition?: StepCondition;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: StepResult;
  error?: string;
}

export interface StepCondition {
  type: 'if' | 'if_not' | 'always';
  /** e.g. "$step_0.result.success" */
  check: string;
}

export interface StepResult {
  success: boolean;
  data?: any;
  stateSnapshot?: StateSnapshot;
  /** If outcome differed from expectedOutcome */
  deviation?: string;
  error?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface StateSnapshot {
  timestamp: Date;
  bot: {
    position: { x: number; y: number; z: number };
    inventory: InventoryItem[];
    health: number;
    food: number;
    isFollowing: boolean;
  };
  player: {
    position?: { x: number; y: number; z: number };
    visible: boolean;
    username?: string;
  };
  nearbyBlocks?: string[];
}

export interface InventoryItem {
  name: string;
  count: number;
}

// ─── Reasoning (LLM plan creation) ───────────────────────────────────────────

export interface ReasoningRequest {
  userRequest: string;
  currentState?: StateSnapshot;
  /** Provided when re-planning after a failure */
  failureContext?: {
    lastFailedStep: PlanStep;
    failureReason: string;
    /** The plan that failed */
    previousPlan: Plan;
  };
}

/** The JSON shape the LLM returns */
export interface ReasoningResponse {
  reasoning: string;
  steps: Array<{
    order: number;
    tool: string;
    parameters: Record<string, any>;
    expectedOutcome?: string;
    condition?: StepCondition;
  }>;
}

// ─── Execution ────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  plan: Plan;
  /** Human-readable summary of what happened */
  summary: string;
  error?: string;
}
