import { useQuery } from '@tanstack/react-query';
import type {
  Quote,
  OHLCVSeries,
  NewsItem,
  NewsArticle,
  PortfolioAnalytics,
  PortfolioPositionInput,
  EconomicsSnapshot,
  EconomicCalendarEvent,
  EconomicEventDetail,
} from './finance';

// Finance data hooks — all fetched from /api/finance/* proxy

export function useQuotes(symbols: string[]) {
  return useQuery<Quote[]>({
    queryKey: ['/api/finance/quotes', symbols.join(',')],
    queryFn: async () => {
      if (!symbols.length) return [];
      const res = await fetch(`/api/finance/quotes?symbols=${symbols.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      return res.json();
    },
    refetchInterval: 15000, // refresh every 15s
    staleTime: 10000,
    enabled: symbols.length > 0,
  });
}

export function useQuote(symbol: string) {
  return useQuery<Quote>({
    queryKey: ['/api/finance/quote', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/finance/quotes?symbols=${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch quote');
      const data = await res.json();
      return data[0];
    },
    refetchInterval: 10000,
    staleTime: 8000,
    enabled: !!symbol,
  });
}

export function useOHLCV(
  symbol: string,
  range: string = '1Y',
  interval: '5m' | '15m' | '1h' | '1d' = '1d'
) {
  return useQuery<OHLCVSeries>({
    queryKey: ['/api/finance/ohlcv', symbol, range, interval],
    queryFn: async () => {
      const params = new URLSearchParams({ symbol, range, interval });
      const res = await fetch(`/api/finance/ohlcv?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch OHLCV');
      return res.json();
    },
    staleTime: 60000,
    enabled: !!symbol,
  });
}

export interface SocialMention {
  symbol: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: number;
  source: string;
  posts: Array<{
    title: string;
    url: string;
    score: number;
    platform: string;
    thumbnail?: string;
  }>;
}

export function useSocialSentiment(symbol?: string) {
  return useQuery<{ mentions: SocialMention[]; source: string }>({
    queryKey: ['/api/finance/social-sentiment', symbol ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol);
      const url = params.size
        ? `/api/finance/social-sentiment?${params.toString()}`
        : '/api/finance/social-sentiment';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch social sentiment');
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export interface OptionsFlowData {
  summary: {
    putCallRatio: number;
    totalVolume: number;
    callVolume: number;
    putVolume: number;
    date: string;
  };
  activity: Array<{
    symbol: string;
    optionType: 'call' | 'put';
    strike: number;
    expiration: string;
    volume: number;
    openInterest: number;
    vOiRatio: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    underlyingPrice: number;
  }>;
  trades: Array<{
    symbol: string;
    optionType: 'call' | 'put';
    strike: number;
    expiration: string;
    premium: number;
    size: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    timestamp: string;
  }>;
}

export function useOptionsFlow(symbol?: string) {
  return useQuery<OptionsFlowData>({
    queryKey: ['/api/finance/options-flow', symbol ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol);
      const url = params.size
        ? `/api/finance/options-flow?${params.toString()}`
        : '/api/finance/options-flow';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch options flow');
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export interface WhaleTransaction {
  id: string;
  blockchain: string;
  symbol: string;
  amount: number;
  usdAmount: number | null;
  fromAddress: string;
  fromLabel: string | null;
  toAddress: string;
  toLabel: string | null;
  timestamp: string;
  txHash: string;
  type: 'transfer' | 'exchange_in' | 'exchange_out' | 'unknown';
}

export function useOnChain(symbol?: string) {
  return useQuery<{ transactions: WhaleTransaction[]; source: string }>({
    queryKey: ['/api/finance/onchain', symbol ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol);
      const url = params.size
        ? `/api/finance/onchain?${params.toString()}`
        : '/api/finance/onchain';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch onchain data');
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export function useMarketSentiment() {
  return useQuery<{ sentiment: string; score: number; bullish: number; bearish: number }>({
    queryKey: ['/api/finance/sentiment'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sentiment');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useMarketGainers() {
  return useQuery<Quote[]>({
    queryKey: ['/api/finance/gainers'],
    queryFn: async () => {
      const res = await fetch('/api/finance/gainers');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useMarketLosers() {
  return useQuery<Quote[]>({
    queryKey: ['/api/finance/losers'],
    queryFn: async () => {
      const res = await fetch('/api/finance/losers');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useMostActive() {
  return useQuery<Quote[]>({
    queryKey: ['/api/finance/active'],
    queryFn: async () => {
      const res = await fetch('/api/finance/active');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useNews(symbol?: string, query?: string) {
  return useQuery<NewsItem[]>({
    queryKey: ['/api/finance/news', symbol ?? 'market', query ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol);
      if (query?.trim()) params.set('query', query.trim());
      const url = params.size ? `/api/finance/news?${params.toString()}` : '/api/finance/news';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 55000,
  });
}

type NewsArticleRequest = Pick<
  NewsItem,
  'url' | 'title' | 'source' | 'feedProvider' | 'publishedAt' | 'summary'
>;

export function buildNewsArticleParams(item: NewsArticleRequest) {
  const params = new URLSearchParams({
    url: item.url,
    title: item.title,
    source: item.source,
    publishedAt: item.publishedAt,
  });

  if (item.feedProvider) params.set('feedProvider', item.feedProvider);
  if (item.summary) params.set('summary', item.summary);

  return params;
}

export function useNewsArticle(item?: NewsArticleRequest | null) {
  return useQuery<NewsArticle>({
    queryKey: ['/api/finance/news/read', item?.url ?? '', item?.title ?? ''],
    queryFn: async () => {
      if (!item) throw new Error('Missing article');
      const params = buildNewsArticleParams(item);
      const res = await fetch(`/api/finance/news/read?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch article');
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: Boolean(item?.url),
  });
}

export function usePortfolioAnalytics(positions: PortfolioPositionInput[]) {
  return useQuery<PortfolioAnalytics>({
    queryKey: ['/api/finance/portfolio-analytics', JSON.stringify(positions)],
    queryFn: async () => {
      const res = await fetch('/api/finance/portfolio-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });
      if (!res.ok) throw new Error('Failed to fetch portfolio analytics');
      return res.json();
    },
    staleTime: 60_000,
    enabled: positions.length > 0,
  });
}

export function useEconomics() {
  return useQuery<EconomicsSnapshot>({
    queryKey: ['/api/finance/economics'],
    queryFn: async () => {
      const res = await fetch('/api/finance/economics');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 300000,
    staleTime: 250000,
  });
}

export function useEconomicCalendar() {
  return useQuery<EconomicCalendarEvent[]>({
    queryKey: ['/api/finance/economics/calendar'],
    queryFn: async () => {
      const res = await fetch('/api/finance/economics/calendar');
      if (!res.ok) throw new Error('Failed to fetch economic calendar');
      return res.json();
    },
    refetchInterval: 15 * 60_000,
    staleTime: 14 * 60_000,
  });
}

export function useEconomicEventDetail(releaseId?: number | null) {
  return useQuery<EconomicEventDetail>({
    queryKey: ['/api/finance/economics/events', releaseId ?? 0],
    queryFn: async () => {
      if (!releaseId) throw new Error('Missing releaseId');
      const res = await fetch(`/api/finance/economics/events/${releaseId}`);
      if (!res.ok) throw new Error('Failed to fetch economic event detail');
      return res.json();
    },
    staleTime: 60 * 60_000,
    enabled: Boolean(releaseId),
  });
}

export function usePeers(symbol: string) {
  return useQuery<Quote[]>({
    queryKey: ['/api/finance/peers', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/finance/peers?symbol=${symbol}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 300000,
    enabled: !!symbol,
  });
}

export function useIndexSparklines() {
  return useQuery<Record<string, number[]>>({
    queryKey: ['/api/finance/sparklines'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sparklines');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 300000, // sparklines are intraday, refresh every 5 min
    refetchInterval: 300000,
  });
}

export function useScreener(filters: Record<string, string>) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<Quote[]>({
    queryKey: ['/api/finance/screener', params],
    queryFn: async () => {
      const res = await fetch(`/api/finance/screener?${params}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60000,
  });
}

// ── Bridge hooks (cross-app data) ──────────────────────────────────────────

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

export interface PortfolioBridge {
  configured: boolean;
  positions: BridgePosition[];
  accounts: BridgeAccount[];
  error?: string;
}

export interface WatchlistBridgeEntry {
  symbol: string;
  name?: string;
}

/** Fetch live SnapTrade positions from the main server bridge. */
export function useSnapTradePortfolio() {
  return useQuery<PortfolioBridge>({
    queryKey: ['/api/bridge/portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/bridge/portfolio');
      if (!res.ok) throw new Error('Failed to fetch SnapTrade portfolio');
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000, // refresh every 2 min
  });
}

/** Fetch the shared watchlist from the main server bridge. */
export function useWatchlistBridge() {
  return useQuery<WatchlistBridgeEntry[]>({
    queryKey: ['/api/bridge/watchlist'],
    queryFn: async () => {
      const res = await fetch('/api/bridge/watchlist');
      if (!res.ok) throw new Error('Failed to fetch bridge watchlist');
      return res.json();
    },
    staleTime: 30_000,
  });
}
