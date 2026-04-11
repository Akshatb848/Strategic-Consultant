import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// ── Zod validation middleware ────────────────────────────────────────────────
// Usage: router.post('/route', validate(schema), handler)

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data; // Replace with parsed (and possibly transformed) data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors: error.flatten().fieldErrors,
        });
        return;
      }
      next(error);
    }
  };
}
