import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('4002'),
  PERSONA_BUILDER_URL: z.string().default('http://localhost:4003'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment configuration:');
      for (const error of result.error.errors) {
        console.error(`   - ${error.path.join('.')}: ${error.message}`);
      }
      process.exit(1);
    }
    config = result.data;
  }
  return config;
}
