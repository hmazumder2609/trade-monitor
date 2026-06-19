import { createCircuitBreaker } from '@/utils/circuit-breaker';

export interface OptionsSummary {
  putCallRatio: number;
  totalVolume: number;
  callVolume: number;
  putVolume: number;
  date: string;
}

export interface UnusualOption {
  symbol: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;
  volume: number;
  openInterest: number;
  vOiRatio: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  underlyingPrice: number;
}

export interface BlockTrade {
  symbol: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;
  premium: number;
  size: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  timestamp: string;
}

const summaryBreaker = createCircuitBreaker<OptionsSummary>({
  name: 'OptionsSummary',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchOptionsSummary(): Promise<OptionsSummary> {
  return summaryBreaker.execute(
    async () => {
      const resp = await fetch('/api/options-flow?action=summary');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    { putCallRatio: 0, totalVolume: 0, callVolume: 0, putVolume: 0, date: '' }
  );
}

const unusualBreaker = createCircuitBreaker<UnusualOption[]>({
  name: 'UnusualOptions',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchUnusualActivity(symbols?: string[]): Promise<UnusualOption[]> {
  const params = new URLSearchParams({ action: 'unusual' });
  if (symbols && symbols.length > 0) params.set('symbols', symbols.join(','));
  return unusualBreaker.execute(async () => {
    const resp = await fetch(`/api/options-flow?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data || [];
  }, []);
}

const flowBreaker = createCircuitBreaker<BlockTrade[]>({
  name: 'BlockTrades',
  cacheTtlMs: 3 * 60_000,
});

export async function fetchBlockTrades(): Promise<BlockTrade[]> {
  return flowBreaker.execute(async () => {
    const resp = await fetch('/api/options-flow?action=flow');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data || [];
  }, []);
}
