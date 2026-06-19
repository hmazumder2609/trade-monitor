/**
 * Stock API proxy — Finnhub + Yahoo Finance fallback.
 * Reference: worldmonitor/server/worldmonitor/market/v1/list-market-quotes.ts
 */
import type { IncomingHttpHeaders } from 'node:http';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Symbols that only exist on Yahoo (indices/futures)
const YAHOO_ONLY = new Set([
  '^GSPC',
  '^DJI',
  '^IXIC',
  '^RUT',
  '^VIX',
  'GC=F',
  'SI=F',
  'CL=F',
  'BTC-USD',
  'ETH-USD',
]);

// In-memory cache
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 8 * 60_000; // 8 min

async function fetchFinnhub(symbol: string, apiKey: string) {
  const resp = await fetch(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${apiKey}`);
  if (!resp.ok) return null;
  const d = (await resp.json()) as Record<string, number>;
  if (!d.c && d.c !== 0) return null;
  return {
    symbol,
    name: symbol,
    price: d.c,
    change: d.d ?? null,
    changePercent: d.dp ?? null,
    high: d.h ?? null,
    low: d.l ?? null,
    previousClose: d.pc ?? null,
    sparkline: [] as number[],
  };
}

async function fetchYahoo(symbol: string) {
  try {
    const resp = await fetch(`${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=5m&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close?.filter((v: any) => v != null) || [];
    const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = price != null && prevClose ? price - prevClose : null;
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
    return {
      symbol,
      name: meta.shortName || meta.symbol || symbol,
      price,
      change,
      changePercent: changePct,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
      previousClose: prevClose,
      sparkline: closes.slice(-20),
    };
  } catch {
    return null;
  }
}

// ---- Chart candle data ----
const INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  '5m': { interval: '5m', range: '1d' },
  '15m': { interval: '15m', range: '5d' },
  '1H': { interval: '60m', range: '5d' },
  '4H': { interval: '60m', range: '1mo' },
  '1D': { interval: '1d', range: '6mo' },
};

async function fetchCandles(symbol: string, tf: string, apiKey?: string) {
  const { interval, range } = INTERVAL_MAP[tf] || INTERVAL_MAP['5m'];

  // Try Finnhub candles for stocks if key available and tf is daily
  if (apiKey && tf === '1D' && !YAHOO_ONLY.has(symbol)) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 180 * 86400;
      const resp = await fetch(
        `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${apiKey}`
      );
      if (resp.ok) {
        const d = (await resp.json()) as any;
        if (d.s === 'ok' && d.c?.length > 0) {
          return d.t.map((t: number, i: number) => ({
            time: t * 1000,
            open: d.o[i],
            high: d.h[i],
            low: d.l[i],
            close: d.c[i],
            volume: d.v[i],
          }));
        }
      }
    } catch {}
  }

  // Yahoo Finance candles (works for all symbols)
  try {
    const resp = await fetch(
      `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const candles: any[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (q.close?.[i] != null) {
        candles.push({
          time: ts[i] * 1000,
          open: q.open?.[i] ?? q.close[i],
          high: q.high?.[i] ?? q.close[i],
          low: q.low?.[i] ?? q.close[i],
          close: q.close[i],
          volume: q.volume?.[i] ?? 0,
        });
      }
    }
    return candles;
  } catch {
    return [];
  }
}

export async function handleChartRequest(
  query: Record<string, string>,
  _body: string,
  headers: IncomingHttpHeaders
): Promise<unknown> {
  const symbol = query.symbol || 'AAPL';
  const tf = query.tf || '5m';
  const apiKey = (headers['x-finnhub-key'] as string) || process.env.FINNHUB_API_KEY || '';

  const cacheKey = `chart:${symbol}:${tf}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const candles = await fetchCandles(symbol, tf, apiKey || undefined);
  const response = { symbol, tf, candles };
  cache.set(cacheKey, { data: response, ts: Date.now() });
  return response;
}

// ---- Symbol search (Yahoo Finance autocomplete) ----
const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';

export async function handleSymbolSearch(
  query: Record<string, string>,
  _body: string,
  _headers: IncomingHttpHeaders
): Promise<unknown> {
  const q = (query.q || '').trim();
  if (!q) return { results: [] };

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60_000) return cached.data;

  try {
    const resp = await fetch(
      `${YAHOO_SEARCH}?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!resp.ok) return { results: [] };
    const data = (await resp.json()) as any;
    const results = (data.quotes || []).map((item: any) => ({
      symbol: item.symbol || '',
      name: item.shortname || item.longname || '',
      type: item.quoteType || item.typeDisp || '',
      exchange: item.exchDisp || item.exchange || '',
    }));
    const response = { results };
    cache.set(cacheKey, { data: response, ts: Date.now() });
    return response;
  } catch {
    return { results: [] };
  }
}

export async function handleStockRequest(
  query: Record<string, string>,
  _body: string,
  headers: IncomingHttpHeaders
): Promise<unknown> {
  const apiKey = (headers['x-finnhub-key'] as string) || process.env.FINNHUB_API_KEY || '';
  const symbolsRaw = query.symbols || 'AAPL,MSFT,GOOGL,AMZN,TSLA,NVDA,META';
  const symbols = symbolsRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const cacheKey = symbols.sort().join(',');

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const finnhubSymbols = symbols.filter(s => !YAHOO_ONLY.has(s));
  const yahooSymbols = symbols.filter(s => YAHOO_ONLY.has(s));

  const quotes: unknown[] = [];

  // Finnhub
  if (finnhubSymbols.length > 0 && apiKey) {
    const results = await Promise.allSettled(finnhubSymbols.map(s => fetchFinnhub(s, apiKey)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) quotes.push(r.value);
    }
  } else if (finnhubSymbols.length > 0) {
    // Fallback to Yahoo for all symbols if no Finnhub key
    yahooSymbols.push(...finnhubSymbols);
  }

  // Yahoo
  if (yahooSymbols.length > 0) {
    const results = await Promise.allSettled(yahooSymbols.map(s => fetchYahoo(s)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) quotes.push(r.value);
    }
  }

  const response = { quotes, finnhubAvailable: !!apiKey };
  cache.set(cacheKey, { data: response, ts: Date.now() });
  return response;
}
