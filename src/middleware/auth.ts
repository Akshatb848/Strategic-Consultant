import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

// ── requireAuth middleware ────────────────────────────────────────────────────
// Extracts Bearer token, verifies JWT, attaches user to req
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid access token.',
      });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token);

    if (decoded.type !== 'access') {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid token type.',
      });
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organisationId: decoded.organisationId,
      isAdmin: decoded.isAdmin,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh.',
      });
      return;
    }
    logger.warn({ error: error.message }, 'Auth middleware: invalid token');
    res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or malformed access token.',
    });
  }
}

// ── requireAdmin middleware ──────────────────────────────────────────────────
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Admin access required.',
    });
    return;
  }
  next();
}
