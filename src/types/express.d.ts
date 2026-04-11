// ── Express.js type augmentation ─────────────────────────────────────────────

declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      email: string;
      role: string;
      organisationId?: string | null;
      isAdmin: boolean;
    };
  }
}
