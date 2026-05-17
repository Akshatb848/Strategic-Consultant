**LLM Hardening Runbook**

- **Purpose:** Improve reliability when calling external LLM providers by adding timeouts, retries with jitter, Retry-After handling, and tests/fake server for simulation.

Environment variables added (defaults in `src/config/env.ts`):
- `LLM_REQUEST_TIMEOUT` (ms) — default `30000` (per-request timeout).
- `LLM_MAX_RETRIES` — default `4` (max retry attempts).
- `LLM_RETRY_BASE_MS` — default `500` (base backoff in ms).
- `LLM_RETRY_JITTER_PCT` — default `0.2` (± jitter percentage).
- `ALLOW_LLM_FALLBACK` — existing flag now honored; set to `true` to enable structured fallbacks when live LLM calls fail.

How to run the LLM tests (requires dev deps installed):

1. Install dev deps:

```bash
npm install
```

2. Run the LLM test harness (uses `tsx`):

```bash
npm run test:llm
```

Tests included in `asis/backend/tests/`:
- `fake_llm_server.ts` — fake upstream that can simulate `rate_limit`, `timeout`, `malformed`, and `ok` responses.
- `test_429_retry.ts` — simulates 429 responses and verifies fallback path.
- `test_timeout.ts` — simulates a hanging upstream and verifies timeout/retry behavior.
- `test_malformed_then_repair.ts` — simulates malformed JSON, demonstrates fallback.

Troubleshooting:
- If you see repeated `This operation was aborted` logs, increase `LLM_REQUEST_TIMEOUT` or reduce `LLM_MAX_RETRIES` to avoid long waits.
- If you see `All Groq attempts failed and ALLOW_LLM_FALLBACK is enabled`, check `ALLOW_LLM_FALLBACK` and verify whether fallback data is suitable for your pipeline; toggle off in production if you prefer fail-fast.
- Monitor logs `Groq LLM call starting` and `Groq LLM call error` to track failing attempts; instrument metrics for alerting on error rates.

Next recommended steps:
- Add a circuit-breaker/provider-health tracker to short-circuit calls to degraded providers.
- Add centralized metrics (Prometheus/Stackdriver) for latency, errors, retries, and token usage.
- Add more tests (5xx, DNS errors, Retry-After variations) and CI integration.
