import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Global error handler middleware.
 *
 * Must have the (err, req, res, next) signature to be recognised by Express
 * as an error handler (even if `next` is unused).
 *
 * Two error classes:
 * 1. AppError (known, typed) → structured JSON with our error code
 * 2. Unknown Error → 500 with a generic message in production
 *
 * SECURITY: We never leak stack traces or internal file paths in production.
 * In development, we include them for faster debugging.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV !== 'production';

  if (err instanceof AppError) {
    logger.warn(
      { errorCode: err.errorCode, statusCode: err.statusCode, path: req.path, method: req.method },
      err.message,
    );

    res.status(err.statusCode).json({
      error: err.errorCode,
      message: err.message,
      ...(err.details && { details: err.details }),
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // Unknown error — log with full context and return a safe generic response
  const error = err instanceof Error ? err : new Error(String(err));

  logger.error(
    { err: error, path: req.path, method: req.method, body: req.body },
    'Unhandled error in request handler',
  );

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: isDev
      ? error.message
      : 'An unexpected error occurred. Please try again later.',
    ...(isDev && { stack: error.stack }),
  });
}

/** Handle 404 for unknown routes */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} does not exist.`,
  });
}
