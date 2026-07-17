import { startFakeServer } from './fake_llm_server';

process.env.GROQ_API_BASE = 'http://localhost:4007';
process.env.GROQ_API_KEY = 'test-key';
process.env.LLM_REQUEST_TIMEOUT = '5000';
process.env.LLM_MAX_RETRIES = '3';
process.env.ALLOW_LLM_FALLBACK = 'true';

async function run() {
  const { server, stop } = await startFakeServer(4007, 'malformed');
  try {
    const mod = await import('../src/lib/llmClient');
    const call = mod.callLLMWithRetry;
    const fallback = { verification_checks: [], logic_consistent: true, recommendation: 'PASS', overall_verification_score: 50 };

    const res = await call('sys', 'user', ['foo'], fallback, 'strategist', 2);
    if (res.usedFallback) {
      console.log('test_malformed_then_repair: used fallback');
    } else {
      console.log('test_malformed_then_repair: received data', res.data);
    }

    await stop();
  } catch (err) {
    await stop();
    console.error('test_malformed_then_repair: error', err);
    throw err;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
