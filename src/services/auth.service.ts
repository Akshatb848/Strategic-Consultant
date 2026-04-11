import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { prisma } from '../db/client.js';

// ── Password hashing ────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT token generation ─────────────────────────────────────────────────────
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  organisationId?: string | null;
  isAdmin: boolean;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES as string & jwt.SignOptions['expiresIn'] }
  );
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, type: 'refresh', jti: uuidv4() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES as string & jwt.SignOptions['expiresIn'] }
  );
}

export function verifyAccessToken(token: string): TokenPayload & { type: string } {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload & { type: string };
}

export function verifyRefreshToken(token: string): TokenPayload & { type: string; jti: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload & { type: string; jti: string };
}

// ── Token pair generation + DB storage ───────────────────────────────────────
export async function generateTokenPair(user: {
  id: string;
  email: string;
  role: string;
  organisationId: string | null;
  isAdmin: boolean;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organisationId: user.organisationId,
    isAdmin: user.isAdmin,
  };

  const accessToken = generateAccessToken(payload);
  const refreshTokenValue = uuidv4() + '.' + Date.now();
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh', jti: refreshTokenValue },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES as string & jwt.SignOptions['expiresIn'] }
  );

  // Store refresh token in DB
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { token: refreshTokenValue, userId: user.id, expiresAt },
  });

  return { accessToken, refreshToken };
}

// ── Sanitize user object (never return passwordHash) ─────────────────────────
export function sanitizeUser(user: Record<string, any>) {
  const { passwordHash, ...safe } = user;
  return safe;
}
