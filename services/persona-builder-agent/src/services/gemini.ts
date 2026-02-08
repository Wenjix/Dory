/**
 * Gemini Image Generation Service
 *
 * Uses Google Gemini for generating avatar images
 * and Minecraft skins based on persona descriptions.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../config/index.js';

// Lazy-initialized Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const config = getConfig();
    geminiClient = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  }
  return geminiClient;
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

// List of models to try for image generation (in order of preference)
// These models support native image generation via generateContent
const IMAGE_GENERATION_MODELS = [
  'gemini-2.5-flash-image',          // Gemini 2.5 Flash with image generation
  'gemini-3-pro-image-preview',      // Gemini 3 Pro with image generation (preview)
];

// ============================================================================
// AVATAR STYLE CONFIGURATION
// ============================================================================
// Modify this to change the visual style of all generated avatars.
// The {description} placeholder will be replaced with the user's character description.

export const AVATAR_STYLE_CONFIG = {
  /**
   * Main style prefix applied to all avatar generation prompts.
   * This sets the overall visual aesthetic for the platform.
   */
  stylePrefix: 'A polished 3D character render in a simplified mobile game style. The character features chunky, solid geometry with smooth, seamless surfaces and zero visible fur or fabric grain. Proportions are exaggerated with thick limbs and large, blocky hands. The textures are flat and matte, resembling molded PVC or smooth vinyl toys. Lighting is bright and high-contrast. Colors are vibrant, saturated, and use clean gradients instead of complex textures. High-quality 3D splash art with a playful, tactile figurine feel, inspired by the clean rendering of Clash Of Clans.',
  /**
   * Additional style modifiers per art style option.
   * These are combined with the stylePrefix when a specific style is requested.
   */
  styleModifiers: {
    supercell: 'Add a arena background without text and a dynamic pose', // Empty modifier - uses only the base stylePrefix
    realistic: 'photorealistic details, subtle skin textures',
    cartoon: 'vibrant colors, expressive features, friendly appearance',
    anime: 'large expressive eyes, smooth shading, Japanese animation aesthetic',
    'pixel-art': 'clean pixel art, retro gaming aesthetic, 16-bit style',
    pixar: '3D character design, high detail, cinematic lighting, background that matches the character theme, Pixar style'
  } as Record<string, string>,

  /**
   * Template for the final prompt. Available placeholders:
   * - {stylePrefix}: The main style prefix
   * - {styleModifier}: The modifier for the selected art style
   * - {description}: User's character description
   */
  promptTemplate: '{stylePrefix}, {styleModifier}: {description}',
};

// ============================================================================
// IP/COPYRIGHT SANITIZATION
// ============================================================================
// Automatically removes copyrighted character/brand references to avoid API rejections

const IP_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Disney/Pixar
  { pattern: /\b(disney|pixar|dreamworks|illumination)\b/gi, replacement: '' },
  { pattern: /\bfinding (nemo|dory)\b/gi, replacement: '' },
  { pattern: /\blike nemo\b/gi, replacement: 'with curious eyes' },
  { pattern: /\bbased on nemo\b/gi, replacement: '' },
  { pattern: /\bnemo from\b/gi, replacement: 'clown fish' },
  { pattern: /\bfrozen\b/gi, replacement: '' },
  { pattern: /\belsa\b/gi, replacement: 'ice queen' },
  { pattern: /\bbuzz lightyear\b/gi, replacement: 'space ranger' },
  { pattern: /\bwoody\b/gi, replacement: 'cowboy' },

  // Nintendo
  { pattern: /\bnintendo\b/gi, replacement: '' },
  { pattern: /\bmario\b/gi, replacement: 'plumber with mustache' },
  { pattern: /\bluigi\b/gi, replacement: 'tall plumber in green' },
  { pattern: /\bpikachu\b/gi, replacement: 'yellow electric mouse creature' },
  { pattern: /\bpokemon\b/gi, replacement: 'creature' },
  { pattern: /\bzelda\b/gi, replacement: 'princess' },
  { pattern: /\blink\b(?!\s+(to|between|with))/gi, replacement: 'elf hero' },

  // Marvel/DC
  { pattern: /\b(marvel|dc comics|dc universe)\b/gi, replacement: '' },
  { pattern: /\bspider-?man\b/gi, replacement: 'web-slinging hero' },
  { pattern: /\biron man\b/gi, replacement: 'armored hero' },
  { pattern: /\bbatman\b/gi, replacement: 'dark knight hero' },
  { pattern: /\bsuperman\b/gi, replacement: 'caped flying hero' },

  // Other franchises
  { pattern: /\b(harry potter|hogwarts)\b/gi, replacement: 'young wizard' },
  { pattern: /\bstar wars\b/gi, replacement: '' },
  { pattern: /\byoda\b/gi, replacement: 'small green wise creature' },
  { pattern: /\bdarth vader\b/gi, replacement: 'dark armored villain' },
  { pattern: /\bminecraft\b/gi, replacement: 'blocky' },
  { pattern: /\bsteve\b/gi, replacement: 'blocky adventurer' },
  { pattern: /\bsonic\b/gi, replacement: 'fast blue hedgehog' },
  { pattern: /\bspongebob\b/gi, replacement: 'yellow sea sponge' },
  { pattern: /\bpatrick star\b/gi, replacement: 'pink starfish' },

  // Generic cleanup
  { pattern: /\bfrom the (movie|film|game|show|series)\b/gi, replacement: '' },
  { pattern: /\bthe famous character\b/gi, replacement: '' },
  { pattern: /\bthe character\b/gi, replacement: '' },
  { pattern: /\bcopyrighted\b/gi, replacement: '' },
  { pattern: /\btrademarked\b/gi, replacement: '' },
];

/**
 * Sanitize description to remove copyrighted/trademarked references
 * Preserves the visual essence while removing IP that could trigger API rejections
 */
function sanitizeDescription(description: string): string {
  let sanitized = description;

  for (const { pattern, replacement } of IP_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Clean up extra whitespace and punctuation
  sanitized = sanitized
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s*,\s*$/g, '')
    .trim();

  if (sanitized !== description) {
    console.log(`[Gemini] Sanitized IP references:`);
    console.log(`[Gemini]   Original: "${description.substring(0, 80)}..."`);
    console.log(`[Gemini]   Sanitized: "${sanitized.substring(0, 80)}..."`);
  }

  return sanitized;
}

/**
 * List available models (useful for debugging)
 */
export async function listAvailableModels(): Promise<string[]> {
  const genAI = getGeminiClient();
  const config = getConfig();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`
    );
    const data = await response.json() as any;
    const models = data.models?.map((m: any) => m.name) || [];
    return models;
  } catch (error) {
    console.error('[Gemini] Failed to list models:', error);
    return [];
  }
}

/**
 * Generate an avatar image for a persona using Gemini
 *
 * @param description - Detailed visual description of the character
 * @param style - Art style (realistic, cartoon, anime, pixel-art)
 * @returns Base64 encoded image data or null if generation fails
 */
export async function generateAvatarImage(
  description: string,
  style: string = 'cartoon'
): Promise<GeneratedImage | null> {
  const genAI = getGeminiClient();
  const prompt = buildAvatarPrompt(description, style);

  console.log(`\n🎨 [Gemini] ========== AVATAR GENERATION ==========`);
  console.log(`[Gemini] Style: ${style}`);
  console.log(`[Gemini] Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);

  const startTime = Date.now();

  // Try each model until one works
  for (const modelName of IMAGE_GENERATION_MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        } as any,
      });
      const response = result.response;

      // Check for inline image data in parts
      const parts = response.candidates?.[0]?.content?.parts || [];
      console.log(`[Gemini] ${modelName} returned ${parts.length} parts`);

      for (const part of parts) {
        const anyPart = part as any;
        console.log(`[Gemini] Part type:`, Object.keys(anyPart));

        if (anyPart.inlineData?.data) {
          const duration = Date.now() - startTime;
          console.log(`[Gemini] ✅ Avatar generated with ${modelName} in ${duration}ms!`);
          console.log(`[Gemini] Image size: ${Math.round(anyPart.inlineData.data.length / 1024)}KB`);
          console.log(`[Gemini] ==========================================\n`);
          return {
            base64: anyPart.inlineData.data,
            mimeType: anyPart.inlineData.mimeType || 'image/png',
          };
        }
      }

      // Model responded but no image
      const text = response.text?.() || '';
      if (text) {
        console.log(`[Gemini] ${modelName} returned text: "${text.substring(0, 100)}..."`);
      } else {
        console.log(`[Gemini] ${modelName} returned no image content`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Gemini] ${modelName} failed: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  console.error(`[Gemini] ❌ All models failed after ${duration}ms`);
  console.log(`[Gemini] ==========================================\n`);
  return null;
}

/**
 * Generate a Minecraft skin for a persona using Gemini
 *
 * @param description - Character appearance description
 * @param baseStyle - Minecraft skin style preference
 * @returns Base64 encoded skin image or null if generation fails
 */
export async function generateMinecraftSkinImage(
  description: string,
  baseStyle: string = 'default'
): Promise<GeneratedImage | null> {
  const genAI = getGeminiClient();
  const prompt = buildMinecraftSkinPrompt(description, baseStyle);

  console.log(`\n🎮 [Gemini] ========== MINECRAFT SKIN GENERATION ==========`);
  console.log(`[Gemini] Style: ${baseStyle}`);
  console.log(`[Gemini] Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);

  const startTime = Date.now();

  // Try each model until one works
  for (const modelName of IMAGE_GENERATION_MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        } as any,
      });
      const response = result.response;

      // Check for inline image data in parts
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        const anyPart = part as any;
        if (anyPart.inlineData?.data) {
          const duration = Date.now() - startTime;
          console.log(`[Gemini] ✅ Minecraft skin generated with ${modelName} in ${duration}ms!`);
          console.log(`[Gemini] Image size: ${Math.round(anyPart.inlineData.data.length / 1024)}KB`);
          console.log(`[Gemini] ================================================\n`);
          return {
            base64: anyPart.inlineData.data,
            mimeType: anyPart.inlineData.mimeType || 'image/png',
          };
        }
      }

      // Model responded but no image
      const text = response.text?.() || '';
      if (text) {
        console.log(`[Gemini] ${modelName} returned text: "${text.substring(0, 100)}..."`);
      } else {
        console.log(`[Gemini] ${modelName} returned no image content`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Gemini] ${modelName} failed: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  console.error(`[Gemini] ❌ All models failed after ${duration}ms`);
  console.log(`[Gemini] ================================================\n`);
  return null;
}

/**
 * Edit an existing avatar image using Gemini
 *
 * @param editPrompt - Description of the changes to make
 * @param existingImageBase64 - Base64 encoded existing image
 * @param mimeType - MIME type of the existing image
 * @returns Base64 encoded edited image or null if editing fails
 */
export async function editAvatarImage(
  editPrompt: string,
  existingImageBase64: string,
  mimeType: string = 'image/png'
): Promise<GeneratedImage | null> {
  const genAI = getGeminiClient();

  // Sanitize edit prompt to remove copyrighted references
  const cleanEditPrompt = sanitizeDescription(editPrompt);

  console.log(`\n✏️  [Gemini] ========== AVATAR EDIT ==========`);
  console.log(`[Gemini] Edit prompt: ${cleanEditPrompt.substring(0, 100)}${cleanEditPrompt.length > 100 ? '...' : ''}`);
  console.log(`[Gemini] Input image size: ${Math.round(existingImageBase64.length / 1024)}KB`);

  const startTime = Date.now();

  // Try each model until one works
  for (const modelName of IMAGE_GENERATION_MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      // Send the edit prompt along with the existing image
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: `Edit this image: ${cleanEditPrompt}. Keep the same character but apply the requested changes. Output the modified image.` },
            {
              inlineData: {
                data: existingImageBase64,
                mimeType: mimeType,
              },
            },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        } as any,
      });
      const response = result.response;

      // Check for inline image data in parts
      const parts = response.candidates?.[0]?.content?.parts || [];
      console.log(`[Gemini] ${modelName} returned ${parts.length} parts`);

      for (const part of parts) {
        const anyPart = part as any;
        console.log(`[Gemini] Part type:`, Object.keys(anyPart));

        if (anyPart.inlineData?.data) {
          const duration = Date.now() - startTime;
          console.log(`[Gemini] ✅ Avatar edited with ${modelName} in ${duration}ms!`);
          console.log(`[Gemini] Output image size: ${Math.round(anyPart.inlineData.data.length / 1024)}KB`);
          console.log(`[Gemini] ========================================\n`);
          return {
            base64: anyPart.inlineData.data,
            mimeType: anyPart.inlineData.mimeType || 'image/png',
          };
        }
      }

      // Model responded but no image
      const text = response.text?.() || '';
      if (text) {
        console.log(`[Gemini] ${modelName} returned text: "${text.substring(0, 100)}..."`);
      } else {
        console.log(`[Gemini] ${modelName} returned no image content`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Gemini] ${modelName} failed: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  console.error(`[Gemini] ❌ All models failed after ${duration}ms`);
  console.log(`[Gemini] ========================================\n`);
  return null;
}

/**
 * Fetch an image from a URL and return as base64
 *
 * @param imageUrl - URL of the image to fetch
 * @returns Base64 encoded image and mime type, or null if fetch fails
 */
export async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log(`[Gemini] Fetching image from: ${imageUrl.substring(0, 60)}...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[Gemini] Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    console.log(`[Gemini] ✅ Image fetched: ${Math.round(base64.length / 1024)}KB, type: ${contentType}`);

    return {
      base64,
      mimeType: contentType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Gemini] Failed to fetch image: ${errorMessage}`);
    return null;
  }
}

// Models for vision/analysis tasks (non-image-generation)
const VISION_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/**
 * Extract dominant colors from an image using Gemini vision
 *
 * Analyzes the image to identify the two most prominent colors,
 * returning them as hex color codes for use in the persona's visual identity.
 *
 * @param base64ImageData - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @returns Object with primary and secondary hex colors, or null if extraction fails
 */
export async function extractColorsFromImage(
  base64ImageData: string,
  mimeType: string
): Promise<{ primary: string; secondary: string } | null> {
  const genAI = getGeminiClient();

  console.log(`\n🎨 [Gemini] ========== COLOR EXTRACTION ==========`);
  console.log(`[Gemini] Input image size: ${Math.round(base64ImageData.length / 1024)}KB`);

  const startTime = Date.now();

  const prompt = `Analyze this character avatar image and identify the TWO most dominant/prominent colors.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"primary": "#XXXXXX", "secondary": "#XXXXXX"}

Rules:
- primary: The most dominant color in the image (character's main color, clothing, or skin tone)
- secondary: The second most prominent color (accent color, hair, eyes, or background element)
- Both must be valid 6-character hex color codes starting with #
- Choose vibrant, representative colors that capture the character's visual identity
- Avoid pure white (#FFFFFF) or pure black (#000000) unless they're truly dominant`;

  // Try each vision model until one works
  for (const modelName of VISION_MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}...`);

      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64ImageData,
                mimeType: mimeType,
              },
            },
          ],
        }],
      });

      const response = result.response;
      const text = response.text?.() || '';

      console.log(`[Gemini] ${modelName} response: ${text.substring(0, 100)}`);

      // Parse the JSON response
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate hex color format
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        if (hexRegex.test(parsed.primary) && hexRegex.test(parsed.secondary)) {
          const duration = Date.now() - startTime;
          console.log(`[Gemini] ✅ Colors extracted with ${modelName} in ${duration}ms!`);
          console.log(`[Gemini] Primary: ${parsed.primary}, Secondary: ${parsed.secondary}`);
          console.log(`[Gemini] ==========================================\n`);
          return {
            primary: parsed.primary.toUpperCase(),
            secondary: parsed.secondary.toUpperCase(),
          };
        } else {
          console.log(`[Gemini] Invalid hex format in response: ${JSON.stringify(parsed)}`);
        }
      } else {
        console.log(`[Gemini] No JSON found in response`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Gemini] ${modelName} failed: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  console.error(`[Gemini] ❌ Color extraction failed after ${duration}ms`);
  console.log(`[Gemini] ==========================================\n`);
  return null;
}

/**
 * Build a detailed prompt for avatar generation using the platform style config
 */
function buildAvatarPrompt(description: string, style: string): string {
  const { stylePrefix, styleModifiers, promptTemplate } = AVATAR_STYLE_CONFIG;

  // Sanitize description to remove copyrighted references
  const cleanDescription = sanitizeDescription(description);

  // Get the style modifier for the selected style, or use cartoon as default
  const styleModifier = styleModifiers[style] || styleModifiers.cartoon;

  // Build the styled prompt using the template
  const styledPrompt = promptTemplate
    .replace('{stylePrefix}', stylePrefix)
    .replace('{styleModifier}', styleModifier)
    .replace('{description}', cleanDescription);

  console.log(`[Gemini] Using platform style: "${stylePrefix}"`);
  console.log(`[Gemini] Style modifier (${style}): "${styleModifier}"`);

  // Supercell style uses full body, others use portrait
  const poseRequirement = style === 'supercell'
    ? '- Full body character in dynamic pose'
    : '- Portrait showing head and shoulders';

  return `Create an image: A character portrait for a gaming companion.

${styledPrompt}

Additional requirements:
${poseRequirement}
- Friendly expression
- High quality avatar image
- Memorable character design

Generate the image now.`;
}

/**
 * Build a prompt for Minecraft skin generation
 */
function buildMinecraftSkinPrompt(description: string, baseStyle: string): string {
  // Sanitize description to remove copyrighted references
  const cleanDescription = sanitizeDescription(description);

  const styleGuides: Record<string, string> = {
    default: 'standard Minecraft skin proportions',
    slim: 'slim arm Minecraft skin (Alex model)',
    detailed: 'high detail Minecraft skin with shading',
  };

  const styleGuide = styleGuides[baseStyle] || styleGuides.default;

  return `Create an image: A Minecraft character skin.

Style: ${styleGuide}
Character: ${cleanDescription}

Details:
- Minecraft skin format (64x64 pixels)
- Front-facing view of the skin
- Clean pixel art style
- Include face, body, arms, legs

Generate the Minecraft skin image now.`;
}
