# ASIS v4.0

ASIS is an enterprise strategic decision intelligence platform. It accepts a board-level question plus company context, runs an 8-agent LangGraph workflow, and returns a cited strategic brief with market analysis, financial reasoning, risk, Red Team challenge, CoVe verification, and synthesis.

## Active Application Surface

- `asis/backend` - Python 3.11, FastAPI, LangGraph, SQLAlchemy, Celery, LiteLLM
- `asis/frontend` - Next.js 14 App Router, in-memory auth, SSE-driven analysis detail view
- `asis/n8n/workflows` - automation exports for scheduled briefs, webhooks, delivery, and alert monitoring
- `asis/infra` - Cloud Build and Terraform deployment assets

Legacy root-level `src/`, `frontend/`, and other TypeScript draft assets are treated as reference material, not the canonical production stack.

## Architecture

The production pipeline is:

`START -> Orchestrator -> Strategist -> [Quant + Market Intel] -> Risk -> [Red Team + Ethicist] -> CoVe -> Synthesis -> END`

CoVe is the source of truth for overall confidence. If verification fails, CoVe can route back to one upstream node for up to two self-correction attempts.

## Model Routing

The backend now supports agent-specific model profiles through LiteLLM aliases.

Default enterprise routes:

- `orchestrator` -> `claude-haiku-4-5`
- `strategist` -> `gemini-2.5-pro`
- `quant` -> `gemini-2.5-pro`
- `market_intel` -> `gemini-2.0-flash`
- `risk` -> `claude-sonnet-4-5`
- `red_team` -> `claude-sonnet-4-5`
- `ethicist` -> `claude-sonnet-4-5`
- `cove` -> `gemini-2.5-pro`
- `synthesis` -> `claude-sonnet-4-5`

Open-model fallbacks, chosen from the [open-llms](https://github.com/eugeneyan/open-llms) landscape and wired as optional OpenAI-compatible aliases:

- `qwen-strategy`
- `phi-4-reasoning`
- `arctic-research`
- `llama-governance`

## Local Development

1. Copy `.env.example` to `.env` and fill in secrets.
2. Backend:
   `cd asis/backend`
   `python -m pip install -r requirements.txt`
   `uvicorn asis.backend.main:app --reload --host 0.0.0.0 --port 8000`
3. Frontend:
   `cd asis/frontend`
   `npm install`
   `npm run dev`
4. Optional full stack:
   `docker compose up --build`

## GCP Free-Tier VM Deployment

For the lowest-cost GCP deployment, use the single-VM path instead of the managed `asis/infra` stack. The free-tier path deploys only the canonical `asis/backend` and `asis/frontend` applications, stores data in SQLite on the VM, and runs analyses in demo mode with inline execution.

Included assets:

- `docker-compose.gcp-free.yml`
- `.env.gcp.example`
- `scripts/gcp-free-bootstrap.sh`
- `docs/gcp-free-tier.md`
- `.github/workflows/deploy-gcp-free.yml`

Use this path when you want one always-free Compute Engine VM and do **not** want to provision Cloud SQL, Memorystore, Artifact Registry, or Cloud Run.

## API Reference

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/github`
- `GET /api/v1/auth/github/callback`

### Analysis

- `POST /api/v1/analysis`
- `GET /api/v1/analysis`
- `GET /api/v1/analysis/{id}`
- `GET /api/v1/analysis/{id}/events`

### Reports

- `GET /api/v1/reports`
- `GET /api/v1/reports/{id}`
- `GET /api/v1/reports/{id}/evaluation`
- `DELETE /api/v1/reports/{id}`

### Memory

- `GET /api/v1/memory`
- `DELETE /api/v1/memory`

### System

- `GET /v1/health`
- `GET /v1/metrics`

## CI/CD

GitHub Actions now provides:

- `.github/workflows/ci.yml` - backend pytest + frontend TypeScript validation
- `.github/workflows/deploy.yml` - `ubuntu-latest` runner, Google auth, and Cloud Build submission for backend and frontend

Cloud Build deployment definitions live in:

- `asis/infra/cloudbuild/cloudbuild.backend.yaml`
- `asis/infra/cloudbuild/cloudbuild.frontend.yaml`

## Infrastructure

Terraform definitions are included for:

- Artifact Registry
- Cloud SQL Postgres
- Memorystore Redis
- Cloud Run backend/frontend
- Secret Manager
- Deploy service account IAM bindings

## Verification

Validated locally during migration:

- `python -m pytest asis/backend/tests -q`
- `npm run type-check` in `asis/frontend`
