/**
 * Cross-source signal correlator.
 * Aggregates mentions from all Social Sentiment 2.0 panels and detects
 * tickers mentioned in multiple communities (→ "in N communities" badges).
 */

export interface PanelMention {
  symbol: string;
  source: 'reddit' | 'truth' | 'x';
  count: number;
  sentiment: number;
  topics?: string[];
}

export interface CorrelatedSignal {
  symbol: string;
  sources: string[];
  sourceCount: number;
  consensusSentiment: number;
  conviction: 'high' | 'medium' | 'low';
  totalMentions: number;
  topics: string[];
}

export function correlateSignals(panels: PanelMention[][]): CorrelatedSignal[] {
  const tickerMap = new Map<
    string,
    {
      sources: Set<string>;
      totalCount: number;
      sentiments: number[];
      topics: Set<string>;
    }
  >();

  for (const panel of panels) {
    for (const mention of panel) {
      if (!tickerMap.has(mention.symbol)) {
        tickerMap.set(mention.symbol, {
          sources: new Set(),
          totalCount: 0,
          sentiments: [],
          topics: new Set(),
        });
      }
      const entry = tickerMap.get(mention.symbol)!;
      entry.sources.add(mention.source);
      entry.totalCount += mention.count;
      entry.sentiments.push(mention.sentiment);
      if (mention.topics) mention.topics.forEach(t => entry.topics.add(t));
    }
  }

  const results: CorrelatedSignal[] = [];
  for (const [symbol, data] of tickerMap) {
    const sourceCount = data.sources.size;
    const avgSentiment =
      data.sentiments.length > 0
        ? data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length
        : 0;

    let conviction: 'high' | 'medium' | 'low';
    if (sourceCount >= 3 && data.totalCount > 50) conviction = 'high';
    else if (sourceCount >= 2 && data.totalCount > 20) conviction = 'medium';
    else conviction = 'low';

    results.push({
      symbol,
      sources: [...data.sources],
      sourceCount,
      consensusSentiment: Number(avgSentiment.toFixed(3)),
      conviction,
      totalMentions: data.totalCount,
      topics: [...data.topics],
    });
  }

  return results.sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
    return b.totalMentions - a.totalMentions;
  });
}

/**
 * In-memory signal store with TTL.
 * Each panel pushes its results here; the correlator reads from it.
 */
interface CacheEntry {
  data: PanelMention[];
  ts: number;
}

const store = new Map<string, CacheEntry>();
const STORE_TTL = 5 * 60_000;

export function storePanelResults(key: string, mentions: PanelMention[]): void {
  store.set(key, { data: mentions, ts: Date.now() });
}

export function getCorrelatedSignals(): CorrelatedSignal[] {
  const now = Date.now();
  const allPanels: PanelMention[][] = [];
  for (const [key, entry] of store) {
    if (now - entry.ts > STORE_TTL) {
      store.delete(key);
      continue;
    }
    allPanels.push(entry.data);
  }
  return correlateSignals(allPanels);
}
