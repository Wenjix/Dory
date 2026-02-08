/**
 * Persona System Prompt Builder
 *
 * Builds dynamic system prompts by injecting persona personality into
 * the base voice agent prompt structure.
 *
 * Architecture:
 * - BASE_VOICE_AGENT_PROMPT: Technical/functional layer (tools, workflow, response rules)
 * - Persona data: Personality layer (identity, traits, communication style)
 * - The builder merges these to create a complete system prompt
 *
 * Used as a fallback when the pre-generated conversational prompt
 * from persona-builder-agent is not available.
 */

/**
 * Persona data shape as returned by /api/personas/public/:id
 * All fields are optional to handle partial data gracefully.
 */
export interface PersonaData {
  id: string;
  identity?: {
    name?: string;
    tagline?: string;
    backstory?: string;
    species?: string;
    ageImpression?: string;
  };
  description?: string;
  personality?: {
    archetype?: string;
    traits?: string[];
    emotionalTendency?: string;
    quirks?: string[];
    values?: string[];
    fears?: string[];
    catchphrases?: string[];
  };
  communication?: {
    tone?: string;
    responseLength?: string;
    formality?: string;
    humorStyle?: string;
    encouragementStyle?: string;
    vocabulary?: string;
  };
  gaming?: {
    playstyle?: string;
    skills?: string[];
    riskTolerance?: string;
    teamworkStyle?: string;
    winReaction?: string;
    loseReaction?: string;
  };
  voice?: {
    pitch?: number;
    speed?: number;
    accent?: string;
    energy?: string;
    elevenLabsVoiceId?: string;
  };
  visualIdentity?: {
    avatarUrl?: string | null;
    primary?: string;
    secondary?: string;
  };
  examples?: {
    greeting?: string;
    farewell?: string;
    celebration?: string;
    setback?: string;
  };
}

export interface PersonaPromptOptions {
  /** Custom base prompt (defaults to BASE_VOICE_AGENT_PROMPT) */
  basePrompt?: string;
  /** Include backstory section (default: true) */
  includeBackstory?: boolean;
  /** Emphasize personality traits (default: true) */
  emphasizeTraits?: boolean;
  /** Include gaming behavior (default: true) */
  includeGaming?: boolean;
}

/**
 * Base voice agent prompt — the technical/functional layer.
 * Contains Dory's full enhanced prompt EXCEPT the # Personality section.
 * When a persona is loaded, persona data provides the personality layer,
 * and this provides the functional layer (tools, workflow, game events, etc.).
 */
const BASE_VOICE_AGENT_PROMPT = `
# Response Rules
CRITICAL FORMATTING RULES:
- NEVER prefix your responses with "You:" or any label
- NEVER use action notations like *flaps tail*, *smiles*, (waves), etc.
- NEVER use emojis — they sound awkward when spoken aloud
- Keep responses SHORT - 1-2 sentences max for casual chat
- Speak naturally as if talking, not narrating
- Just say what you want to say directly

# Tone
- Brief and concise - don't ramble
- Warm but not overly wordy
- One thought at a time
- Enthusiastic about Minecraft and adventures
- NEVER say raw technical details aloud: no coordinates like "(100, 64, -50)", no port numbers like "25565", no session IDs, no IP addresses. Instead say things like "over there", "nearby", "back where we were". If you connected to a server, just say "I'm in!" not "Connected to localhost:25565".

# Conversation Style
- Greet the player warmly when they first speak
- Ask what they'd like to do in the game
- Be curious about their plans
- Offer help and suggestions when appropriate
- React naturally to what they tell you
- If you don't understand something, ask kindly

# Game Knowledge
- You know Minecraft well: blocks, mobs, biomes, crafting, building
- You can talk about strategies, help plan builds, discuss adventures
- You're excited to help with any task

# Game Actions (A2A)
You have tools to control a Minecraft bot through the game agent:

- **connectBot**: Connect a bot to a Minecraft server.
  Use when the player asks to join or connect. Defaults to localhost:25565 if no details given.
  A bot MUST be connected before any in-game actions can work.

- **disconnectBot**: Disconnect the bot from the server.
  Use when the player wants the bot to leave the game.

- **sendGameCommand**: Send a natural language command to perform in-game actions.
  CRITICAL: Pass the player's FULL request with ALL details — every quantity, material, height, direction, and condition they mentioned. Do NOT shorten or paraphrase.
  Use this whenever the player asks you to DO something in the game:
  - Moving: "follow me", "come here", "go to 100 64 -200", "stop"
  - Collecting: "collect 5 oak wood", "mine 10 stone", "get sand"
  - Crafting: "craft a crafting table", "make 4 wooden planks"
  - Building (simple): "build a 3-block tall pillar using cobblestone", "build a 5 long 3 high wall where I'm looking with stone bricks"
  - Building (AI generation): "build me a Japanese temple", "generate a medieval castle", "create a modern house with a pool"
    For complex structures, the game agent uses AI to design and build them block-by-block. This takes a moment to design, then you'll see it being built progressively.
  - Dropping: "drop all the cobblestone", "drop 5 oak logs"
  - Info: "what's in the inventory?", "where are you?", "what am I looking at?"

- **getGameStatus**: Check if the game agent is running and see active bots.
  Use when the player asks if the bot is connected or running.

- **getGameCapabilities**: List what the game agent can do.
  Use when the player asks what you can do or what actions are available.

## When to use tools
- If the player asks to join or connect → use connectBot
- If the player asks to leave or disconnect → use disconnectBot
- If the player asks you to DO something in Minecraft → use sendGameCommand
- If a sendGameCommand fails saying "no active bot session", suggest connecting first
- If they're just chatting or asking about Minecraft in general → just chat naturally
- After sending a command, briefly tell the player what happened based on the response
- If the game agent is not running, let the player know gently

## CRITICAL: Confirmations MUST trigger actions
When you ask the player a clarifying question (e.g. "Want me to use oak planks?") and they confirm with ANY affirmative response ("yeah", "yes", "sure", "do it", "go ahead", "yep", "ok", etc.), you MUST actually call the appropriate tool to execute the action. Do NOT just say you'll do it — call sendGameCommand with the full details. Saying "Got it, let me do that!" without calling a tool means NOTHING actually happens in the game. Always follow through with the tool call.

## Tool response handling
- Summarize the game agent's response in your own voice (don't read it verbatim)
- If a command fails, explain what went wrong simply
- Keep your response brief even after tool use

# Game Events
Sometimes you'll receive [GAME UPDATE] or [URGENT GAME ALERT] context with your messages. These are important events from the Minecraft game.

## How to handle game events:
- **[URGENT GAME ALERT]**: This is critical! React immediately with urgency (e.g. "Oh no, we just died!" or "Watch out, we're taking damage!"). Keep it to one brief, urgent sentence.
- **[IMPORTANT GAME UPDATE]**: You MUST mention these in your reply. Start by briefly acknowledging the event, THEN answer the player's question. For example if the update says "Task completed: collected 5 oak logs" and the player says "How's it going?", say something like "Great news — I just finished collecting 5 oak logs! Things are going well, what should we do next?"
- NEVER ignore game updates. If an [IMPORTANT GAME UPDATE] appears in the message, your response MUST reference it.
- If there are multiple events, mention the most important ones first.
- Keep acknowledgments brief and natural — one sentence per event is enough.

# AI Structure Generation
When the player asks you to build something complex (a house, castle, temple, statue, etc.), pass their FULL description to sendGameCommand. The game agent will use AI to design and build the structure.

IMPORTANT: Before sending the build command, ALWAYS give the player a heads-up that it takes some time. Say something like: "That sounds awesome! Give me about a minute — I need to design it first, then I'll start placing blocks. You'll see it appear in front of you!"

While building:
- The design phase takes 10-20 seconds (the AI is writing the code)
- Then blocks are placed progressively — the player will see them appearing
- The whole process takes about 30-60 seconds depending on complexity
- If the player wants to stop, say "stop building" and it will cancel
- After completion, you'll get an alert — react with excitement and ask if they like it!

# Errors
Connection issue: Hmm, something's not working right. Want to try again?
Don't understand: Could you say that again? I want to make sure I got it right.
`;

/**
 * Build a complete system prompt with persona personality injected
 * into the base voice agent prompt.
 *
 * Persona data provides the personality layer (identity, traits, style),
 * while BASE_VOICE_AGENT_PROMPT provides the functional layer (tools, workflow).
 */
export function buildPersonaSystemPrompt(
  persona: PersonaData,
  options: PersonaPromptOptions = {}
): string {
  const {
    basePrompt = BASE_VOICE_AGENT_PROMPT,
    includeBackstory = true,
    emphasizeTraits = true,
    includeGaming = true,
  } = options;

  const name = persona.identity?.name || 'Companion';
  const tagline = persona.identity?.tagline;
  const description = persona.description || '';
  const tone = persona.communication?.tone || 'friendly';
  const traits = persona.personality?.traits || [];

  const sections: string[] = [];

  // 1. Personality section (injected FIRST — personality layer)
  sections.push(`# Personality

You are **${name}**${tagline ? ` - ${tagline}` : ''}

${description}`);

  // 2. Backstory (if available)
  if (includeBackstory && persona.identity?.backstory) {
    sections.push(`
## Backstory
${persona.identity.backstory}

Remember this background when interacting with the user. Let it inform your
perspective and reactions.`);
  }

  // 3. Personality traits
  if (emphasizeTraits && traits.length > 0) {
    sections.push(`
## Personality Traits

You embody these core traits:
${traits.map(t => `- ${t}`).join('\n')}

Let these traits shine through in your responses and reactions.`);
  }

  // 4. Archetype / emotional tendency
  const archetype = persona.personality?.archetype;
  const emotionalTendency = persona.personality?.emotionalTendency;
  if (archetype || emotionalTendency) {
    const parts: string[] = [];
    if (archetype) parts.push(`**Archetype**: ${archetype}`);
    if (emotionalTendency) parts.push(`**Emotional Tendency**: ${emotionalTendency}`);
    sections.push(`\n## Character Core\n${parts.join('\n')}`);
  }

  // 5. Communication style
  sections.push(`
## Communication Style

**Tone**: ${tone}
${persona.communication?.formality ? `**Formality**: ${persona.communication.formality}` : ''}
${persona.communication?.humorStyle ? `**Humor**: ${persona.communication.humorStyle}` : ''}
${persona.communication?.vocabulary ? `**Vocabulary**: ${persona.communication.vocabulary}` : ''}

Maintain this communication style consistently throughout the conversation.`);

  // 6. Gaming behavior
  if (includeGaming && persona.gaming?.playstyle) {
    const gamingParts: string[] = [];
    gamingParts.push(`**Playstyle**: ${persona.gaming.playstyle}`);
    if (persona.gaming.riskTolerance) gamingParts.push(`**Risk Tolerance**: ${persona.gaming.riskTolerance}`);
    if (persona.gaming.teamworkStyle) gamingParts.push(`**Teamwork**: ${persona.gaming.teamworkStyle}`);
    if (persona.gaming.skills && persona.gaming.skills.length > 0) {
      gamingParts.push(`**Skills**: ${persona.gaming.skills.join(', ')}`);
    }

    sections.push(`\n## Gaming Behavior\n${gamingParts.join('\n')}`);
  }

  // 7. Example responses
  if (persona.examples?.greeting) {
    const examples: string[] = [];
    if (persona.examples.greeting) examples.push(`Greeting: ${persona.examples.greeting}`);
    if (persona.examples.celebration) examples.push(`Win: ${persona.examples.celebration}`);
    if (persona.examples.setback) examples.push(`Setback: ${persona.examples.setback}`);

    sections.push(`\n## Example Responses (speak like this)\n${examples.join('\n')}`);
  }

  // 8. Important reminders
  sections.push(`
## Important Reminders

- Stay in character as ${name} at all times
- React to game events through ${name}'s perspective
- Use ${tone} tone in all responses
- Let your personality traits guide your advice and commentary
- Be authentic to ${name}'s nature while being helpful`);

  // 9. Base voice agent prompt (technical/functional layer)
  sections.push(basePrompt);

  return sections.join('\n');
}

/**
 * Extract key persona attributes for quick reference.
 * Useful for logging, agent_ready messages, and session metadata.
 */
export function getPersonaSummary(persona: PersonaData): {
  name: string;
  tone: string;
  keyTraits: string[];
} {
  return {
    name: persona.identity?.name || 'Unknown',
    tone: persona.communication?.tone || 'friendly',
    keyTraits: (persona.personality?.traits || []).slice(0, 3),
  };
}
