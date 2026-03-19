/**
 * Global Express Error Handler
 *
 * Catches unhandled errors in route handlers, reports to Sentry,
 * and returns a clean error response.
 */

import { Request, Response, NextFunction } from 'express';
import { captureException } from '../lib/errorReporter';

export function globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Report to Sentry (async, don't block response)
  captureException(err, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(() => {}); // never let reporting crash the handler

  const status = (err as any).status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(status).json({ error: message });
}
