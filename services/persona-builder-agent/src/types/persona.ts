/**
 * Persona Types
 *
 * Comprehensive type definitions for AI companion persona data.
 * Designed to capture all traits needed to generate voice agent prompts.
 * Kept separate to avoid circular dependencies.
 */

/**
 * Core identity and backstory
 */
export interface PersonaIdentity {
  /** Display name */
  name: string;
  /** Short tagline or title (e.g., "The Fearless Explorer") */
  tagline: string;
  /** Brief backstory/origin (1-2 sentences) */
  backstory: string;
  /** Species/type (e.g., "human", "robot", "dragon", "fairy") */
  species: string;
  /** Age impression (e.g., "young", "ancient", "ageless", "teenager") */
  ageImpression: string;
}

/**
 * Detailed personality configuration
 */
export interface PersonaPersonality {
  /** Core personality archetype (e.g., "mentor", "trickster", "hero", "sage") */
  archetype: string;
  /** 3-5 main personality traits (e.g., ["brave", "curious", "impatient"]) */
  traits: string[];
  /** Emotional tendencies (e.g., "optimistic", "melancholic", "stoic") */
  emotionalTendency: string;
  /** Unique quirks or habits (e.g., ["tells bad puns", "forgets names", "hums when thinking"]) */
  quirks: string[];
  /** Core values/motivations (e.g., ["loyalty", "adventure", "knowledge"]) */
  values: string[];
  /** What they fear or avoid (e.g., ["being alone", "failure", "spiders"]) */
  fears: string[];
  /** Signature catchphrases (e.g., ["Let's goooo!", "Hmm, interesting..."]) */
  catchphrases: string[];
}

/**
 * Communication and response style
 */
export interface PersonaCommunication {
  /** Overall tone (e.g., "warm", "sarcastic", "formal", "playful") */
  tone: string;
  /** Preferred response length ("brief", "moderate", "detailed") */
  responseLength: 'brief' | 'moderate' | 'detailed';
  /** Formality level ("casual", "balanced", "formal") */
  formality: 'casual' | 'balanced' | 'formal';
  /** Humor style (e.g., "witty", "slapstick", "dry", "none") */
  humorStyle: string;
  /** How they give encouragement (e.g., "cheerleader", "quiet supporter", "tough love") */
  encouragementStyle: string;
  /** How they handle mistakes/errors */
  errorHandling: string;
  /** Vocabulary style (e.g., "simple", "technical", "poetic", "slang") */
  vocabulary: string;
  /** Whether they use emotes/expressions in text */
  usesEmotes: boolean;
}

/**
 * Gaming behavior and preferences
 */
export interface PersonaGaming {
  /** Primary playstyle (e.g., "explorer", "builder", "fighter", "collector") */
  playstyle: string;
  /** Gaming skills/strengths (e.g., ["navigation", "combat", "resource management"]) */
  skills: string[];
  /** Game preferences (e.g., ["adventure", "building", "PvP"]) */
  preferences: string[];
  /** Risk tolerance ("cautious", "balanced", "aggressive") */
  riskTolerance: 'cautious' | 'balanced' | 'aggressive';
  /** Teamwork style ("leader", "follower", "independent", "supportive") */
  teamworkStyle: string;
  /** How they react to winning */
  winReaction: string;
  /** How they react to losing/failure */
  loseReaction: string;
  /** How they approach challenges */
  challengeApproach: string;
  /** Favorite in-game activities */
  favoriteActivities: string[];
}

/**
 * Voice and audio configuration
 */
export interface PersonaVoice {
  /** Voice pitch modifier (0.8 - 1.2) */
  pitch: number;
  /** Speaking speed modifier (0.8 - 1.2) */
  speed: number;
  /** Accent or vocal quality (e.g., "british", "southern", "robotic") */
  accent: string;
  /** Voice energy level ("calm", "moderate", "energetic") */
  energy: 'calm' | 'moderate' | 'energetic';
  /** Vocal mannerisms (e.g., ["sighs often", "laughs easily", "clears throat"]) */
  mannerisms: string[];
  /** Selected ElevenLabs voice ID */
  elevenLabsVoiceId?: string;
  /** Human-readable name for logging/display */
  elevenLabsVoiceName?: string;
}

/**
 * Visual identity
 */
export interface PersonaVisual {
  /** Primary theme color (hex) */
  primary: string;
  /** Secondary accent color (hex) */
  secondary: string;
  /** Avatar image URL (R2) */
  avatarUrl: string | null;
  /** Minecraft skin URL (R2) */
  skinUrl: string | null;
  /** Art style used for avatar */
  artStyle: string;
}

/**
 * Example responses for prompt generation
 */
export interface PersonaExamples {
  /** How they greet the player */
  greeting: string;
  /** How they say goodbye */
  farewell: string;
  /** How they celebrate a win/success */
  celebration: string;
  /** How they react to a setback */
  setback: string;
  /** How they encourage the player */
  encouragement: string;
  /** How they express confusion */
  confusion: string;
}

/**
 * Complete persona data structure
 * All fields are always present with default values
 */
export interface PersonaData {
  /** Core identity */
  identity: PersonaIdentity;
  /** Detailed personality */
  personality: PersonaPersonality;
  /** Communication style */
  communication: PersonaCommunication;
  /** Gaming behavior */
  gaming: PersonaGaming;
  /** Voice configuration */
  voice: PersonaVoice;
  /** Visual identity */
  visualIdentity: PersonaVisual;
  /** Example responses */
  examples: PersonaExamples;
  /** Short summary description (auto-generated or user-provided) */
  description: string;
  /** Human-readable personality description for frontend (generated after personality phase) */
  personalityDescription?: string;
  /** Human-readable gaming description for frontend (generated after gaming phase) */
  gamingDescription?: string;
}

/**
 * Default persona with all fields initialized
 */
export const DEFAULT_PERSONA: PersonaData = {
  identity: {
    name: '',
    tagline: '',
    backstory: '',
    species: 'human',
    ageImpression: '',
  },
  personality: {
    archetype: '',
    traits: [],
    emotionalTendency: '',
    quirks: [],
    values: [],
    fears: [],
    catchphrases: [],
  },
  communication: {
    tone: '',
    responseLength: 'brief',
    formality: 'casual',
    humorStyle: '',
    encouragementStyle: '',
    errorHandling: '',
    vocabulary: '',
    usesEmotes: false,
  },
  gaming: {
    playstyle: '',
    skills: [],
    preferences: [],
    riskTolerance: 'balanced',
    teamworkStyle: '',
    winReaction: '',
    loseReaction: '',
    challengeApproach: '',
    favoriteActivities: [],
  },
  voice: {
    pitch: 1.0,
    speed: 1.0,
    accent: '',
    energy: 'moderate',
    mannerisms: [],
  },
  visualIdentity: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    avatarUrl: null,
    skinUrl: null,
    artStyle: 'supercell',
  },
  examples: {
    greeting: '',
    farewell: '',
    celebration: '',
    setback: '',
    encouragement: '',
    confusion: '',
  },
  description: '',
};

/**
 * Legacy persona format for backwards compatibility
 * Maps to the new structure
 */
export interface LegacyPersonaData {
  name: string;
  description: string;
  personality: {
    traits: string[];
    tone: string;
    behavior: string;
  };
  visualIdentity: {
    primary: string;
    secondary: string;
    avatarUrl: string | null;
    skinUrl: string | null;
  };
  voiceConfig: {
    pitch: number;
    speed: number;
    accent: string;
  };
  gamingStyle: {
    playstyle: string;
    skills: string[];
    preferences: string[];
  };
}

/**
 * Convert legacy persona to new format
 */
export function migrateLegacyPersona(legacy: LegacyPersonaData): PersonaData {
  return {
    identity: {
      name: legacy.name,
      tagline: '',
      backstory: legacy.description,
      species: 'human',
      ageImpression: '',
    },
    personality: {
      archetype: '',
      traits: legacy.personality.traits,
      emotionalTendency: '',
      quirks: [],
      values: [],
      fears: [],
      catchphrases: [],
    },
    communication: {
      tone: legacy.personality.tone,
      responseLength: 'brief',
      formality: 'casual',
      humorStyle: '',
      encouragementStyle: '',
      errorHandling: legacy.personality.behavior,
      vocabulary: '',
      usesEmotes: false,
    },
    gaming: {
      playstyle: legacy.gamingStyle.playstyle,
      skills: legacy.gamingStyle.skills,
      preferences: legacy.gamingStyle.preferences,
      riskTolerance: 'balanced',
      teamworkStyle: '',
      winReaction: '',
      loseReaction: '',
      challengeApproach: '',
      favoriteActivities: [],
    },
    voice: {
      pitch: legacy.voiceConfig.pitch,
      speed: legacy.voiceConfig.speed,
      accent: legacy.voiceConfig.accent,
      energy: 'moderate',
      mannerisms: [],
    },
    visualIdentity: {
      primary: legacy.visualIdentity.primary,
      secondary: legacy.visualIdentity.secondary,
      avatarUrl: legacy.visualIdentity.avatarUrl,
      skinUrl: legacy.visualIdentity.skinUrl,
      artStyle: 'supercell',
    },
    examples: {
      greeting: '',
      farewell: '',
      celebration: '',
      setback: '',
      encouragement: '',
      confusion: '',
    },
    description: legacy.description,
  };
}

/**
 * Simplified persona for frontend WebSocket messages
 * Only includes essential fields for UI display
 */
export interface SimplifiedPersona {
  id?: string;
  name?: string;
  imageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  personalityDescription?: string;
  gamingDescription?: string;
}

/**
 * WebSocket message types sent to clients
 */
/** Application mode for multi-agent transitions */
export type AppMode = 'GATEKEEPER' | 'PERSONA_BUILDER' | 'GAMER_AGENT';

export interface OutgoingMessage {
  /** Message type */
  type: 'chat' | 'persona_update' | 'persona_saved' | 'mode_change' | 'system' | 'error' | 'operation_status';
  /** Role for chat messages */
  role?: 'assistant' | 'user' | 'system';
  /** Text content (for chat, system, error) */
  text?: string;
  /** Suggestions/options for the user to choose from */
  suggestions?: string[];
  /** Simplified persona data for frontend UI */
  persona?: SimplifiedPersona;
  /** Persona database ID (for persona_saved or mode_change) */
  personaId?: string;
  /** Direct image URL (convenience field when avatar/skin generated) */
  imageUrl?: string;
  /** Action type for persona_saved ('created' or 'updated') */
  action?: 'created' | 'updated';
  /** ID of persona being edited (when loading existing for editing) */
  editingPersonaId?: string;
  /** Application mode (for mode_change) */
  mode?: AppMode;
  /** JWT access token (for mode_change requiring auth) */
  accessToken?: string;
  /** JWT expiration timestamp */
  expiresAt?: string;
  /** Conversation summary for context preservation across agent transitions */
  conversationSummary?: string;
  /** Operation type for operation_status messages (e.g., 'generating_avatar', 'uploading', 'extracting_colors') */
  operation?: string;
  /** Status text for operation_status messages (e.g., "Generating Image...", "Uploading...") */
  statusText?: string;
  /** Flag indicating authentication is required (for error messages) */
  requiresAuth?: boolean;
  /** ISO 8601 timestamp */
  timestamp?: string;
}
