import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { initSocketIO } from './lib/socketio';
import { log } from './lib/logger';
import authRoutes from './routes/auth.routes';
import analysisRoutes from './routes/analysis.routes';
import reportsRoutes from './routes/reports.routes';
import memoryRoutes from './routes/memory.routes';
import patentRoutes from './routes/patent.routes';
import dissertationRoutes from './routes/dissertation.routes';

const app = express();
const httpServer = http.createServer(app);

initSocketIO(httpServer);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "https://avatars.githubusercontent.com"],
      connectSrc: ["'self'", process.env.ALLOWED_ORIGINS || 'http://34.172.33.24:3000', "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://34.172.33.24:3000').split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { code: 'RATE_LIMITED', message: 'Rate limit exceeded.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Wait 15 minutes.' } });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { code: 'TOO_MANY_SIGNUPS', message: 'Too many signups from this IP. Try again later.' } });

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/auth/signup', signupLimiter);
// Legacy path compatibility
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/signup', signupLimiter);

// v1 routes (primary)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/memory', memoryRoutes);
app.use('/api/v1/patent', patentRoutes);
app.use('/api/v1/dissertation', dissertationRoutes);

// Legacy routes (backwards-compat)
app.use('/api/auth', authRoutes);
app.use('/api/analyses', analysisRoutes);

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', version: '4.0.0', environment: process.env.NODE_ENV || 'production', features: ['web-search', 'semantic-memory', 'patent-analysis', 'dissertation-scaffold', 'llm-judge-cove'] }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '4.0.0', environment: process.env.NODE_ENV || 'production' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.name === 'ZodError') return res.status(400).json({ code: 'VALIDATION_ERROR', errors: err.flatten().fieldErrors });
  if (err.code === 'P2002') return res.status(409).json({ code: 'ALREADY_EXISTS', message: 'This email is already registered.' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Access token expired' });
  if (err.message?.includes('CORS')) return res.status(403).json({ code: 'CORS_FORBIDDEN', message: 'Origin not allowed' });
  log.error('Unhandled error:', { message: err.message, stack: err.stack });
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
});

const PORT = parseInt(process.env.PORT || '8000');
httpServer.listen(PORT, '0.0.0.0', () => {
  log.info(`ASIS v4.0 backend running on port ${PORT}`);
  log.info(`Environment: ${process.env.NODE_ENV || 'production'}`);
  log.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
  log.info(`Database: Neon PostgreSQL (SSL required)`);
  log.info(`Redis: Cloud Redis (connected)`);
});

export default app;
