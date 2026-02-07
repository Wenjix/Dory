/**
 * Memory Module Types
 *
 * Type definitions for the memory system.
 * Adapted from readyplayerx — simplified for hackathon:
 *   - No vector embeddings / semantic search
 *   - No memory associations
 *   - No weekly summaries (session, daily, user_profile only)
 */

import { ObjectId } from 'mongodb';

// ---------------------------------------------------------------------------
// Enums / Literals
// ---------------------------------------------------------------------------

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';
export type SummaryType = 'session' | 'daily' | 'user_profile';
export type MemorySource = 'conversation' | 'observation' | 'event' | 'user_input';

// ---------------------------------------------------------------------------
// Base Memory
// ---------------------------------------------------------------------------

export interface BaseMemory {
  _id?: ObjectId;
  sessionId: string;
  userId: string;
  type: MemoryType;
  timestamp: Date;
  lastAccessed: Date;
  importance: number; // 0-1
  tags: string[];
  textContent: string; // Human-readable representation
  source: MemorySource;
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Episodic Memory — "What happened"
// ---------------------------------------------------------------------------

export interface EpisodicMemory extends BaseMemory {
  type: 'episodic';
  data: {
    event: string; // e.g. "house_built", "near_death", "goal_achieved"
    description: string;
    location?: { x: number; y: number; z: number };
    participants?: string[];
    outcome: 'success' | 'failure' | 'partial' | 'neutral';
    emotionalWeight: number; // 0-1
  };
}

// ---------------------------------------------------------------------------
// Semantic Memory — "What we know"
// ---------------------------------------------------------------------------

export interface SemanticMemory extends BaseMemory {
  type: 'semantic';
  data: {
    category:
      | 'user_preference'
      | 'location'
      | 'goal'
      | 'knowledge'
      | 'personality';
    key: string; // e.g. "building_style", "favorite_resource"
    value: any;
    confidence: number; // 0-1
    lastUpdated: Date;
  };
}

// ---------------------------------------------------------------------------
// Procedural Memory — "How we do things"
// ---------------------------------------------------------------------------

export interface ProceduralMemory extends BaseMemory {
  type: 'procedural';
  data: {
    pattern: string;
    context: string;
    frequency: number;
    successRate: number; // 0-1
    lastUsed: Date;
  };
}

// ---------------------------------------------------------------------------
// Working Memory — "Current state"
// ---------------------------------------------------------------------------

export interface WorkingMemory extends BaseMemory {
  type: 'working';
  data: {
    activeGoal?: {
      description: string;
      startedAt: Date;
      progress: number;
    };
    currentTask?: {
      name: string;
      startedAt: Date;
      parameters: Record<string, any>;
    };
    recentTopics: string[];
  };
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type Memory = EpisodicMemory | SemanticMemory | ProceduralMemory | WorkingMemory;

// ---------------------------------------------------------------------------
// Memory Summary — Aggregated view (LLM-generated)
// ---------------------------------------------------------------------------

export interface MemorySummary {
  _id?: ObjectId;
  userId: string;
  summaryType: SummaryType;
  period: {
    start: Date;
    end: Date;
    sessionId?: string; // For session summaries
  };
  content: {
    /** LLM-generated narrative */
    narrative?: string;

    keyEvents: Array<{
      description: string;
      timestamp: Date;
      importance: number;
    }>;

    achievements: Array<{
      description: string;
      timestamp: Date;
      category: string;
    }>;

    learned: Array<{
      key: string;
      value: any;
      confidence: number;
      source: string;
    }>;

    statistics: {
      tasksCompleted: number;
      tasksFailed: number;
      resourcesCollected: Record<string, number>;
      structuresBuilt: number;
      deaths: number;
      sessionsPlayed?: number;
    };

    /** User-profile specific */
    preferences?: Record<string, any>;
    personality?: {
      traits: string[];
      communicationStyle?: string;
      playStyle?: string;
    };
    goals?: Array<{
      description: string;
      status: 'active' | 'completed' | 'abandoned';
      startedAt: Date;
      completedAt?: Date;
    }>;
  };

  textContent: string; // Human-readable summary
  sourceMemoryIds: ObjectId[]; // Which memories contributed to this summary
  sourceMemoryCount: number;
  previousSummaryId?: ObjectId;
  createdAt: Date;
  lastUpdated: Date;
  version: number;
}

// ---------------------------------------------------------------------------
// Conversation Context (sent from Voice Agent via HTTP)
// ---------------------------------------------------------------------------

export interface ConversationContextPayload {
  sessionId: string;
  userId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  detectedTopics?: string[];
  metadata?: {
    sessionDuration?: number;
    messageCount?: number;
    source: 'voice' | 'text';
  };
}

export interface MemoryProcessingResult {
  memoriesCreated: number;
  preferencesExtracted: string[];
  summaryUpdated: boolean;
  errors?: string[];
}
