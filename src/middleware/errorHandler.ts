import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// ── Global error handler ─────────────────────────────────────────────────────
// Must be registered LAST in Express middleware chain

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // Custom application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
    return;
  }

  // Prisma unique constraint violations
  if ((err as any).code === 'P2002') {
    const target = (err as any).meta?.target;
    const field = Array.isArray(target) ? target[0] : 'field';
    res.status(409).json({
      code: 'ALREADY_EXISTS',
      message: `A record with this ${field} already exists.`,
    });
    return;
  }

  // Prisma record not found
  if ((err as any).code === 'P2025') {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
    return;
  }

  // JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      code: 'INVALID_JSON',
      message: 'Invalid JSON in request body.',
    });
    return;
  }

  // Unexpected errors — log but don't leak stack traces
  logger.error(
    {
      err: { message: err.message, stack: err.stack, name: err.name },
      method: req.method,
      url: req.url,
    },
    'Unhandled error'
  );

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again later.',
  });
}
