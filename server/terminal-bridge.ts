/**
 * terminal-bridge.ts
 *
 * Registers the blmtrm terminal API routes on the main Express app so that
 * the terminal SPA (served at /terminal in production) can call its backend
 * endpoints on the same origin without a second server process.
 *
 * Routes registered (BEFORE the auth gate — terminal SPA has no API_TOKEN):
 *   GET  /api/finance/*          — market data (Stooq, Yahoo, CoinGecko, RSS)
 *   GET/POST/DELETE /api/watchlist
 *   GET/POST/DELETE /api/alerts
 *   GET/POST/DELETE /api/chat   — AI agent (requires ANTHROPIC_API_KEY)
 *
 * Dynamic imports let the server start cleanly even when the terminal
 * sub-project hasn't been installed (e.g. in CI without npm run install:terminal).
 * In server/index.ts this is called with `await` at the top level so Express
 * route ordering is guaranteed: terminal routes are always registered before
 * the dashboard /api catch-all.
 */

import type { Express } from 'express';
import { createServer } from 'node:http';
import { logger } from './logger.js';

export async function registerTerminalRoutes(app: Express): Promise<void> {
  // Dynamic imports: if terminal/node_modules isn't installed this throws and
  // the caller's catch block handles it gracefully.
  // Use a computed base path so TypeScript does not statically resolve the
  // terminal modules (which live in terminal/node_modules/ and have deps like
  // zod/@anthropic-ai/sdk that don't exist in the root node_modules).
  // Template-literal imports are opaque to tsc — the inferred type is any.
  const t = '../src/terminal/server';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [
    { registerRoutes },
    { createAlertMonitor, runAlertEvaluationCycle },
    { storage },
    { getQuotes },
  ] = await Promise.all([
    import(`${t}/routes.js`),
    import(`${t}/alertMonitor.js`),
    import(`${t}/storage.js`),
    import(`${t}/marketData.js`),
  ]);

  // registerRoutes takes an http.Server for potential WS extensibility but
  // currently only uses the Express app. Pass a detached server that never
  // actually listens.
  const detachedServer = createServer();
  await registerRoutes(detachedServer, app);

  // Start the alert price-monitoring loop (15 s interval). The timer is
  // unref'd inside createAlertMonitor so it won't prevent process exit.
  createAlertMonitor(
    async () =>
      runAlertEvaluationCycle({
        loadAlerts: async () => {
          const alerts = await storage.getAlerts();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return alerts.map((a: any) => ({
            id: a.id,
            symbol: a.symbol,
            condition: a.condition as 'above' | 'below',
            price: a.price,
            triggered: a.triggered,
          }));
        },
        fetchQuotes: async (symbols: string[]) => {
          const quotes = await getQuotes(symbols);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return quotes.map((q: any) => ({ symbol: q.symbol, price: q.price }));
        },
        triggerAlert: (id: number, details: string) => storage.triggerAlert(id, details),
      }),
    15_000
  );

  logger.info(
    '[Terminal] API routes registered — /api/finance/*, /api/watchlist, /api/alerts, /api/chat'
  );
}
