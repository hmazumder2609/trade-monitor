/**
 * Production server — Express app serving the SPA + all API routes.
 *
 * Development:  npm run dev        (Vite dev server with embedded API plugin)
 * Production:   npm run build && npm start
 */
import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleStockRequest, handleChartRequest, handleSymbolSearch } from './routes/stock.js';
import { handleNewsRequest } from './routes/news.js';
import { handleGithubRequest } from './routes/github.js';
import { handleEmailRequest } from './routes/email.js';
import { handleCalendarRequest } from './routes/calendar.js';
import { handleFeishuRequest } from './routes/feishu.js';
import { handleSocialRequest } from './routes/social.js';
import { handleSystemRequest } from './routes/system.js';
import { handleOfficeRequest } from './routes/office.js';
import { handleHealthRequest } from './routes/health.js';
import { handleSnapTradeRequest } from './routes/snaptrade.js';
import { handleSettingsRequest } from './routes/settings.js';
import { handleFlightsRequest } from './routes/flights.js';
import { handleMacroRequest } from './routes/macro.js';
import { handleOptionsFlowRequest } from './routes/options-flow.js';
import { handleOnChainRequest } from './routes/onchain.js';
import { handleSocialSentimentRequest } from './routes/social-sentiment.js';
import { handleRedditPulseRequest } from './routes/reddit-pulse.js';
import { handleTruthWatchRequest } from './routes/truthwatch.js';
import { handleXWatchRequest } from './routes/xwatch.js';
import { logger, httpLogger } from './logger.js';
import { authMiddleware } from './auth.js';
import { registerTerminalRoutes } from './terminal-bridge.js';
import { registerBridgeRoutes } from './routes/bridge.js';
import { createFinnhubBridge } from './routes/finnhub-ws.js';
import WebSocket, { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

type RouteHandler = (
  query: Record<string, string>,
  body: string,
  headers: Record<string, string | string[] | undefined>
) => Promise<unknown>;

// ---- Exact-match routes ----
const routes: Record<string, RouteHandler> = {
  '/api/stocks': handleStockRequest,
  '/api/chart': handleChartRequest,
  '/api/symbols/search': handleSymbolSearch,
  '/api/news': handleNewsRequest,
  '/api/github': handleGithubRequest,
  '/api/emails': handleEmailRequest,
  '/api/calendar': handleCalendarRequest,
  '/api/feishu': handleFeishuRequest,
  '/api/social': handleSocialRequest,
  '/api/system': handleSystemRequest,
  '/api/office': handleOfficeRequest,
  '/api/health': handleHealthRequest,
  '/api/settings': handleSettingsRequest,
  '/api/flights': handleFlightsRequest,
  '/api/macro': handleMacroRequest,
  '/api/options-flow': handleOptionsFlowRequest,
  '/api/onchain': handleOnChainRequest,
  '/api/social-sentiment': handleSocialSentimentRequest,
  '/api/reddit-pulse': handleRedditPulseRequest,
  '/api/truthwatch': handleTruthWatchRequest,
  '/api/xwatch': handleXWatchRequest,
};

// ---- Prefix-match routes (e.g. /api/snaptrade/accounts/123/holdings) ----
const prefixRoutes: Record<string, RouteHandler> = {
  '/api/snaptrade': handleSnapTradeRequest,
};

const app = express();

// ---- Middleware ----
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/plain', limit: '1mb' }));
app.use(httpLogger);

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', isProduction ? origin : '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- Bridge routes (no auth — accessed by both dashboard and terminal SPA) ----
registerBridgeRoutes(app);

// ---- Terminal routes (no auth — terminal SPA doesn't carry the API token) ----
// Must be registered BEFORE the auth middleware and the /api catch-all so that
// Express route ordering gives /api/finance/*, /api/watchlist, /api/alerts,
// and /api/chat priority over the dashboard catch-all handler.
try {
  await registerTerminalRoutes(app);
} catch (err: any) {
  logger.error('[Terminal] Failed to register terminal routes:', err.message ?? err);
}

// Auth gate for API routes (skipped in dev if no API_TOKEN is set)
app.use('/api', authMiddleware);

// ---- API route handler ----
app.all('/api/{*splat}', async (req, res) => {
  const pathname = req.path;
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    query[k] = String(v);
  }

  let handler = routes[pathname];

  // Check prefix routes if no exact match
  if (!handler) {
    for (const [prefix, h] of Object.entries(prefixRoutes)) {
      if (pathname.startsWith(prefix)) {
        handler = h;
        query.__path = pathname.slice(prefix.length);
        break;
      }
    }
  }

  if (!handler) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Read raw body for non-JSON POSTs
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');

  try {
    const result = await handler(query, body, req.headers as any);
    res.json(result);
  } catch (err: any) {
    logger.error(`[API] ${pathname}`, err.message);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ---- Static files (production) ----
const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir, { maxAge: isProduction ? '1y' : 0 }));

// Terminal sub-app (blmtrm) — served at /terminal in production.
// In development the terminal runs standalone on port 5000.
if (isProduction) {
  const terminalDir = path.resolve(__dirname, '..', 'dist', 'terminal'); // built by src/terminal vite config → dist/terminal
  if (existsSync(terminalDir)) {
    app.use('/terminal', express.static(terminalDir, { maxAge: '1y' }));
    // SPA fallback for terminal routes
    app.get('/terminal/{*splat}', (_req, res) => {
      res.sendFile(path.join(terminalDir, 'index.html'));
    });
  }
}

// SPA fallback — serve index.html for all non-API routes
app.get('{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// ---- Global error handler ----
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('[Server] Unhandled error:', err.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Finnhub WebSocket proxy ----
const finnhubKey = process.env.FINNHUB_API_KEY || '';
let finnhubBridge: ReturnType<typeof createFinnhubBridge> | null = null;

if (finnhubKey) {
  finnhubBridge = createFinnhubBridge(finnhubKey);
  finnhubBridge.connect();
}

const wss = new WebSocketServer({ noServer: true });

// ---- Start ----
const server = http.createServer(app);
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/finnhub') {
    wss.handleUpgrade(request, socket, head, ws => {
      (ws as any)._wsId = Math.random().toString(36).slice(2);
      wss.emit('connection', ws, request);

      ws.on('message', (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'subscribe' && msg.symbol && finnhubBridge) {
            finnhubBridge.subscribe(msg.symbol, ws);
          }
          if (msg.type === 'unsubscribe' && msg.symbol && finnhubBridge) {
            finnhubBridge.unsubscribe(msg.symbol, ws);
          }
        } catch {
          /* ignore malformed */
        }
      });

      ws.on('close', () => {
        finnhubBridge?.removeClient(ws);
      });
    });
  } else {
    socket.destroy();
  }
});
server.listen(PORT, () => {
  logger.info(
    `Server running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`
  );
  logger.info(`Serving SPA from ${distDir}`);
});

export default app;
