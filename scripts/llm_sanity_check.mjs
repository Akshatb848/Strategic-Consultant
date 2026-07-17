import 'dotenv/config';
import { env } from '../src/config/env.js';

// This script attempts to call the asis backend Groq client to verify
// basic error handling when no GROQ_API_KEY is configured.

import(pathToFileURL(new URL('../asis/backend/src/lib/llmClient.ts', import.meta.url).pathname))
  .then((mod) => mod.callLLMWithRetry)
  .catch((err) => {
    console.error('Failed to import llmClient:', err?.message || err);
    process.exit(2);
  });

function pathToFileURL(p) {
  return 'file://' + p.replace(/\\/g, '/');
}

// NOTE: This script is a lightweight helper — run with `node --experimental-specifier-resolution=node scripts/llm_sanity_check.mjs`
