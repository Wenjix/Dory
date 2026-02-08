/**
 * Persona Selection Parser
 *
 * Detects persona selection from user messages before sending to the LLM.
 * Supports selection by:
 * - Number index (1, 2, 3...)
 * - Name match (exact or partial)
 * - Description keyword match
 *
 * Used as a pre-LLM optimization to instantly detect persona selections
 * when personas are pending, avoiding an unnecessary LLM round-trip.
 */

import type { PersonaSummary } from '../services/session.js';

/**
 * Attempt to parse a persona selection from user input.
 * Returns the personaId if a match is found, null otherwise.
 *
 * @param userMessage - The user's raw message text
 * @param pendingPersonas - List of personas currently shown to the user
 * @returns The matched personaId or null
 */
export function parsePersonaSelection(
  userMessage: string,
  pendingPersonas: PersonaSummary[]
): string | null {
  if (!pendingPersonas || pendingPersonas.length === 0) {
    return null;
  }

  const message = userMessage.toLowerCase().trim();

  // Strategy 1: Numeric selection ("1", "2", "the first one", "number 3", "#2")
  const numberMatch = message.match(/(?:^|\b)#?(\d+)(?:\b|$)/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1], 10) - 1;
    if (index >= 0 && index < pendingPersonas.length) {
      return pendingPersonas[index].id;
    }
  }

  // Ordinal words
  const ordinals: Record<string, number> = {
    'first': 0, 'second': 1, 'third': 2, 'fourth': 3, 'fifth': 4,
    'sixth': 5, 'seventh': 6, 'eighth': 7, 'ninth': 8, 'tenth': 9,
    'last': pendingPersonas.length - 1,
  };
  for (const [word, index] of Object.entries(ordinals)) {
    if (message.includes(word) && index < pendingPersonas.length) {
      return pendingPersonas[index].id;
    }
  }

  // Strategy 2: Exact or partial name match
  for (const persona of pendingPersonas) {
    const personaName = persona.name.toLowerCase();
    if (message.includes(personaName)) {
      return persona.id;
    }
  }

  // Strategy 3: Description/tagline keyword match (need >=2 keyword hits)
  for (const persona of pendingPersonas) {
    const searchText = [
      persona.tagline || '',
      persona.description || '',
    ].join(' ').toLowerCase();

    // Extract meaningful words from user message (skip short words)
    const keywords = message.split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) continue;

    const matchCount = keywords.filter(kw => searchText.includes(kw)).length;
    if (matchCount >= 2) {
      return persona.id;
    }
  }

  return null;
}
