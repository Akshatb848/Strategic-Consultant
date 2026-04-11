import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from '../lib/database';
import { generateTokenPair, setRefreshCookie, sanitizeUser, requireAuth, signupSchema, loginSchema } from '../lib/auth';
import { log } from '../lib/logger';

const router = Router();

let googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
let githubConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

if (googleConfigured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      let user = await prisma.user.findFirst({ where: { OR: [{ googleId: profile.id }, { email: profile.emails?.[0]?.value || '' }] } });
      if (!user && profile.emails?.[0]?.value) {
        user = await prisma.user.create({
          data: {
            email: profile.emails[0].value,
            googleId: profile.id,
            authProvider: 'google',
            firstName: profile.name?.givenName || 'User',
            lastName: profile.name?.familyName || '',
            avatarInitials: ((profile.name?.givenName || 'U')[0] + (profile.name?.familyName || 'U')[0]).toUpperCase(),
          }
        });
      }
      done(null, user);
    } catch (err) { done(err as Error); }
  }));
}

if (githubConfigured) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
    scope: ['user:email'],
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      let user = await prisma.user.findFirst({ where: { OR: [{ githubId: profile.id }, { email: email || '' }] } });
      if (!user && email) {
        user = await prisma.user.create({
          data: {
            email,
            githubId: profile.id,
            authProvider: 'github',
            firstName: profile.displayName?.split(' ')[0] || 'User',
            lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
            avatarUrl: profile.photos?.[0]?.value,
            avatarInitials: (profile.displayName || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
          }
        });
      }
      done(null, user);
    } catch (err) { done(err as Error); }
  }));
}

router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors }); return; }
    const { email, password, firstName, lastName } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) { res.status(409).json({ code: 'ALREADY_EXISTS', message: 'Email already registered' }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        authProvider: 'email',
        avatarInitials: (firstName[0] + lastName[0]).toUpperCase(),
      }
    });
    const { accessToken, refreshToken } = generateTokenPair(user.id);
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });
    setRefreshCookie(res, refreshToken);
    log.info('User signed up', { userId: user.id, email: user.email });
    res.status(201).json({ user: sanitizeUser(user), accessToken });
  } catch (err) { next(err); }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors }); return; }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const authError = () => res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password. Please check your credentials and try again.' });
    if (!user || !user.isActive) return authError();
    if (!user.passwordHash) return res.status(401).json({ code: 'USE_OAUTH', message: `This account uses ${user.authProvider} sign-in. Please use the ${user.authProvider} button.` });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return authError();
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const { accessToken, refreshToken } = generateTokenPair(user.id);
    setRefreshCookie(res, refreshToken);
    log.info('User logged in', { userId: user.id, email: user.email });
    res.json({ user: sanitizeUser(user), accessToken });
  } catch (err) { next(err); }
});

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.refreshToken.deleteMany({ where: { userId: (req as any).user.id } });
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ message: 'Logged out successfully' });
  } catch (_err: unknown) { res.status(500).json({ code: 'LOGOUT_ERROR', message: 'Logout failed' }); }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) { res.status(401).json({ code: 'NO_REFRESH_TOKEN', message: 'No refresh token' }); return; }
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dev-secret') as { userId: string };
    const stored = await prisma.refreshToken.findFirst({ where: { token: refreshToken, userId: decoded.userId } });
    if (!stored || stored.expiresAt < new Date()) { res.status(401).json({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token expired or revoked' }); return; }
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const { accessToken, refreshToken: newRefresh } = generateTokenPair(decoded.userId);
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: newRefresh, userId: decoded.userId, expiresAt } });
    setRefreshCookie(res, newRefresh);
    res.json({ accessToken });
  } catch (_err: unknown) { res.status(401).json({ code: 'REFRESH_FAILED', message: 'Token refresh failed' }); }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({ user: sanitizeUser((req as any).user) });
});

if (googleConfigured) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed` }),
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      if (!user) { res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`); return; }
      const { accessToken, refreshToken } = generateTokenPair(user.id);
      setRefreshCookie(res, refreshToken);
      res.redirect(`${process.env.FRONTEND_URL}/oauth/callback#token=${accessToken}&provider=google`);
    }
  );
}

if (githubConfigured) {
  router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
  router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=github_failed` }),
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      if (!user) { res.redirect(`${process.env.FRONTEND_URL}/login?error=github_failed`); return; }
      const { accessToken, refreshToken } = generateTokenPair(user.id);
      setRefreshCookie(res, refreshToken);
      res.redirect(`${process.env.FRONTEND_URL}/oauth/callback#token=${accessToken}&provider=github`);
    }
  );
}

export default router;
