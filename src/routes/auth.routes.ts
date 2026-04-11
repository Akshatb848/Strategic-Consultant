import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import passport from '../lib/passport.js';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import {
  hashPassword,
  generateTokenPair,
  verifyRefreshToken,
  sanitizeUser,
} from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, signupLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  title: z.string().max(100).optional(),
  organisation: z.string().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── POST /api/auth/signup ────────────────────────────────────────────────────
router.post(
  '/signup',
  signupLimiter,
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, title, organisation } = req.body;

      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
      if (existing) {
        res.status(409).json({
          code: 'ALREADY_EXISTS',
          message: 'An account with this email already exists. Please sign in instead.',
        });
        return;
      }

      // Create user
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          title: title?.trim() || '',
          organisation: organisation?.trim() || '',
          avatarInitials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
          authProvider: 'email',
          lastLoginAt: new Date(),
        },
      });

      const { accessToken, refreshToken } = await generateTokenPair(user);
      setRefreshCookie(res, refreshToken);

      logger.info({ userId: user.id, email: user.email }, 'New user registered');

      res.status(201).json({
        user: sanitizeUser(user),
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      // SAME error for "not found" and "wrong password" — prevents enumeration
      const authError = () => {
        res.status(401).json({
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password. Please check your credentials and try again.',
        });
      };

      if (!user || !user.isActive) {
        authError();
        return;
      }

      // OAuth user trying email login
      if (!user.passwordHash) {
        res.status(401).json({
          code: 'USE_OAUTH',
          message: `This account uses ${user.authProvider} sign-in. Please use the ${user.authProvider} button.`,
        });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        authError();
        return;
      }

      // Credentials correct — issue tokens
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const { accessToken, refreshToken } = await generateTokenPair(user);
      setRefreshCookie(res, refreshToken);

      logger.info({ userId: user.id }, 'User logged in');

      res.status(200).json({
        user: sanitizeUser(user),
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshCookie = req.cookies?.refresh_token;
    if (!refreshCookie) {
      res.status(401).json({
        code: 'NO_REFRESH_TOKEN',
        message: 'No refresh token provided.',
      });
      return;
    }

    // Verify JWT
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshCookie);
    } catch {
      res.status(401).json({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired. Please sign in again.',
      });
      return;
    }

    // Check if token exists in DB (not revoked)
    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: decoded.jti, userId: decoded.userId },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Token was revoked or expired — force re-login
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      res.status(401).json({
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'Session expired. Please sign in again.',
      });
      return;
    }

    // Rotate: delete old, create new
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      res.status(401).json({
        code: 'USER_INACTIVE',
        message: 'Account is no longer active.',
      });
      return;
    }

    const { accessToken, refreshToken } = await generateTokenPair(user);
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Delete ALL refresh tokens for this user (all devices)
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user!.userId },
    });

    // Clear cookie
    res.clearCookie('refresh_token', { path: '/api/auth' });

    logger.info({ userId: req.user!.userId }, 'User logged out');

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        org: { select: { id: true, name: true, plan: true, logoUrl: true, primaryColor: true } },
      },
    });

    if (!user) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'User not found.' });
      return;
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=google_failed`,
  }),
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const { accessToken, refreshToken } = await generateTokenPair(user);
    setRefreshCookie(res, refreshToken);
    res.redirect(`${env.FRONTEND_URL}/oauth/callback#token=${accessToken}&provider=google`);
  }
);

// ── GitHub OAuth ─────────────────────────────────────────────────────────────
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=github_failed`,
  }),
  async (req: Request, res: Response) => {
    const user = req.user as any;
    const { accessToken, refreshToken } = await generateTokenPair(user);
    setRefreshCookie(res, refreshToken);
    res.redirect(`${env.FRONTEND_URL}/oauth/callback#token=${accessToken}&provider=github`);
  }
);

// ── Helper: Set httpOnly refresh cookie ──────────────────────────────────────
function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
}

export default router;
