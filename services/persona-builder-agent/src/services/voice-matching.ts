/**
 * Voice Matching Service
 *
 * Matches personas to ElevenLabs voices using LLM-based selection.
 * Fetches available voices from ElevenLabs API and uses Groq to select
 * the best match based on persona traits.
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getConfig } from '../config/index.js';
import type { PersonaData } from '../types/persona.js';

// Lazy-initialized Groq client
let groqClient: ReturnType<typeof createOpenAI> | null = null;

function getGroqClient() {
  if (!groqClient) {
    const config = getConfig();
    groqClient = createOpenAI({
      apiKey: config.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqClient;
}

/**
 * ElevenLabs voice from API response
 */
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: {
    gender?: string;
    age?: string;
    accent?: string;
    use_case?: string;
    description?: string;
  };
  description?: string;
  preview_url?: string;
}

/**
 * Cached voice list with TTL
 */
interface VoiceCache {
  voices: ElevenLabsVoice[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let voiceCache: VoiceCache | null = null;

/**
 * Fetch available voices from ElevenLabs API
 * Uses in-memory cache with 5-minute TTL to avoid redundant API calls
 */
export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  // Check cache first
  if (voiceCache) {
    const age = Date.now() - voiceCache.timestamp;
    if (age < CACHE_TTL_MS) {
      console.log(`[VoiceMatching] Using cached voice list (${Math.round(age / 1000)}s old)`);
      return voiceCache.voices;
    }
  }

  const config = getConfig();
  const apiKey = config.ELEVEN_API_KEY;

  if (!apiKey) {
    console.warn('[VoiceMatching] ⚠️ ELEVEN_API_KEY not set in environment, skipping voice matching');
    console.warn('[VoiceMatching] To enable voice matching, add ELEVEN_API_KEY to your .env file');
    return [];
  }

  try {
    console.log('[VoiceMatching] Fetching voices from ElevenLabs API...');
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { voices: ElevenLabsVoice[] };
    const voices = data.voices || [];

    // Update cache
    voiceCache = {
      voices,
      timestamp: Date.now(),
    };

    console.log(`[VoiceMatching] ✅ Fetched ${voices.length} voices from ElevenLabs`);
    return voices;
  } catch (error) {
    console.error('[VoiceMatching] Failed to fetch voices:', error);
    // Return empty array on error (non-blocking)
    return [];
  }
}

/**
 * Build a compact representation of voices for LLM matching
 */
function buildVoiceCatalog(voices: ElevenLabsVoice[]): string {
  return voices
    .map((v) => {
      const labels = v.labels || {};
      const parts: string[] = [
        `ID: ${v.voice_id}`,
        `Name: ${v.name}`,
      ];
      if (labels.gender) parts.push(`Gender: ${labels.gender}`);
      if (labels.age) parts.push(`Age: ${labels.age}`);
      if (labels.accent) parts.push(`Accent: ${labels.accent}`);
      if (labels.use_case) parts.push(`Use case: ${labels.use_case}`);
      if (v.description) parts.push(`Description: ${v.description}`);
      return parts.join(', ');
    })
    .join('\n');
}

/**
 * Match a persona to the best ElevenLabs voice using LLM
 * Returns the selected voice ID and name, or null if matching fails
 */
export async function matchVoiceToPersona(
  persona: PersonaData
): Promise<{ voiceId: string; voiceName: string } | null> {
  const config = getConfig();
  if (!config.ELEVEN_API_KEY) {
    console.warn('[VoiceMatching] ⚠️ ELEVEN_API_KEY not configured, skipping voice matching');
    console.warn('[VoiceMatching] To enable voice matching, add ELEVEN_API_KEY to your .env file');
    return null;
  }

  // Fetch available voices
  const voices = await fetchElevenLabsVoices();
  if (voices.length === 0) {
    console.warn('[VoiceMatching] ⚠️ No voices available from ElevenLabs API, skipping matching');
    console.warn('[VoiceMatching] This could mean: API key is invalid, API is down, or network issue');
    return null;
  }

  console.log(`[VoiceMatching] Found ${voices.length} voices to match against`);

  // Build persona summary for matching
  const personaSummary = {
    name: persona.identity.name,
    species: persona.identity.species,
    personality: {
      archetype: persona.personality.archetype,
      traits: persona.personality.traits.join(', '),
      emotionalTendency: persona.personality.emotionalTendency,
    },
    communication: {
      tone: persona.communication.tone,
      formality: persona.communication.formality,
    },
    voice: {
      accent: persona.voice.accent,
      energy: persona.voice.energy,
    },
  };

  const voiceCatalog = buildVoiceCatalog(voices);

  try {
    console.log(`[VoiceMatching] Matching voice for persona: ${persona.identity.name}`);
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'),
      system: `You are an expert at matching character personas to voice actors.
Analyze the persona traits and select the single best-matching voice from the catalog.
Return ONLY valid JSON with voice_id, voice_name, and a brief reason.`,
      prompt: `Persona to match:
${JSON.stringify(personaSummary, null, 2)}

Available voices:
${voiceCatalog}

Select the single best-matching voice. Consider:
- Species/character type (human, robot, animal, mythical creature)
- Personality traits (cheerful, serious, mysterious, etc.)
- Communication tone (warm, formal, playful, etc.)
- Voice energy level (calm, moderate, energetic)
- Accent preferences

Return JSON in this exact format:
{
  "voice_id": "abc123...",
  "voice_name": "Voice Name",
  "reason": "Brief explanation of why this voice matches"
}`,
      maxTokens: 500,
      temperature: 0.7,
    });

    // Parse LLM response
    const text = result.text.trim();
    // Remove markdown code blocks if present
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const match = JSON.parse(jsonText) as { voice_id: string; voice_name: string; reason?: string };

    if (!match.voice_id || !match.voice_name) {
      console.error('[VoiceMatching] ❌ Invalid match response from LLM:', match);
      console.error('[VoiceMatching] Expected: { voice_id: string, voice_name: string }');
      return null;
    }

    // Verify the voice_id exists in our catalog
    const selectedVoice = voices.find((v) => v.voice_id === match.voice_id);
    if (!selectedVoice) {
      console.warn(`[VoiceMatching] ⚠️ Selected voice_id "${match.voice_id}" not found in catalog`);
      console.warn(`[VoiceMatching] LLM may have hallucinated a voice ID. Available IDs: ${voices.slice(0, 5).map(v => v.voice_id).join(', ')}...`);
      return null;
    }

    console.log(`[VoiceMatching] ✅ Matched to voice: ${match.voice_name} (${match.voice_id})`);
    if (match.reason) {
      console.log(`[VoiceMatching] Reason: ${match.reason}`);
    }

    return {
      voiceId: match.voice_id,
      voiceName: match.voice_name,
    };
  } catch (error) {
    console.error('[VoiceMatching] ❌ Failed to match voice:', error);
    if (error instanceof Error) {
      console.error('[VoiceMatching] Error message:', error.message);
      if (error.stack) {
        console.error('[VoiceMatching] Stack trace:', error.stack);
      }
    }
    // Check if it's a JSON parse error
    if (error instanceof SyntaxError) {
      console.error('[VoiceMatching] This appears to be a JSON parsing error - LLM may have returned invalid JSON');
    }
    return null;
  }
}
