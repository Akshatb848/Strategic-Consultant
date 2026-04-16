# ── ASIS v4.0 Frontend ───────────────────────────────────────────────────────
# Use floating 20-bookworm-slim tag; the old pinned digest was removed from Docker Hub.
# To re-pin: docker pull node:20-bookworm-slim && docker inspect --format='{{index .RepoDigests 0}}' node:20-bookworm-slim
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY asis/frontend/package.json /app/package.json
COPY asis/frontend/package-lock.json /app/package-lock.json
COPY asis/frontend/.npmrc /app/.npmrc

RUN npm ci --include=dev

COPY asis/frontend /app

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN mkdir -p /app/public
RUN npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public

# Non-root user for security
RUN useradd -m -u 1001 nextjs && chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node server.js"]
