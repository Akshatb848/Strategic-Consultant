# ── ASIS v4.0 Backend ──────────────────────────────────────────────
# Image digest pinned for reproducible builds.
# To update: docker pull python:3.11-slim && docker inspect --format='{{index .RepoDigests 0}}' python:3.11-slim
FROM python:3.11-slim@sha256:233de06753d30d120b1a3ce359d8d3be8bda78524cd8f520c99883bfe33964cf

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY asis/backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY asis/backend /app/asis/backend

WORKDIR /app/asis/backend
ENV PYTHONPATH=/app/asis/backend

# Non-root user for security
RUN useradd -m -u 1001 asis && chown -R asis:asis /app
USER asis

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8000/v1/health || exit 1

# Single worker: the e2-micro (1 GB RAM) can't comfortably run two full Python
# processes each loading the LangGraph pipeline. One worker handles all demo
# traffic without OOM risk.
CMD ["uvicorn", "asis.backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
