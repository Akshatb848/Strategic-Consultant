FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*

COPY asis/backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY asis/backend /app/asis/backend

WORKDIR /app/asis/backend
ENV PYTHONPATH=/app/asis/backend

EXPOSE 8000

CMD ["uvicorn", "asis.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

