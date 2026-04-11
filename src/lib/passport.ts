import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// ── Passport serialization ───────────────────────────────────────────────────
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ── Google OAuth Strategy ────────────────────────────────────────────────────
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Find or create user
          let user = await prisma.user.findFirst({
            where: { OR: [{ googleId: profile.id }, { email }] },
          });

          if (user) {
            // Link Google ID if not already linked
            if (!user.googleId) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: profile.id,
                  avatarUrl: profile.photos?.[0]?.value,
                  lastLoginAt: new Date(),
                },
              });
            } else {
              await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
              });
            }
          } else {
            // Create new user
            const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
            const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
            user = await prisma.user.create({
              data: {
                email,
                googleId: profile.id,
                firstName,
                lastName,
                avatarInitials: `${firstName[0]}${lastName[0] || ''}`.toUpperCase(),
                avatarUrl: profile.photos?.[0]?.value,
                authProvider: 'google',
                emailVerified: true,
                lastLoginAt: new Date(),
              },
            });
          }

          done(null, user);
        } catch (error) {
          logger.error({ error }, 'Google OAuth error');
          done(error as Error, undefined);
        }
      }
    )
  );
  logger.info('✅ Google OAuth strategy configured');
} else {
  logger.warn('⚠️  Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET)');
}

// ── GitHub OAuth Strategy ────────────────────────────────────────────────────
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: env.GITHUB_CALLBACK_URL,
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value || `${profile.username}@github.noemail`;

          let user = await prisma.user.findFirst({
            where: { OR: [{ githubId: profile.id }, { email }] },
          });

          if (user) {
            if (!user.githubId) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  githubId: profile.id,
                  avatarUrl: profile.photos?.[0]?.value,
                  lastLoginAt: new Date(),
                },
              });
            } else {
              await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
              });
            }
          } else {
            const displayName = profile.displayName || profile.username || 'User';
            const nameParts = displayName.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';
            user = await prisma.user.create({
              data: {
                email,
                githubId: profile.id,
                firstName,
                lastName,
                avatarInitials: `${firstName[0]}${lastName[0] || ''}`.toUpperCase(),
                avatarUrl: profile.photos?.[0]?.value,
                authProvider: 'github',
                emailVerified: true,
                lastLoginAt: new Date(),
              },
            });
          }

          done(null, user);
        } catch (error) {
          logger.error({ error }, 'GitHub OAuth error');
          done(error as Error, null);
        }
      }
    )
  );
  logger.info('✅ GitHub OAuth strategy configured');
} else {
  logger.warn('⚠️  GitHub OAuth not configured (missing GITHUB_CLIENT_ID/SECRET)');
}

export default passport;
