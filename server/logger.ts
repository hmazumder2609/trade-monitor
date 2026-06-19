/**
 * Structured logger — simple, zero-dependency logging for production.
 * Outputs JSON in production, pretty text in development.
 */
import type { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, ...args: unknown[]) {
  const ts = new Date().toISOString();
  if (isProduction) {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const entry = JSON.stringify({ ts, level, msg });
    if (level === 'error') process.stderr.write(entry + '\n');
    else process.stdout.write(entry + '\n');
  } else {
    const prefix = `[${ts.slice(11, 19)}] [${level.toUpperCase()}]`;
    if (level === 'error') console.error(prefix, ...args);
    else if (level === 'warn') console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }
}

export const logger = {
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
  debug: (...args: unknown[]) => log('debug', ...args),
};

/** Express middleware — logs each HTTP request with timing. */
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
}
