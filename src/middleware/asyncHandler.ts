/**
 * asyncHandler — Wraps async route handlers to forward errors to Express error middleware.
 *
 * Instead of:
 *   router.post('/route', async (req, res) => {
 *     try { ... } catch (err) { res.status(500).json({ error: '...' }); }
 *   });
 *
 * Use:
 *   router.post('/route', asyncHandler(async (req, res) => {
 *     // any thrown error goes to globalErrorHandler via next()
 *   }));
 */

import { Request, Response, NextFunction } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler =
  (fn: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
