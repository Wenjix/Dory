/**
 * Environment Configuration
 *
 * All required environment variables for the Persona Builder Agent.
 * Uses zod for runtime validation.
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('4003'),

  // MongoDB
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // LLM - OpenAI (or OpenRouter)
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_BASE_URL: z.string().optional(), // Optional: set to 'https://openrouter.ai/api/v1' for OpenRouter
  // LLM - Groq (optional, kept for backward compatibility)
  GROQ_API_KEY: z.string().optional(),

  // Image Generation - Gemini
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().default('personas'),
  R2_PUBLIC_URL: z.string().min(1, 'R2_PUBLIC_URL is required'),

  // ElevenLabs (for voice matching)
  ELEVEN_API_KEY: z.string().optional(), // ElevenLabs API key for voice matching
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!config) {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('❌ Invalid environment configuration:');
      for (const error of result.error.errors) {
        console.error(`   - ${error.path.join('.')}: ${error.message}`);
      }
      process.exit(1);
    }

    config = result.data;
  }

  return config;
}
