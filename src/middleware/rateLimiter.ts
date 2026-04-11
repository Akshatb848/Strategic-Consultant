import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// ── Rate limiters per route group ────────────────────────────────────────────

export const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const signupLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_SIGNUP_WINDOW_MS,
  max: env.RATE_LIMIT_SIGNUP_MAX,
  message: {
    code: 'TOO_MANY_SIGNUPS',
    message: 'Too many signup attempts from this IP. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  max: env.RATE_LIMIT_API_MAX,
  message: {
    code: 'RATE_LIMITED',
    message: 'Rate limit exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
