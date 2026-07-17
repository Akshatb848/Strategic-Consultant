# ASIS v4.0 Synthesis Agent - Quick Fix Checklist

## 🔴 CRITICAL ISSUE
Synthesis agent (Agent #8) is failing because LLM providers are not configured.

---

## ⚡ Quick Fix (5 minutes)

### 1. Get Groq API Key
- [ ] Visit https://console.groq.com
- [ ] Create API key
- [ ] Copy key (format: `gsk_...`)

### 2. Create `.env` file
```bash
cp .env.example .env
```

### 3. Edit `.env` - Add ONLY these lines:
```env
GROQ_API_KEY=gsk_YOUR_KEY_HERE
ASIS_DEMO_MODE=false
ALLOW_LLM_FALLBACK=false
```

### 4. Restart services
```bash
docker-compose down
docker-compose up -d
```

### 5. Test
```bash
curl http://localhost:8000/v1/health
# Should return: {"status":"ok"}
```

---

## ✅ Verify It's Working

Run this command to test synthesis:
```bash
cd asis/backend
pytest tests/test_graph/test_v4_pipeline.py::test_synthesis -v

# Expected output: PASSED ✓
```

If you see `FAILED` or `PASSED` - check the diagnostic report below.

---

## 📋 Full Diagnostic Report

See: `PRODUCTION_DIAGNOSTIC_REPORT.md`

---

## 🔧 If It's Still Not Working

Check these in order:

1. **Is `.env` file in the right place?**
   ```bash
   ls -la .env
   # Should show: .env
   ```

2. **Is GROQ_API_KEY set?**
   ```bash
   grep GROQ_API_KEY .env | grep -v "#"
   # Should show: GROQ_API_KEY=gsk_...
   # NOT: GROQ_API_KEY= (empty)
   ```

3. **Is the API key valid?**
   ```bash
   curl -s https://api.groq.com/openai/v1/models \
     -H "Authorization: Bearer gsk_YOUR_KEY" | head -20
   # Should show model list, not error
   ```

4. **Check Docker logs**
   ```bash
   docker-compose logs backend | tail -50 | grep -i synthesis
   # Should show: llm_call_success or synthesis running
   # NOT: could not obtain live synthesis output
   ```

5. **Are demo mode and fallback disabled?**
   ```bash
   grep "ASIS_DEMO_MODE\|ALLOW_LLM_FALLBACK" .env | grep -v "#"
   # Should show:
   # ASIS_DEMO_MODE=false
   # ALLOW_LLM_FALLBACK=false
   ```

---

## 🎯 Expected Behavior After Fix

### Before Fix (FAILING)
```
Analysis Status: Analysis failed
Error: ASIS could not obtain live synthesis output from the configured LLM providers.
Agent Progress:
  ✓ Orchestrator (COMPLETED)
  ✓ Market Intel (COMPLETED)
  ✓ Risk Assessment (COMPLETED)
  ✓ Competitor Analysis (COMPLETED)
  ✓ Geo Intel (COMPLETED)
  ✓ Financial Reasoning (COMPLETED)
  ✓ Strategic Options (COMPLETED)
  ✗ Synthesis (FAILED)  ← This fails without LLM provider
```

### After Fix (WORKING)
```
Analysis Status: Complete ✓
Agent Progress:
  ✓ Orchestrator (COMPLETED)
  ✓ Market Intel (COMPLETED)
  ✓ Risk Assessment (COMPLETED)
  ✓ Competitor Analysis (COMPLETED)
  ✓ Geo Intel (COMPLETED)
  ✓ Financial Reasoning (COMPLETED)
  ✓ Strategic Options (COMPLETED)
  ✓ Synthesis (COMPLETED)  ← Synthesis completes with LLM provider
Output: [Full strategic brief with recommendations]
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `PRODUCTION_DIAGNOSTIC_REPORT.md` | Detailed root cause analysis + verification |
| `SETUP_GUIDE.md` | Step-by-step production setup guide |
| `SYNTHESIS_FIX_CHECKLIST.md` | This file - quick reference |

---

## ⚠️ Important Notes

- **`.env` should NOT be committed to Git** (add to `.gitignore`)
- **Secrets are sensitive** - keep `GROQ_API_KEY` confidential
- **Production deployment** - set `ENVIRONMENT=production` and disable fallback
- **LLM costs** - Monitor Groq API usage at https://console.groq.com

---

## 🚀 Next Steps

1. ✅ Read `PRODUCTION_DIAGNOSTIC_REPORT.md` for full context
2. ✅ Follow `SETUP_GUIDE.md` for complete setup
3. ✅ Use this checklist to verify it's working
4. ✅ Monitor synthesis output quality
5. ✅ Deploy to production when ready

---

**Last Updated:** 2026-05-12  
**Status:** Critical Configuration Issue Documented
