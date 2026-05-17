import assert from 'assert';
import { startFakeServer } from './fake_llm_server';

process.env.GROQ_API_BASE = 'http://localhost:4006';
process.env.GROQ_API_KEY = 'test-key';
process.env.LLM_REQUEST_TIMEOUT = '1000';
process.env.LLM_MAX_RETRIES = '2';
process.env.LLM_RETRY_BASE_MS = '100';
process.env.LLM_RETRY_JITTER_PCT = '0.05';
process.env.ALLOW_LLM_FALLBACK = 'false';

async function run() {
  const { server, stop } = await startFakeServer(4006, 'timeout');
  try {
    const mod = await import('../src/lib/llmClient');
    const call = mod.callLLMWithRetry;
    const fallback = { foo: 'fallback' };

    try {
      await call('sys', 'user', ['foo'], fallback, 'strategist', 2);
      console.error('test_timeout: expected timeout to occur but call returned');
      process.exit(1);
    } catch (err) {
      console.log('test_timeout: call failed as expected with error:', err.message || err);
    }

    await stop();
  } catch (err) {
    await stop();
    console.error('test_timeout: error', err);
    throw err;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
