/**
 * Auth middleware — bearer token gate for API routes.
 *
 * Set API_TOKEN in .env to enable. If unset, auth is skipped (open access).
 * In production, always set API_TOKEN to lock down the API.
 *
 * Usage:  Authorization: Bearer <your-token>
 */
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = process.env.API_TOKEN;

  // No token configured — open access (dev mode)
  if (!token) return next();

  // Settings endpoint is used for initial setup — allow reads without auth
  if (req.path === '/api/settings' && req.method === 'GET') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`Auth denied: ${req.method} ${req.path} — missing Bearer token`);
    return res.status(401).json({ error: 'Unauthorized — provide Authorization: Bearer <token>' });
  }

  const provided = authHeader.slice(7);
  if (provided !== token) {
    logger.warn(`Auth denied: ${req.method} ${req.path} — invalid token`);
    return res.status(403).json({ error: 'Forbidden — invalid token' });
  }

  next();
}
