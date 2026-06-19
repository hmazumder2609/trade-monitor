/**
 * Bridge routes — data shared between the dashboard and the terminal SPA.
 *
 * GET  /api/bridge/portfolio  — aggregate SnapTrade positions across all accounts.
 *                               Returns { configured, positions, accounts } so the
 *                               terminal PortfolioPanel can show live holdings.
 *
 * GET  /api/bridge/watchlist  — return the shared watchlist from data/watchlist.json.
 * PUT  /api/bridge/watchlist  — replace the shared watchlist (full overwrite).
 *
 * These routes are intentionally NOT behind the auth middleware (they are
 * registered before it in server/index.ts) so the terminal SPA can reach them
 * without knowing the API_TOKEN.
 */

import type { Express, Request, Response } from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readEnvKey } from './settings.js';

// ---- Shared watchlist persistence ----------------------------------------

const DATA_DIR = resolve(process.cwd(), 'data');
const WATCHLIST_FILE = resolve(DATA_DIR, 'watchlist.json');

const DEFAULT_WATCHLIST: WatchlistEntry[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms' },
];

interface WatchlistEntry {
  symbol: string;
  name?: string;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readWatchlist(): WatchlistEntry[] {
  try {
    if (!existsSync(WATCHLIST_FILE)) return DEFAULT_WATCHLIST;
    return JSON.parse(readFileSync(WATCHLIST_FILE, 'utf-8'));
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function writeWatchlist(entries: WatchlistEntry[]): void {
  ensureDataDir();
  writeFileSync(WATCHLIST_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

// ---- SnapTrade helpers ----------------------------------------------------

const SNAPTRADE_API = 'https://api.snaptrade.com/api/v1';

import { createHmac } from 'node:crypto';

function jsonStringifySorted(obj: unknown): string {
  const allKeys: string[] = [];
  const seen: Record<string, boolean> = {};
  JSON.stringify(obj, (key, value) => {
    if (typeof key === 'string' && !(key in seen)) {
      allKeys.push(key);
      seen[key] = true;
    }
    return value;
  });
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

async function snapFetch(
  method: string,
  path: string,
  clientId: string,
  consumerKey: string,
  userId: string,
  userSecret: string
): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestPath = `/api/v1${path.split('?')[0]}`;
  const extraQuery = path.includes('?') ? path.split('?')[1] : '';
  const query = `clientId=${encodeURIComponent(clientId)}&timestamp=${timestamp}${extraQuery ? `&${extraQuery}` : ''}`;

  const sigObject = { content: null, path: requestPath, query };
  const sigContent = jsonStringifySorted(sigObject);
  const encodedKey = encodeURI(consumerKey);
  const signature = createHmac('sha256', encodedKey).update(sigContent).digest('base64');

  const url = `${SNAPTRADE_API}${path.split('?')[0]}?${query}`;
  const resp = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Signature: signature,
      userId,
      userSecret,
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`SnapTrade ${resp.status}: ${text}`);
  }
  return resp.json();
}

export interface BridgePosition {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currency: string;
  accountId: string;
  accountName: string;
}

export interface BridgeAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export interface PortfolioBridgeResponse {
  configured: boolean;
  positions: BridgePosition[];
  accounts: BridgeAccount[];
  error?: string;
}

// ---- Route registration ---------------------------------------------------

export function registerBridgeRoutes(app: Express): void {

  // GET /api/bridge/watchlist
  app.get('/api/bridge/watchlist', (_req: Request, res: Response) => {
    res.json(readWatchlist());
  });

  // PUT /api/bridge/watchlist — body: WatchlistEntry[]
  app.put('/api/bridge/watchlist', (req: Request, res: Response) => {
    const entries = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Body must be an array of { symbol, name? }' });
    }
    const cleaned: WatchlistEntry[] = entries
      .filter((e: any) => typeof e?.symbol === 'string' && e.symbol.trim())
      .map((e: any) => ({ symbol: String(e.symbol).trim().toUpperCase(), name: e.name ?? undefined }));
    writeWatchlist(cleaned);
    res.json({ ok: true, count: cleaned.length });
  });

  // GET /api/bridge/portfolio — aggregate SnapTrade holdings
  app.get('/api/bridge/portfolio', async (_req: Request, res: Response) => {
    const clientId = readEnvKey('SNAPTRADE_CLIENT_ID');
    const consumerKey = readEnvKey('SNAPTRADE_CONSUMER_KEY');
    const userId = readEnvKey('SNAPTRADE_USER_ID');
    const userSecret = readEnvKey('SNAPTRADE_USER_SECRET');

    if (!clientId || !consumerKey || !userId || !userSecret) {
      return res.json({ configured: false, positions: [], accounts: [] } satisfies PortfolioBridgeResponse);
    }

    try {
      // Fetch all accounts
      const rawAccounts = await snapFetch(
        'GET',
        `/accounts?userId=${encodeURIComponent(userId)}&userSecret=${encodeURIComponent(userSecret)}`,
        clientId, consumerKey, userId, userSecret
      ) as any[];

      if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
        return res.json({ configured: true, positions: [], accounts: [] } satisfies PortfolioBridgeResponse);
      }

      const accounts: BridgeAccount[] = rawAccounts.map((a: any) => ({
        id: String(a.id ?? a.account_id ?? ''),
        name: a.name ?? a.account_name ?? 'Account',
        type: a.meta?.type ?? a.institution_name ?? 'Brokerage',
        currency: a.currency ?? a.meta?.currency ?? 'USD',
      }));

      // Fetch holdings for each account in parallel
      const holdingsByAccount = await Promise.all(
        accounts.map(async account => {
          try {
            const data = await snapFetch(
              'GET',
              `/accounts/${account.id}/holdings?userId=${encodeURIComponent(userId)}&userSecret=${encodeURIComponent(userSecret)}`,
              clientId, consumerKey, userId, userSecret
            ) as any;
            return { account, positions: data?.positions ?? data ?? [] };
          } catch {
            return { account, positions: [] };
          }
        })
      );

      const positions: BridgePosition[] = holdingsByAccount.flatMap(({ account, positions: raw }) => {
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((p: any) => {
            const units = Number(p.units ?? p.fractional_units ?? 0);
            return units > 0;
          })
          .map((p: any) => {
            const symbol =
              p.symbol?.symbol ??
              p.symbol?.ticker ??
              p.universal_symbol?.symbol ??
              p.ticker ??
              '';
            const name =
              p.symbol?.description ??
              p.universal_symbol?.description ??
              symbol;
            const shares = Number(p.units ?? 0) + Number(p.fractional_units ?? 0);
            // avgCost = book_value / units (SnapTrade sometimes provides average_purchase_price directly)
            const avgCost =
              p.average_purchase_price ??
              (shares > 0 && p.book_value != null ? Number(p.book_value) / shares : 0);

            return {
              symbol: String(symbol).toUpperCase(),
              name: String(name),
              shares: Number(shares.toFixed(6)),
              avgCost: Number(Number(avgCost).toFixed(4)),
              currency: p.currency ?? account.currency ?? 'USD',
              accountId: account.id,
              accountName: account.name,
            };
          })
          .filter((p: BridgePosition) => p.symbol && p.shares > 0);
      });

      res.json({ configured: true, positions, accounts } satisfies PortfolioBridgeResponse);
    } catch (err: any) {
      res.json({
        configured: true,
        positions: [],
        accounts: [],
        error: err.message ?? 'Failed to fetch SnapTrade portfolio',
      } satisfies PortfolioBridgeResponse);
    }
  });
}
