# ASIS v4.0 Production Environment Setup Guide

This guide will fix the Synthesis agent failure and prepare ASIS for enterprise deployment.

## Step 1: Choose Your LLM Provider Strategy

### Option A: Groq Direct (Fastest Setup)
**Pros:** Simple, fast, one API key  
**Cons:** Limited to Groq models, no fallback options

**Setup time:** 5 minutes

```bash
# Get API key from https://console.groq.com
# Then set environment variables:
export GROQ_API_KEY="gsk_YOUR_KEY_HERE"
export ASIS_DEMO_MODE="false"
export ALLOW_LLM_FALLBACK="false"
```

---

### Option B: LiteLLM Proxy (Recommended for Enterprise)
**Pros:** Multi-provider support, load balancing, cost optimization  
**Cons:** Requires Docker/deployed proxy service

**Setup time:** 30-60 minutes (including proxy deployment)

```bash
# Deploy LiteLLM proxy (via Docker or managed service)
# Then set:
export LITELLM_PROXY_URL="http://litellm:4000"
export LITELLM_MASTER_KEY="YOUR_MASTER_KEY"
export ASIS_DEMO_MODE="false"
export ALLOW_LLM_FALLBACK="false"
```

---

### Option C: Hybrid (Both Groq + LiteLLM)
**Pros:** Maximum resilience, multi-provider fallback  
**Cons:** Most complex setup

```bash
# Set both:
export LITELLM_PROXY_URL="http://litellm:4000"
export LITELLM_MASTER_KEY="YOUR_MASTER_KEY"
export GROQ_API_KEY="gsk_YOUR_KEY_HERE"
export ASIS_DEMO_MODE="false"
export ALLOW_LLM_FALLBACK="false"
```

---

## Step 2: Create `.env` File

Copy the template below and fill in your credentials:

```env
# ═══════════════════════════════════════════════════════════════════════════
# ASIS v4.0 Production Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────
# APPLICATION CORE
# ─────────────────────────────────────────────────────────────────────────
APP_NAME=ASIS
APP_VERSION=4.0.0
ENVIRONMENT=production
DEBUG=false

# ─────────────────────────────────────────────────────────────────────────
# FRONTEND & API
# ─────────────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3001
FRONTEND_INTERNAL_URL=http://frontend:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001

# ─────────────────────────────────────────────────────────────────────────
# DATABASE (PostgreSQL for production)
# ─────────────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+psycopg://asis:asis@postgres:5432/asis

# ─────────────────────────────────────────────────────────────────────────
# AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────
JWT_SECRET=replace-with-a-64-character-random-secret-for-production
ACCESS_TOKEN_EXPIRY_MINUTES=15
REFRESH_TOKEN_EXPIRY_DAYS=7
SECURE_COOKIES=true

# ─────────────────────────────────────────────────────────────────────────
# CACHE & MESSAGE QUEUE (Redis)
# ─────────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
RUN_ANALYSES_INLINE=false
LOCAL_WORKER_CONCURRENCY=4

# ═══════════════════════════════════════════════════════════════════════════
# 🔴 CRITICAL: LLM PROVIDER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════
# MUST SET ONE OR BOTH OF:
#   1. GROQ_API_KEY (for Groq direct access)
#   2. LITELLM_PROXY_URL + LITELLM_MASTER_KEY (for LiteLLM proxy)
# 
# Without these, Synthesis agent will FAIL and analysis will be incomplete.
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────
# Option 1: GROQ (Direct API Access)
# ─────────────────────────────────────────────────────────────────────────
# Get API key: https://console.groq.com/keys
# 
GROQ_API_KEY=gsk_YOUR_API_KEY_HERE
GROQ_API_BASE=https://api.groq.com/openai/v1
GROQ_MODEL_PRIMARY=llama-3.3-70b-versatile
GROQ_MODEL_FAST=llama-3.1-8b-instant
GROQ_MODEL_REASONING=llama-3.3-70b-versatile

# ─────────────────────────────────────────────────────────────────────────
# Option 2: LITELLM PROXY (Multi-provider)
# ─────────────────────────────────────────────────────────────────────────
# Deploy LiteLLM proxy and get master key
# URL should point to your LiteLLM service (Docker/K8s/managed)
# 
LITELLM_PROXY_URL=http://litellm:4000
LITELLM_MASTER_KEY=YOUR_LITELLM_MASTER_KEY_HERE

# ─────────────────────────────────────────────────────────────────────────
# LiteLLM Model Definitions
# ─────────────────────────────────────────────────────────────────────────
# Configure which models LiteLLM should use via proxy
LITELLM_MODEL_PRIMARY=claude-sonnet-4-5
LITELLM_MODEL_FAST=claude-haiku-4-5
LITELLM_MODEL_GEMINI_PRO=gemini-2.5-pro
LITELLM_MODEL_GEMINI_FLASH=gemini-2.0-flash
LITELLM_MODEL_PHI_REASONING=phi-4-reasoning
LITELLM_MODEL_QWEN_STRATEGY=qwen-strategy
LITELLM_MODEL_ARCTIC_RESEARCH=arctic-research
LITELLM_MODEL_LLAMA_GOVERNANCE=llama-governance

# ─────────────────────────────────────────────────────────────────────────
# AGENT-SPECIFIC MODEL OVERRIDES (Optional)
# ─────────────────────────────────────────────────────────────────────────
# Override models for specific agents. Leave commented if using defaults.
# 
# AGENT_MODEL_ORCHESTRATOR=claude-haiku-4-5
# AGENT_MODEL_ORCHESTRATOR_FALLBACK=gemini-2.0-flash
# AGENT_MODEL_ORCHESTRATOR_OPEN=qwen-strategy
# AGENT_MODEL_STRATEGIST=gemini-2.5-pro
# AGENT_MODEL_STRATEGIST_FALLBACK=claude-sonnet-4-5
# AGENT_MODEL_QUANT=gemini-2.5-pro
# AGENT_MODEL_QUANT_FALLBACK=phi-4-reasoning

# ─────────────────────────────────────────────────────────────────────────
# EMBEDDING MODEL
# ─────────────────────────────────────────────────────────────────────────
EMBEDDING_MODEL=text-embedding-3-small

# ═══════════════════════════════════════════════════════════════════════════
# PRODUCTION MODE SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

# CRITICAL: Set to 'false' to disable fallback scaffolds
# When false: Synthesis WILL FAIL if LLM is unavailable (recommended)
# When true: Synthesis will return incomplete scaffold (not recommended)
ASIS_DEMO_MODE=false

# CRITICAL: Set to 'false' to require valid LLM provider
# When false: Analysis fails if no LLM can be reached (recommended)
# When true: Falls back to demo scaffold if LLM fails
ALLOW_LLM_FALLBACK=false

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: Advanced Search & Intelligence APIs
# ─────────────────────────────────────────────────────────────────────────
# Get keys from:
#   - Tavily: https://tavily.com
#   - NewsAPI: https://newsapi.org
#   - FMP: https://financialmodelingprep.com
#   - Mem0: https://mem0.ai
#   - Qdrant: https://qdrant.io
# 
# TAVILY_API_KEY=tvly_YOUR_KEY_HERE
# NEWSAPI_KEY=YOUR_KEY_HERE
# FMP_API_KEY=YOUR_KEY_HERE
# MEM0_API_KEY=YOUR_KEY_HERE
# MEM0_BASE_URL=https://api.mem0.ai
# QDRANT_URL=http://qdrant:6333
# QDRANT_API_KEY=YOUR_KEY_HERE

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: Observability & Monitoring
# ─────────────────────────────────────────────────────────────────────────
# LANGFUSE_ENABLED=false
# LANGFUSE_PUBLIC_KEY=YOUR_KEY_HERE
# LANGFUSE_SECRET_KEY=YOUR_KEY_HERE
# LANGFUSE_HOST=https://cloud.langfuse.com

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: OAuth2 (Google, GitHub)
# ─────────────────────────────────────────────────────────────────────────
# GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
# GOOGLE_CLIENT_SECRET=YOUR_SECRET
# GOOGLE_CALLBACK_URL=http://localhost:8000/api/v1/auth/google/callback
# GITHUB_CLIENT_ID=YOUR_CLIENT_ID
# GITHUB_CLIENT_SECRET=YOUR_SECRET
# GITHUB_CALLBACK_URL=http://localhost:8000/api/v1/auth/github/callback

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: Report Customization
# ─────────────────────────────────────────────────────────────────────────
# REPORT_COMPANY_LOGO_URL=https://your-cdn.com/logo.png

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: PDF Rendering
# ─────────────────────────────────────────────────────────────────────────
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# PDF_MAX_PAGES=60

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: SSE Configuration
# ─────────────────────────────────────────────────────────────────────────
SSE_PING_SECONDS=10

# ─────────────────────────────────────────────────────────────────────────
# OPTIONAL: Cost Tracking
# ─────────────────────────────────────────────────────────────────────────
COST_TRACKING_ENABLED=true

# ─────────────────────────────────────────────────────────────────────────
# RATE LIMITING
# ─────────────────────────────────────────────────────────────────────────
RATE_LIMIT_ANALYSES_PER_DAY=20
RATE_LIMIT_ANALYSES_PER_MINUTE=2
```

---

## Step 3: Verify Configuration

### Checklist:

- [ ] `.env` file created in project root
- [ ] At least ONE of these is configured:
  - [ ] `GROQ_API_KEY` is set (not empty)
  - [ ] `LITELLM_PROXY_URL` and `LITELLM_MASTER_KEY` are set
- [ ] `ASIS_DEMO_MODE=false`
- [ ] `ALLOW_LLM_FALLBACK=false`
- [ ] `DATABASE_URL` points to valid database
- [ ] `REDIS_URL` points to running Redis
- [ ] File is NOT in Git (add to `.gitignore`)

---

## Step 4: Test the Configuration

### Test 1: Verify settings are loaded
```bash
# Should show LLM provider is configured
python3 -c "from asis.backend.config.settings import get_settings; s=get_settings(); print(f'Groq API Key Set: {bool(s.groq_api_key)}'); print(f'LiteLLM Proxy URL: {s.litellm_proxy_url}'); print(f'Demo Mode: {s.demo_mode}'); print(f'Allow Fallback: {s.allow_llm_fallback}')"
```

### Test 2: Run validation tests
```bash
cd asis/backend
pytest tests/test_production_fixes.py -v

# Should show: "8 passed" (all 8 validation tests)
```

### Test 3: Test synthesis agent specifically
```bash
cd asis/backend
pytest tests/test_graph/test_v4_pipeline.py -v -k synthesis

# Should show: synthesis test passes
```

### Test 4: Test full pipeline
```bash
cd asis/backend
pytest tests/test_graph/test_v4_pipeline.py::test_full_pipeline -v

# Should show: all agents complete, synthesis returns valid JSON
```

---

## Step 5: Deploy & Monitor

### Pre-deployment:
```bash
# Verify no defaults are being used
grep -E "GROQ_API_KEY|LITELLM_PROXY_URL" .env | grep -v "#" | grep -v "^$"

# Should output your actual credentials, not empty strings
```

### Deployment:
```bash
# Load .env and start services
docker-compose up -d

# Monitor logs
docker-compose logs -f backend

# Check synthesis is working
curl -X POST http://localhost:8000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"query": "Should we expand to Europe?", "company_context": {...}}'

# Should return analysis with synthesis data (not error)
```

### Post-deployment:
```bash
# Monitor synthesis agent
docker-compose logs backend | grep -i synthesis

# Check for errors
docker-compose logs backend | grep -E "ERROR|FAILED|could not obtain"

# If no errors, synthesis is working!
```

---

## Troubleshooting

### Error: "ASIS could not obtain live synthesis output"

**Cause:** LLM provider not configured  
**Fix:** Check `.env` has `GROQ_API_KEY` or `LITELLM_PROXY_URL` + `LITELLM_MASTER_KEY`

### Error: "could not reach LiteLLM proxy"

**Cause:** Proxy not running or wrong URL  
**Fix:** 
1. Verify LiteLLM is running: `curl http://litellm:4000/health`
2. Check URL in `.env` is correct
3. Check networking (Docker, K8s, firewall)

### Error: "Groq API key invalid"

**Cause:** Wrong API key  
**Fix:**
1. Get new key from https://console.groq.com
2. Verify key format (starts with `gsk_`)
3. Check for trailing whitespace in `.env`

### Synthesis returns incomplete analysis

**Cause:** `ASIS_DEMO_MODE=true` or `ALLOW_LLM_FALLBACK=true`  
**Fix:** Set both to `false` in `.env`

---

## Production Deployment Checklist

Before going live to GCP (34.30.157.38):

- [ ] `.env` configured with production credentials
- [ ] Database initialized and backed up
- [ ] Redis is running and persistent
- [ ] LLM provider tested and working
- [ ] All agents passing tests
- [ ] Synthesis agent produces valid output
- [ ] Error handling verified
- [ ] Monitoring configured (Langfuse/observability)
- [ ] Secrets are NOT in Git
- [ ] Environment is set to `production`
- [ ] Demo mode is disabled
- [ ] LLM fallback is disabled
- [ ] Rate limits configured
- [ ] Cost tracking enabled
- [ ] Logs are collected and monitored

---

## Contact & Support

For issues or questions:
1. Check logs: `docker-compose logs backend | grep -i synthesis`
2. Review this guide again
3. Check `.env` file is properly configured
4. Verify LLM provider is reachable and has credits/quota

