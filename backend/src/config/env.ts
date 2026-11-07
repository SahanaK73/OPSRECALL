// Loads and validates environment variables ONCE. Keys never leave the backend.
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.string().default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  HINDSIGHT_API_KEY: z.string().min(1, 'HINDSIGHT_API_KEY is required'),
  HINDSIGHT_BASE_URL: z.string().url().default('https://api.hindsight.vectorize.io'),
  HINDSIGHT_BANK_ID: z.string().min(1).default('opsrecall-incidents'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;
let cached: Env | null = null;

/** Lazy so unit tests can import modules without real secrets. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration. Check backend/.env\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}
