import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { createServer } from 'http';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { initSocketIO } from './lib/socketManager.js';
import passport from './lib/passport.js';

// Routes
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import reportsRoutes from './routes/reports.routes.js';

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// ── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://avatars.githubusercontent.com'],
        connectSrc: ["'self'", env.FRONTEND_URL, 'wss:', 'ws:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session (for Passport OAuth flows) ───────────────────────────────────────
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24h
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Request logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.url !== '/api/health') {
    logger.debug({ method: req.method, url: req.url }, 'Request');
  }
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/reports', reportsRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'The requested endpoint does not exist.',
  });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Socket.IO ────────────────────────────────────────────────────────────────
initSocketIO(httpServer);

// ── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await connectDatabase();

  httpServer.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        version: env.APP_VERSION,
      },
      `⚡ ${env.APP_NAME} v${env.APP_VERSION} listening on port ${env.PORT}`
    );
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully...');
  httpServer.close(async () => {
    await disconnectDatabase();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced exit after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ────────────────────────────────────────────────────────────────────
start().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});

export default app;
