/**
 * Text Extractor
 *
 * Produces human-readable textContent for each memory type.
 * Used for display and (potentially) future embedding generation.
 */

import type { Memory, MemorySummary } from './types.js';

/**
 * Extract text content from a memory
 */
export function extractTextFromMemory(memory: Memory): string {
  const parts: string[] = [];

  switch (memory.type) {
    case 'episodic': {
      parts.push(memory.data.description);
      if (memory.data.event) parts.push(`Event: ${memory.data.event}`);
      if (memory.data.location) {
        parts.push(
          `Location: (${memory.data.location.x}, ${memory.data.location.y}, ${memory.data.location.z})`
        );
      }
      if (memory.data.outcome) parts.push(`Outcome: ${memory.data.outcome}`);
      if (memory.tags.length > 0) parts.push(`Tags: ${memory.tags.join(', ')}`);
      break;
    }

    case 'semantic': {
      parts.push(`Category: ${memory.data.category}`);
      parts.push(`Key: ${memory.data.key}`);
      const val = memory.data.value;
      parts.push(`Value: ${typeof val === 'string' ? val : JSON.stringify(val)}`);
      if (memory.tags.length > 0) parts.push(`Tags: ${memory.tags.join(', ')}`);
      break;
    }

    case 'procedural': {
      parts.push(`Pattern: ${memory.data.pattern}`);
      parts.push(`Context: ${memory.data.context}`);
      if (memory.tags.length > 0) parts.push(`Tags: ${memory.tags.join(', ')}`);
      break;
    }

    case 'working': {
      if (memory.data.activeGoal)
        parts.push(`Active goal: ${memory.data.activeGoal.description}`);
      if (memory.data.currentTask)
        parts.push(`Current task: ${memory.data.currentTask.name}`);
      if (memory.data.recentTopics.length > 0)
        parts.push(`Recent topics: ${memory.data.recentTopics.join(', ')}`);
      break;
    }
  }

  return parts.join('. ');
}

/**
 * Extract text content from a summary
 */
export function extractTextFromSummary(summary: MemorySummary): string {
  const parts: string[] = [];

  if (summary.content.keyEvents.length > 0) {
    parts.push(
      `Key events: ${summary.content.keyEvents.map((e) => e.description).join(', ')}`
    );
  }

  if (summary.content.achievements.length > 0) {
    parts.push(
      `Achievements: ${summary.content.achievements.map((a) => a.description).join(', ')}`
    );
  }

  if (summary.content.learned.length > 0) {
    parts.push(
      `Learned: ${summary.content.learned
        .map((l) => `${l.key}: ${typeof l.value === 'string' ? l.value : JSON.stringify(l.value)}`)
        .join(', ')}`
    );
  }

  const stats = summary.content.statistics;
  const totalResources = Object.values(stats.resourcesCollected).reduce(
    (a, b) => a + b,
    0
  );
  parts.push(
    `Completed ${stats.tasksCompleted} tasks, collected ${totalResources} resources, built ${stats.structuresBuilt} structures`
  );

  if (summary.summaryType === 'user_profile') {
    if (summary.content.preferences) {
      parts.push(`Preferences: ${JSON.stringify(summary.content.preferences)}`);
    }
    if (summary.content.goals) {
      parts.push(
        `Goals: ${summary.content.goals.map((g) => `${g.description} (${g.status})`).join(', ')}`
      );
    }
  }

  return parts.join('. ');
}
