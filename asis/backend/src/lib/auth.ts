import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/database';
import { z } from 'zod';
import { log } from '../lib/logger';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function generateTokenPair(userId: string): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' } as any
  );
  const refreshTokenValue = crypto.randomUUID() + '.' + Date.now();
  const refreshToken = jwt.sign(
    { userId, tokenId: refreshTokenValue, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' } as any
  );
  return { accessToken, refreshToken };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

export function sanitizeUser(user: any): Omit<typeof user, 'passwordHash'> {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'No token provided' }); return; }
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_ACCESS_SECRET || 'dev-secret') as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not found or inactive' }); return; }
    (req as any).user = user;
    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Access token expired' });
    } else {
      res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid token' });
    }
  }
}
