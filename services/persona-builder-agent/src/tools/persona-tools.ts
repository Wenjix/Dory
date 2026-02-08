/**
 * Persona Tools
 *
 * Tools for the Persona Builder agent to create, manage, and save personas.
 * Follows the Vercel AI SDK tool pattern.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { generateAvatarImage, editAvatarImage, fetchImageAsBase64, extractColorsFromImage } from '../services/gemini.js';
import { uploadAvatar } from '../services/r2.js';
import { generateBothPrompts, generatePersonalityDescription, generateGamingDescription } from '../services/prompt-generator.js';
import { matchVoiceToPersona } from '../services/voice-matching.js';
import {
  isAuthenticated,
  getUserId,
  updateDraftPersona,
  getDraftPersona,
  getFullPersona,
  getSimplifiedPersona,
  clearDraftPersona,
  setEditingPersonaId,
  getEditingPersonaId,
  isEditingExisting,
  getMessages,
  setPersonaSavedThisTurn,
} from '../services/session.js';
import type { OutgoingMessage, PersonaData } from '../types/persona.js';

/**
 * Tool execution context
 */
export interface ToolContext {
  sessionId: string;
  sendToClient: (message: OutgoingMessage) => void;
}

/**
 * Check if the last user message indicates they want to regenerate the avatar
 * Only checks the LAST user message, not conversation summary (which may contain old messages)
 */
function wantsToRegenerateAvatar(sessionId: string): boolean {
  const messages = getMessages(sessionId);
  // Find the last user message
  const lastUserMessage = messages
    .slice()
    .reverse()
    .find(msg => msg.role === 'user');

  if (!lastUserMessage) {
    return false;
  }

  const messageText = lastUserMessage.content.toLowerCase();
  const regenerationKeywords = [
    'regenerate',
    'new image',
    'different avatar',
    'change image',
    'redo',
    'again',
    'new avatar',
    'generate again',
    'make a new one',
    'create a new',
    'different image',
  ];

  return regenerationKeywords.some(keyword => messageText.includes(keyword));
}

/**
 * Create persona tools with session context
 */
export function createPersonaTools(context: ToolContext) {
  return {
    /**
     * Generate an avatar image
     */
    generateAvatar: tool({
      description: 'Generate an avatar image for the persona using AI image generation. Colors are automatically extracted from the generated image. ⚠️ REQUIRES: The persona must have a name set first (call updateDraftPersona with name before calling this tool).',
      parameters: z.object({
        description: z.string().describe('Detailed visual description of the character'),
        style: z.enum(['realistic', 'cartoon', 'anime', 'pixel-art', 'pixar', 'supercell']).default('supercell')
          .describe('Art style for the avatar (pixar = Pixar Animation Studios style, supercell = base style only, no additional modifier)'),
      }),
      execute: async ({ description: rawDescription, style }) => {
        let description = rawDescription;
        console.log(`\n🚀 [Tool:generateAvatar] ========== STARTING AVATAR GENERATION ==========`);
        console.log(`[Tool:generateAvatar] Session: ${context.sessionId}`);
        console.log(`[Tool:generateAvatar] Description: ${description}`);
        console.log(`[Tool:generateAvatar] Style: ${style}`);

        // CRITICAL: Check if name exists and is valid - avatar generation requires a real name
        const draft = getDraftPersona(context.sessionId);
        const nameValue = draft.identity?.name;
        const hasValidName = nameValue && nameValue.trim() !== '' && nameValue.trim().toLowerCase() !== 'null';
        if (!hasValidName) {
          console.log(`[Tool:generateAvatar] ❌ Cannot generate avatar without a valid name! (got: "${nameValue}")`);
          return {
            success: false,
            error: 'Cannot generate avatar without a name. Please ask the user for a name first, then call generateAvatar again.',
          };
        }

        // ALWAYS enrich description with species from draft context
        // The LLM often passes visual details without the character concept
        // (e.g. "funky mane" instead of "a reggae giraffe with funky mane")
        const species = draft.identity?.species;
        const speciesValid = species && species.trim() !== '' && species.trim().toLowerCase() !== 'null';
        const descLower = description.toLowerCase();

        // Check if description already mentions the species
        const alreadyHasSpecies = speciesValid && descLower.includes(species!.toLowerCase());

        if (!alreadyHasSpecies && speciesValid) {
          // Prepend species to description so Gemini knows what to draw
          const enrichedDescription = `A ${species} character - ${description}`;
          console.log(`[Tool:generateAvatar] 📝 Enriched description (added species): "${rawDescription}" → "${enrichedDescription}"`);
          description = enrichedDescription;
        }

        // Check if avatar already exists
        const existingAvatarUrl = draft.visualIdentity?.avatarUrl;
        if (existingAvatarUrl) {
          // Check if user explicitly wants to regenerate (from last message only, not conversation summary)
          const userWantsRegenerate = wantsToRegenerateAvatar(context.sessionId);

          if (!userWantsRegenerate) {
            // Avatar exists and user didn't ask to regenerate - return existing avatar
            console.log(`[Tool:generateAvatar] ℹ️ Avatar already exists (${existingAvatarUrl}). User didn't ask to regenerate. Returning existing avatar.`);

            // Send persona_update with existing avatar
            context.sendToClient({
              type: 'persona_update',
              persona: getSimplifiedPersona(context.sessionId),
              imageUrl: existingAvatarUrl,
              timestamp: new Date().toISOString(),
            });

            return {
              success: true,
              avatarUrl: existingAvatarUrl,
              message: 'Using existing avatar. If you want a new one, say "regenerate" or "new image".',
            };
          }

          // User wants to regenerate - proceed with generation
          console.log(`[Tool:generateAvatar] 🔄 User requested regeneration. Generating new avatar...`);
        }

        // Get user info for storage organization
        const userId = getUserId(context.sessionId);
        const editingPersonaId = getEditingPersonaId(context.sessionId);
        console.log(`[Tool:generateAvatar] User: ${userId || 'anonymous'}, PersonaId: ${editingPersonaId || 'new'}`);

        try {
          // Send initial status update
          context.sendToClient({
            type: 'operation_status',
            operation: 'generating_avatar',
            statusText: 'Generating Image...',
            persona: getSimplifiedPersona(context.sessionId),
            timestamp: new Date().toISOString(),
          });

          // Step 1: Generate image with Gemini
          console.log(`[Tool:generateAvatar] Step 1: Calling Gemini API...`);
          const image = await generateAvatarImage(description, style);

          if (!image) {
            console.log(`[Tool:generateAvatar] ❌ Gemini failed to generate image`);

            // Fallback: If generation fails but we have an existing avatar, return that instead of error
            const draftAfterFailure = getDraftPersona(context.sessionId);
            const fallbackAvatarUrl = draftAfterFailure.visualIdentity?.avatarUrl;

            if (fallbackAvatarUrl) {
              console.log(`[Tool:generateAvatar] ⚠️ Generation failed, but using existing avatar as fallback: ${fallbackAvatarUrl}`);

              // Send persona_update with existing avatar
              context.sendToClient({
                type: 'persona_update',
                persona: getSimplifiedPersona(context.sessionId),
                imageUrl: fallbackAvatarUrl,
                timestamp: new Date().toISOString(),
              });

              return {
                success: true,
                avatarUrl: fallbackAvatarUrl,
                message: 'Generation failed, but we have your existing avatar. Want to try again?',
              };
            }

            // No existing avatar - return error
            return {
              success: false,
              error: 'Failed to generate avatar image. Try a different description.',
            };
          }

          // Send status update after image generation
          context.sendToClient({
            type: 'operation_status',
            operation: 'uploading',
            statusText: 'Uploading...',
            persona: getSimplifiedPersona(context.sessionId),
            timestamp: new Date().toISOString(),
          });

          // Step 2: Upload to R2 (organized by user/session)
          console.log(`[Tool:generateAvatar] Step 2: Uploading to R2...`);
          const avatarUrl = await uploadAvatar(image.base64, image.mimeType, {
            userId: userId || null,
            personaId: editingPersonaId || null,
            sessionId: context.sessionId,
          });

          // Send status update before color extraction
          context.sendToClient({
            type: 'operation_status',
            operation: 'extracting_colors',
            statusText: 'Extracting colors...',
            persona: getSimplifiedPersona(context.sessionId),
            timestamp: new Date().toISOString(),
          });

          // Step 3: Extract colors from the generated image
          console.log(`[Tool:generateAvatar] Step 3: Extracting colors from avatar...`);
          const colors = await extractColorsFromImage(image.base64, image.mimeType);
          const primaryColor = colors?.primary || '#6366f1';
          const secondaryColor = colors?.secondary || '#8b5cf6';
          console.log(`[Tool:generateAvatar] Extracted colors: ${primaryColor} / ${secondaryColor}`);

          // Step 4: Update draft persona with avatar and extracted colors
          console.log(`[Tool:generateAvatar] Step 4: Updating draft persona...`);
          const draft = getDraftPersona(context.sessionId);
          updateDraftPersona(context.sessionId, {
            visualIdentity: {
              ...draft.visualIdentity,
              primary: primaryColor,
              secondary: secondaryColor,
              avatarUrl,
              artStyle: style,
            },
          });

          // Step 5: Send to client
          console.log(`[Tool:generateAvatar] Step 5: Sending to client...`);
          const simplifiedPersona = getSimplifiedPersona(context.sessionId);
          console.log(`[Tool:generateAvatar] Draft persona avatarUrl: ${simplifiedPersona.imageUrl}`);

          context.sendToClient({
            type: 'persona_update',
            persona: simplifiedPersona,
            imageUrl: avatarUrl,
            timestamp: new Date().toISOString(),
          });

          console.log(`[Tool:generateAvatar] ✅ COMPLETE! Avatar URL: ${avatarUrl}`);
          console.log(`[Tool:generateAvatar] =====================================================\n`);

          return {
            success: true,
            avatarUrl,
            colors: { primary: primaryColor, secondary: secondaryColor },
            message: 'Avatar generated and colors extracted successfully!',
          };
        } catch (error) {
          console.error('[Tool:generateAvatar] ❌ Error:', error);
          console.log(`[Tool:generateAvatar] =====================================================\n`);
          return {
            success: false,
            error: 'Failed to generate avatar. Please try again.',
          };
        }
      },
    }),

    /**
     * Edit an existing avatar image
     */
    editAvatar: tool({
      description: 'Edit the existing avatar image with specific changes. Use this when the persona already has an avatar and the user wants to modify it (e.g., change hair color, add accessories, change expression). Colors are automatically re-extracted after editing. Do NOT use this if there is no existing avatar - use generateAvatar instead.',
      parameters: z.object({
        editPrompt: z.string().describe('Description of what changes to make to the existing avatar (e.g., "change hair color to blue", "add glasses", "make them smile")'),
      }),
      execute: async ({ editPrompt }) => {
        console.log(`\n✏️  [Tool:editAvatar] ========== STARTING AVATAR EDIT ==========`);
        console.log(`[Tool:editAvatar] Session: ${context.sessionId}`);
        console.log(`[Tool:editAvatar] Edit prompt: ${editPrompt}`);

        // Get user info for storage organization
        const userId = getUserId(context.sessionId);
        const editingPersonaId = getEditingPersonaId(context.sessionId);
        console.log(`[Tool:editAvatar] User: ${userId || 'anonymous'}, PersonaId: ${editingPersonaId || 'new'}`);

        try {
          // Step 1: Check if there's an existing avatar
          const draft = getDraftPersona(context.sessionId);
          const existingAvatarUrl = draft.visualIdentity?.avatarUrl;

          if (!existingAvatarUrl) {
            console.log(`[Tool:editAvatar] ❌ No existing avatar to edit`);
            return {
              success: false,
              error: 'No existing avatar to edit. Use generateAvatar to create one first.',
            };
          }

          console.log(`[Tool:editAvatar] Existing avatar: ${existingAvatarUrl.substring(0, 60)}...`);

          // Step 2: Fetch the existing image
          console.log(`[Tool:editAvatar] Step 1: Fetching existing image...`);
          const existingImage = await fetchImageAsBase64(existingAvatarUrl);

          if (!existingImage) {
            console.log(`[Tool:editAvatar] ❌ Failed to fetch existing avatar`);
            return {
              success: false,
              error: 'Failed to fetch existing avatar image. Try regenerating the avatar.',
            };
          }

          // Step 3: Edit with Gemini
          console.log(`[Tool:editAvatar] Step 2: Calling Gemini to edit image...`);
          const editedImage = await editAvatarImage(
            editPrompt,
            existingImage.base64,
            existingImage.mimeType
          );

          if (!editedImage) {
            console.log(`[Tool:editAvatar] ❌ Gemini failed to edit image`);
            return {
              success: false,
              error: 'Failed to edit avatar image. Try a different edit prompt.',
            };
          }

          // Step 4: Upload edited image to R2 (organized by user/session)
          console.log(`[Tool:editAvatar] Step 3: Uploading edited image to R2...`);
          const avatarUrl = await uploadAvatar(editedImage.base64, editedImage.mimeType, {
            userId: userId || null,
            personaId: editingPersonaId || null,
            sessionId: context.sessionId,
          });

          // Step 5: Extract colors from the edited image
          console.log(`[Tool:editAvatar] Step 4: Extracting colors from edited avatar...`);
          const colors = await extractColorsFromImage(editedImage.base64, editedImage.mimeType);
          const primaryColor = colors?.primary || draft.visualIdentity?.primary || '#6366f1';
          const secondaryColor = colors?.secondary || draft.visualIdentity?.secondary || '#8b5cf6';
          console.log(`[Tool:editAvatar] Extracted colors: ${primaryColor} / ${secondaryColor}`);

          // Step 6: Update draft persona with new avatar URL and colors
          console.log(`[Tool:editAvatar] Step 5: Updating draft persona...`);
          updateDraftPersona(context.sessionId, {
            visualIdentity: {
              ...draft.visualIdentity,
              primary: primaryColor,
              secondary: secondaryColor,
              avatarUrl,
            },
          });

          // Step 7: Send to client
          console.log(`[Tool:editAvatar] Step 6: Sending to client...`);

          context.sendToClient({
            type: 'persona_update',
            persona: getSimplifiedPersona(context.sessionId),
            imageUrl: avatarUrl,
            timestamp: new Date().toISOString(),
          });

          console.log(`[Tool:editAvatar] ✅ COMPLETE! New Avatar URL: ${avatarUrl}`);
          console.log(`[Tool:editAvatar] =====================================================\n`);

          return {
            success: true,
            avatarUrl,
            colors: { primary: primaryColor, secondary: secondaryColor },
            message: `Avatar edited and colors updated! Applied: ${editPrompt}`,
          };
        } catch (error) {
          console.error('[Tool:editAvatar] ❌ Error:', error);
          console.log(`[Tool:editAvatar] =====================================================\n`);
          return {
            success: false,
            error: 'Failed to edit avatar. Please try again.',
          };
        }
      },
    }),

    /**
     * Update the draft persona with new information
     * Flattened schema for better LLM compatibility - fields use prefixes (identity_, personality_, etc.)
     */
    updateDraftPersona: tool({
      description: 'Update persona with gathered info. Call frequently! All fields optional.',
      parameters: z.object({
        // Identity (prefix: none for name, identity_ for others)
        name: z.string().optional().describe('Persona name'),
        tagline: z.string().optional().describe('Title like "The Fearless Explorer"'),
        backstory: z.string().optional().describe('Brief origin (1-2 sentences)'),
        species: z.string().optional().describe('human, robot, dragon, fairy, elf, animal'),
        ageImpression: z.string().optional().describe('young, ancient, teenager, ageless'),

        // Personality
        archetype: z.string().optional().describe('mentor, trickster, hero, sage, rebel, caregiver'),
        traits: z.array(z.string()).optional().describe('3-5 traits: brave, curious, impatient'),
        emotionalTendency: z.string().optional().describe('optimistic, melancholic, stoic, cheerful'),
        quirks: z.array(z.string()).optional().describe('bad puns, forgets names, hums'),
        values: z.array(z.string()).optional().describe('loyalty, adventure, knowledge'),
        fears: z.array(z.string()).optional().describe('being alone, failure, heights'),
        catchphrases: z.array(z.string()).optional().describe('Signature phrases'),

        // Communication
        tone: z.string().optional().describe('warm, sarcastic, formal, playful'),
        formality: z.string().optional().describe('casual, balanced, formal'),
        humorStyle: z.string().optional().describe('witty, dry, dad-jokes, none'),
        encouragementStyle: z.string().optional().describe('cheerleader, quiet support, tough love'),

        // Gaming
        playstyle: z.string().optional().describe('explorer, builder, fighter, collector'),
        gamingSkills: z.array(z.string()).optional().describe('navigation, combat, building'),
        riskTolerance: z.string().optional().describe('cautious, balanced, aggressive'),
        teamworkStyle: z.string().optional().describe('leader, follower, independent'),
        winReaction: z.string().optional().describe('How they celebrate'),
        loseReaction: z.string().optional().describe('How they handle loss'),

        // Voice
        voicePitch: z.number().optional().describe('0.8 (low) to 1.2 (high)'),
        voiceSpeed: z.number().optional().describe('0.8 (slow) to 1.2 (fast)'),
        accent: z.string().optional().describe('british, southern, robotic, none'),
        voiceEnergy: z.string().optional().describe('calm, moderate, energetic'),

        // Examples
        exampleGreeting: z.string().optional().describe('How they say hello'),
        exampleCelebration: z.string().optional().describe('How they celebrate'),
        exampleSetback: z.string().optional().describe('How they handle problems'),

        // Summary
        description: z.string().optional().describe('Summary description'),
      }),
      execute: async (params) => {
        console.log(`[Tool:updateDraftPersona] Updating draft with:`, Object.keys(params).filter(k => params[k as keyof typeof params] !== undefined));

        // Map flat params to nested structure
        const updates: any = {};

        // Identity
        if (params.name || params.tagline || params.backstory || params.species || params.ageImpression) {
          updates.identity = {
            name: params.name,
            tagline: params.tagline,
            backstory: params.backstory,
            species: params.species,
            ageImpression: params.ageImpression,
          };
        }

        // Personality
        if (params.archetype || params.traits || params.emotionalTendency || params.quirks || params.values || params.fears || params.catchphrases) {
          updates.personality = {
            archetype: params.archetype,
            traits: params.traits,
            emotionalTendency: params.emotionalTendency,
            quirks: params.quirks,
            values: params.values,
            fears: params.fears,
            catchphrases: params.catchphrases,
          };
        }

        // Communication
        if (params.tone || params.formality || params.humorStyle || params.encouragementStyle) {
          updates.communication = {
            tone: params.tone,
            formality: params.formality as any,
            humorStyle: params.humorStyle,
            encouragementStyle: params.encouragementStyle,
          };
        }

        // Gaming
        if (params.playstyle || params.gamingSkills || params.riskTolerance || params.teamworkStyle || params.winReaction || params.loseReaction) {
          updates.gaming = {
            playstyle: params.playstyle,
            skills: params.gamingSkills,
            riskTolerance: params.riskTolerance as any,
            teamworkStyle: params.teamworkStyle,
            winReaction: params.winReaction,
            loseReaction: params.loseReaction,
          };
        }

        // Voice
        if (params.voicePitch !== undefined || params.voiceSpeed !== undefined || params.accent || params.voiceEnergy) {
          updates.voice = {
            pitch: params.voicePitch,
            speed: params.voiceSpeed,
            accent: params.accent,
            energy: params.voiceEnergy as any,
          };
        }

        // Examples
        if (params.exampleGreeting || params.exampleCelebration || params.exampleSetback) {
          updates.examples = {
            greeting: params.exampleGreeting,
            celebration: params.exampleCelebration,
            setback: params.exampleSetback,
          };
        }

        // Description
        if (params.description) {
          updates.description = params.description;
        }

        // Check if there are any actual updates (not just empty object)
        const hasUpdates = Object.keys(updates).length > 0;
        if (!hasUpdates) {
          console.log('[Tool:updateDraftPersona] ⚠️ No actual updates provided - all params were undefined. Skipping update.');
          return {
            success: false,
            error: 'ERROR: You called updateDraftPersona with all undefined parameters. You must provide at least one actual field value (e.g., name, species, traits, etc.). Do NOT call this tool unless you have real data to save. If you need to ask the user for information, do that instead of calling this tool.',
          };
        }

        const draft = updateDraftPersona(context.sessionId, updates);

        // Check if we need to generate descriptions
        const fullPersona = getFullPersona(context.sessionId);

        // Trigger personality description generation if:
        // - Personality fields were just set (archetype or traits)
        // - We don't have a description yet
        if ((params.archetype || params.traits) && !fullPersona.personalityDescription) {
          console.log('[Tool:updateDraftPersona] Triggering personality description generation...');
          try {
            const personalityDesc = await generatePersonalityDescription(fullPersona);
            if (personalityDesc) {
              updateDraftPersona(context.sessionId, { personalityDescription: personalityDesc });
              console.log(`[Tool:updateDraftPersona] Generated personality description: ${personalityDesc}`);
            }
          } catch (error) {
            console.error('[Tool:updateDraftPersona] Failed to generate personality description:', error);
          }
        }

        // Trigger gaming description generation if:
        // - Gaming fields were just set (playstyle or riskTolerance)
        // - We don't have a description yet
        if ((params.playstyle || params.riskTolerance) && !fullPersona.gamingDescription) {
          console.log('[Tool:updateDraftPersona] Triggering gaming description generation...');
          try {
            const gamingDesc = await generateGamingDescription(fullPersona);
            if (gamingDesc) {
              updateDraftPersona(context.sessionId, { gamingDescription: gamingDesc });
              console.log(`[Tool:updateDraftPersona] Generated gaming description: ${gamingDesc}`);
            }
          } catch (error) {
            console.error('[Tool:updateDraftPersona] Failed to generate gaming description:', error);
          }
        }

        // Notify client with simplified persona (refreshed after any description generation)
        context.sendToClient({
          type: 'persona_update',
          persona: getSimplifiedPersona(context.sessionId),
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: 'Persona updated!',
        };
      },
    }),

    /**
     * Save the persona to database (create new or update existing)
     */
    savePersona: tool({
      description: 'Save the completed persona to the database. If editing an existing persona, it will update it. If creating new, it will create a new one. ⚠️ CALL THIS TOOL when user says "save", "yes" to saving, "ready", or "done".',
      parameters: z.object({}),
      execute: async () => {
        const editingPersonaId = getEditingPersonaId(context.sessionId);
        const isUpdate = isEditingExisting(context.sessionId);

        console.log(`[Tool:savePersona] Attempting to ${isUpdate ? 'update' : 'create'} persona`);
        if (isUpdate) {
          console.log(`[Tool:savePersona] Editing existing persona: ${editingPersonaId}`);
        }

        // Always authenticated with user-123
        const userId = 'user-123';

        const draft = getDraftPersona(context.sessionId);

        // Validate draft has ALL required fields
        const missingFields: string[] = [];

        if (!draft.identity?.name) {
          missingFields.push('name');
        }
        if (!draft.identity?.species) {
          missingFields.push('species');
        }
        if (!draft.visualIdentity?.avatarUrl) {
          missingFields.push('avatar (generate one first)');
        }
        if (!draft.personality?.traits || draft.personality.traits.length === 0) {
          missingFields.push('personality traits');
        }

        if (missingFields.length > 0) {
          const missing = missingFields.join(', ');
          console.log(`[Tool:savePersona] Missing required fields: ${missing}`);
          return {
            success: false,
            error: `Can't save yet! Missing: ${missing}. Let's complete the persona first.`,
            missingFields,
          };
        }

        try {
          // Get full persona before saving (for the response)
          let fullPersona = getFullPersona(context.sessionId);
          let persona;
          let actionType: 'created' | 'updated';

          // Send operation status before starting prompt generation
          context.sendToClient({
            type: 'operation_status',
            operation: 'generating_prompts',
            statusText: 'Generating AI prompts...',
            persona: getSimplifiedPersona(context.sessionId),
            timestamp: new Date().toISOString(),
          });

          // Generate LLM prompts for voice agent and gaming agents
          console.log('[Tool:savePersona] Generating agent prompts via LLM...');
          const { conversationalPrompt, gamingPrompt } = await generateBothPrompts(fullPersona);
          console.log('[Tool:savePersona] ✅ Agent prompts generated');

          // Auto-match ElevenLabs voice (non-blocking — save proceeds even if this fails)
          let voiceMatch: { voiceId: string; voiceName: string } | null = null;
          try {
            console.log('[Tool:savePersona] Starting voice matching...');
            voiceMatch = await matchVoiceToPersona(fullPersona);
            if (voiceMatch) {
              console.log(`[Tool:savePersona] ✅ Voice matched: ${voiceMatch.voiceName} (${voiceMatch.voiceId})`);
              updateDraftPersona(context.sessionId, {
                voice: { elevenLabsVoiceId: voiceMatch.voiceId, elevenLabsVoiceName: voiceMatch.voiceName }
              });
              // Update fullPersona to include the matched voice
              fullPersona = getFullPersona(context.sessionId);
              console.log(`[Tool:savePersona] 📝 voiceId saved to draft: ${voiceMatch.voiceId}`);
            } else {
              console.warn('[Tool:savePersona] ⚠️ Voice matching returned null (no voice assigned)');
            }
          } catch (err) {
            console.error('[Tool:savePersona] ❌ Voice matching failed with error:', err);
            if (err instanceof Error) {
              console.error('[Tool:savePersona] Error details:', err.message, err.stack);
            }
          }

          // Prepare data for database (new comprehensive schema)
          // Cast to JSON for Prisma
          const voiceData = fullPersona.voice as any;
          const savedVoiceId = voiceData?.elevenLabsVoiceId;
          if (savedVoiceId) {
            console.log(`[Tool:savePersona] 💾 Saving persona with voiceId: ${savedVoiceId}`);
          } else {
            console.log(`[Tool:savePersona] ⚠️ Saving persona WITHOUT voiceId (voice matching may have failed)`);
          }

          const personaData = {
            identity: fullPersona.identity as any,
            personality: fullPersona.personality as any,
            communication: fullPersona.communication as any,
            gaming: fullPersona.gaming as any,
            voice: voiceData,
            visualIdentity: fullPersona.visualIdentity as any,
            examples: fullPersona.examples as any,
            description: fullPersona.description || null,
            personalityDescription: fullPersona.personalityDescription || null,  // Human-readable for frontend
            gamingDescription: fullPersona.gamingDescription || null,            // Human-readable for frontend
            conversationalPrompt,  // LLM-generated prompt for voice agent
            gamingPrompt,          // LLM-generated prompt for gaming agents
            schemaVersion: 3,
          };

          if (isUpdate && editingPersonaId) {
            // UPDATE: Verify ownership before updating
            const existingPersona = await prisma.persona.findFirst({
              where: {
                id: editingPersonaId,
                userId: userId, // OWNERSHIP VALIDATION
              },
            });

            if (!existingPersona) {
              return {
                success: false,
                error: 'Persona not found or you don\'t have permission to update it.',
              };
            }

            // Update existing persona
            persona = await prisma.persona.update({
              where: { id: editingPersonaId },
              data: {
                ...personaData,
                status: 'published',
              },
            });
            actionType = 'updated';
            console.log(`[Tool:savePersona] ✅ Updated persona: ${persona.id}`);
          } else {
            // CREATE: Check for duplicate name before creating
            const personaName = fullPersona.identity.name;

            // For MongoDB JSON fields, we need to fetch all user's personas and check names in JavaScript
            // Prisma doesn't support path-based JSON queries for MongoDB
            const userPersonas = await prisma.persona.findMany({
              where: {
                userId,
                status: { not: 'deleted' }, // Ignore soft-deleted personas
              },
              select: {
                id: true,
                identity: true,
              },
            });

            // Check if any existing persona has the same name
            const duplicateCheck = userPersonas.find((p: any) => {
              const identity = p.identity as any;
              return identity?.name === personaName;
            });

            if (duplicateCheck) {
              console.log(`[Tool:savePersona] ❌ Duplicate name detected: "${personaName}"`);
              return {
                success: false,
                error: `A persona named "${personaName}" already exists. Please choose a different name.`,
                isDuplicateName: true,
              };
            }

            // CREATE: Save new persona with userId as owner
            persona = await prisma.persona.create({
              data: {
                userId, // Owner is the creating user
                ...personaData,
                status: 'published',
              },
            });
            actionType = 'created';
            console.log(`[Tool:savePersona] ✅ Created new persona: ${persona.id}`);
          }

          // Create simplified persona for client before clearing draft
          const simplifiedPersonaForClient = {
            id: persona.id,
            name: fullPersona.identity.name || undefined,
            imageUrl: fullPersona.visualIdentity.avatarUrl || undefined,
            primaryColor: fullPersona.visualIdentity.primary || undefined,
            secondaryColor: fullPersona.visualIdentity.secondary || undefined,
            personalityDescription: fullPersona.personalityDescription || undefined,
            gamingDescription: fullPersona.gamingDescription || undefined,
          };

          // Flag that persona was saved this turn
          setPersonaSavedThisTurn(context.sessionId);

          // Clear draft after successful save
          clearDraftPersona(context.sessionId);

          // Re-set editingPersonaId AFTER clearing draft
          // (clearDraftPersona wipes it, but we need it for playWithPersona transition)
          await setEditingPersonaId(context.sessionId, persona.id);
          console.log(`[Tool:savePersona] Draft cleared, editingPersonaId re-set: ${persona.id}`);

          // Notify client with simplified persona data
          context.sendToClient({
            type: 'persona_saved',
            personaId: persona.id,
            persona: simplifiedPersonaForClient,
            action: actionType,
            timestamp: new Date().toISOString(),
          });

          const personaName = fullPersona.identity.name || 'Your persona';
          const message = actionType === 'updated'
            ? `${personaName} has been updated! Your changes are saved.`
            : `${personaName} has been saved! You can now use them in games.`;

          // Send chat response with success message and play suggestion
          context.sendToClient({
            type: 'chat',
            role: 'assistant',
            text: message,
            suggestions: actionType === 'created' ? [`Let's play with ${personaName}`] : undefined,
            persona: simplifiedPersonaForClient,
            timestamp: new Date().toISOString(),
          });

          return {
            success: true,
            personaId: persona.id,
            action: actionType,
            message,
          };
        } catch (error) {
          console.error('[Tool:savePersona] Error:', error);
          return {
            success: false,
            error: 'Failed to save persona. Please try again.',
          };
        }
      },
    }),

  };
}
