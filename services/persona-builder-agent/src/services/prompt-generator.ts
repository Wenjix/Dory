/**
 * Prompt Generator Service
 *
 * Uses LLM to generate specialized prompts from persona data:
 * - Conversational prompt: For voice agents (personality, tone, responses)
 * - Gaming prompt: For gaming agents (playstyle, behavior in-game)
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

// Example voice agent prompt format (from voice-agent/src/agent/prompt.ts)
const VOICE_PROMPT_EXAMPLE = `# Personality
Your name is Dory. You are a gentle, optimistic, and slightly forgetful gaming companion. You have a bubbly heart, are patient, and never rush the player. You are their supportive friend.

# Response Rules
CRITICAL FORMATTING RULES:
- NEVER prefix your responses with "You:" or any label
- NEVER use action notations like *flaps tail*, *smiles*, (waves), etc.
- Keep responses SHORT - 1-2 sentences max for casual chat
- Speak naturally as if talking, not narrating
- Just say what you want to say directly

# Tone
- Gentle and patient
- Brief and concise - don't ramble
- Warm but not overly wordy
- One thought at a time

# Tools

You have access to function tools. Call them directly - DO NOT write out tool calls as text.

## listAgents Tool
Call this FIRST when conversation starts to discover available agents and their capabilities.

## sendMessage Tool
Send natural language messages to external agents (like the Minecraft gaming agent).
Parameters:
- agentId: The agent ID (discovered via listAgents)
- message: Natural language describing what you want done

# Workflow

1. Call listAgents first to discover agents and capabilities
2. When player asks for something, identify which agent helps
3. Craft a message based on agent's skill descriptions
4. Call sendMessage with agentId and your message
5. Tell the player the result briefly

# Game Events

Sometimes you'll receive [GAME UPDATE] context with your messages. These are important events from the Minecraft game that you should briefly acknowledge to the user.
Keep acknowledgments very brief (one short sentence) and natural.

# Examples (DO NOT include the labels, just the text)

Greeting:
Hi! I'm Dory. Want to go on an adventure together?

After a task is done:
Nice work! What's next?

# Handling Responses

When sendMessage responds:
- Tell user the result in 1-2 sentences
- If it failed, explain briefly and ask what else they'd like to do
- NEVER auto-retry failed actions

# Errors

Connection fail: The game isn't available right now. Want to try something else?
Tool error: Oops, something went sideways. Want to try again or do something else?`;

/**
 * Generate a conversational prompt for the voice agent
 * This prompt defines personality, tone, and how to interact with the player
 */
export async function generateConversationalPrompt(persona: PersonaData): Promise<string> {
  console.log(`[PromptGenerator] Generating conversational prompt for: ${persona.identity.name}`);
  const startTime = Date.now();

  const personaJson = JSON.stringify({
    identity: persona.identity,
    personality: persona.personality,
    communication: persona.communication,
    voice: persona.voice,
    examples: persona.examples,
  }, null, 2);

  try {
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'),
      system: `You are an expert prompt engineer. Generate voice agent personality prompts.
Output ONLY the prompt text, no explanations or markdown code blocks.`,
      prompt: `Generate a voice agent personality prompt based on this persona data.
Follow this exact format and structure:

--- EXAMPLE FORMAT ---
${VOICE_PROMPT_EXAMPLE}
--- END EXAMPLE ---

Now generate a prompt for this persona. Replace all personality details, tone, examples with data from the persona.
Keep the same structure (# Personality, # Response Rules, # Tone, # Tools, # Workflow, # Game Events, # Examples, # Handling Responses, # Errors).

Persona Data:
${personaJson}

Generate the prompt now:`,
      maxTokens: 2000,
      temperature: 0.7,
    });

    const duration = Date.now() - startTime;
    console.log(`[PromptGenerator] Conversational prompt generated in ${duration}ms`);

    return result.text.trim();
  } catch (error) {
    console.error('[PromptGenerator] Failed to generate conversational prompt:', error);
    throw new Error('Failed to generate conversational prompt');
  }
}

/**
 * Generate a gaming prompt for gaming agents (Minecraft, etc.)
 * This prompt defines in-game behavior, playstyle, and reactions
 */
export async function generateGamingPrompt(persona: PersonaData): Promise<string> {
  console.log(`[PromptGenerator] Generating gaming prompt for: ${persona.identity.name}`);
  const startTime = Date.now();

  const personaJson = JSON.stringify({
    identity: persona.identity,
    personality: persona.personality,
    gaming: persona.gaming,
    examples: persona.examples,
  }, null, 2);

  try {
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'),
      system: `You are an expert prompt engineer. Generate gaming AI behavior prompts.
Output ONLY the prompt text, no explanations or markdown code blocks.`,
      prompt: `Generate a gaming behavior prompt for a Minecraft companion AI based on this persona data.

The prompt should define:
- Character identity and role in the game
- Playstyle preferences (explorer, builder, fighter, etc.)
- Risk tolerance and decision making
- How they react to success and failure
- Teamwork style with the player
- Skills and what activities they prefer
- How they communicate about game events

Format with clear sections using # headers.
Keep it focused on IN-GAME behavior, not conversation style.

Persona Data:
${personaJson}

Generate the gaming prompt now:`,
      maxTokens: 1500,
      temperature: 0.7,
    });

    const duration = Date.now() - startTime;
    console.log(`[PromptGenerator] Gaming prompt generated in ${duration}ms`);

    return result.text.trim();
  } catch (error) {
    console.error('[PromptGenerator] Failed to generate gaming prompt:', error);
    throw new Error('Failed to generate gaming prompt');
  }
}

/**
 * Generate both prompts in parallel
 */
export async function generateBothPrompts(persona: PersonaData): Promise<{
  conversationalPrompt: string;
  gamingPrompt: string;
}> {
  console.log(`[PromptGenerator] Generating both prompts for: ${persona.identity.name}`);
  const startTime = Date.now();

  const [conversationalPrompt, gamingPrompt] = await Promise.all([
    generateConversationalPrompt(persona),
    generateGamingPrompt(persona),
  ]);

  const duration = Date.now() - startTime;
  console.log(`[PromptGenerator] Both prompts generated in ${duration}ms`);

  return { conversationalPrompt, gamingPrompt };
}

// =============================================================================
// SHORT DESCRIPTIONS FOR FRONTEND
// =============================================================================

/**
 * Generate a short personality description for the frontend
 * Called after personality phase completes (archetype, traits set)
 *
 * @returns Short description like "A wise mentor who values patience and knowledge..."
 */
export async function generatePersonalityDescription(persona: Partial<PersonaData>): Promise<string> {
  const name = persona.identity?.name || 'This character';
  const archetype = persona.personality?.archetype;
  const traits = persona.personality?.traits || [];
  const species = persona.identity?.species;

  // If we don't have enough data, return empty
  if (!archetype && traits.length === 0) {
    return '';
  }

  console.log(`[PromptGenerator] Generating personality description for: ${name}`);

  try {
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'),
      system: 'Generate a single short sentence describing a character personality. Be creative and evocative. Output only the sentence, nothing else.',
      prompt: `Character: ${name}${species ? ` (${species})` : ''}
Archetype: ${archetype || 'unique'}
Traits: ${traits.join(', ') || 'diverse'}

Write one short evocative sentence describing their personality (max 15 words):`,
      maxTokens: 50,
      temperature: 0.8,
    });

    const description = result.text.trim().replace(/^["']|["']$/g, '');
    console.log(`[PromptGenerator] Personality description: ${description}`);
    return description;
  } catch (error) {
    console.error('[PromptGenerator] Failed to generate personality description:', error);
    // Fallback to simple description
    return `A ${archetype || 'unique'} character with ${traits[0] || 'special'} traits`;
  }
}

/**
 * Generate a short gaming description for the frontend
 * Called after gaming phase completes (playstyle, riskTolerance set)
 *
 * @returns Short description like "An explorer who takes calculated risks..."
 */
export async function generateGamingDescription(persona: Partial<PersonaData>): Promise<string> {
  const name = persona.identity?.name || 'This character';
  const playstyle = persona.gaming?.playstyle;
  const riskTolerance = persona.gaming?.riskTolerance;
  const skills = persona.gaming?.skills || [];

  // If we don't have enough data, return empty
  if (!playstyle && !riskTolerance) {
    return '';
  }

  console.log(`[PromptGenerator] Generating gaming description for: ${name}`);

  try {
    const result = await generateText({
      model: getGroqClient()('llama-3.1-8b-instant'),
      system: 'Generate a single short sentence describing a gaming playstyle. Be dynamic and engaging. Output only the sentence, nothing else.',
      prompt: `Character: ${name}
Playstyle: ${playstyle || 'adaptive'}
Risk tolerance: ${riskTolerance || 'balanced'}
Skills: ${skills.join(', ') || 'various'}

Write one short engaging sentence about how they play games (max 15 words):`,
      maxTokens: 50,
      temperature: 0.8,
    });

    const description = result.text.trim().replace(/^["']|["']$/g, '');
    console.log(`[PromptGenerator] Gaming description: ${description}`);
    return description;
  } catch (error) {
    console.error('[PromptGenerator] Failed to generate gaming description:', error);
    // Fallback to simple description
    return `A ${playstyle || 'versatile'} player with ${riskTolerance || 'balanced'} risk approach`;
  }
}
