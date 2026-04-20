import { z } from 'zod';

// ── Validated environment configuration ──────────────────────────────────────
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:8000'),
  // Comma-separated list of allowed CORS origins (used in production docker-compose)
  ALLOWED_ORIGINS: z.string().optional(),
  APP_NAME: z.string().default('ASIS'),
  APP_VERSION: z.string().default('4.0.0'),

  // Database
  DATABASE_URL: z.string().default('file:./dev.db'),

  // JWT
  JWT_ACCESS_SECRET: z.string().default('dev-access-secret-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-in-production'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // Session
  SESSION_SECRET: z.string().default('dev-session-secret-change-in-production'),

  // OAuth — Google (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:8000/api/auth/google/callback'),

  // OAuth — GitHub (optional)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().default('http://localhost:8000/api/auth/github/callback'),

  // LLM — Groq (Free Tier, OpenAI-compatible)
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
  // Alias used in docker-compose.gcp-free.yml
  GROQ_API_BASE: z.string().optional(),

  // Per-agent model routing
  LLM_MODEL_STRATEGIST: z.string().default('qwen/qwen3-32b'),
  LLM_MODEL_QUANT: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
  LLM_MODEL_MARKET_INTEL: z.string().default('qwen/qwen3-32b'),
  LLM_MODEL_RISK: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
  LLM_MODEL_RED_TEAM: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
  LLM_MODEL_ETHICIST: z.string().default('qwen/qwen3-32b'),
  LLM_MODEL_COVE: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
  LLM_MODEL_SYNTHESIS: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
  LLM_MODEL_CONTEXT_EXTRACTOR: z.string().default('meta-llama/llama-3.1-8b-instant'),
  LLM_MAX_TOKENS: z.coerce.number().default(4096),

  // Redis (optional — falls back to in-memory)
  REDIS_URL: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_SIGNUP_MAX: z.coerce.number().default(5),
  RATE_LIMIT_SIGNUP_WINDOW_MS: z.coerce.number().default(3600000),
  RATE_LIMIT_API_MAX: z.coerce.number().default(200),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().default(60000),
});

// Parse and validate — crashes on startup if invalid (fail fast)
function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
