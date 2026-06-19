/**
 * Shared sentiment analysis & scoring utilities for Social Sentiment 2.0 panels.
 */

const COMMON_TICKERS = new Set([
  'AAPL',
  'MSFT',
  'GOOGL',
  'GOOG',
  'AMZN',
  'TSLA',
  'NVDA',
  'META',
  'NFLX',
  'AMD',
  'INTC',
  'IBM',
  'ORCL',
  'CRM',
  'ADBE',
  'QCOM',
  'TXN',
  'AVGO',
  'COST',
  'WMT',
  'HD',
  'LOW',
  'DIS',
  'NKE',
  'MCD',
  'SBUX',
  'BA',
  'JPM',
  'GS',
  'BAC',
  'C',
  'WFC',
  'V',
  'MA',
  'PYPL',
  'SQ',
  'GME',
  'AMC',
  'BB',
  'PLTR',
  'SNAP',
  'RBLX',
  'UBER',
  'LYFT',
  'BTC',
  'ETH',
  'SOL',
  'DOGE',
  'ADA',
  'XRP',
  'DOT',
  'LINK',
  'AVAX',
  'MATIC',
  'ATOM',
  'UNI',
  'ALGO',
  'FIL',
  'NEAR',
  'APT',
  'SUI',
  'SPY',
  'QQQ',
  'IWM',
  'DIA',
  'SPX',
  'VIX',
  'TLT',
  'COIN',
  'HOOD',
  'MSTR',
  'SHOP',
  'TD',
  'RY',
  'CNQ',
  'ENB',
  'BNS',
  'SU',
  'CP',
  'TRI',
  'BCE',
  'NIO',
  'RIVN',
  'LCID',
  'F',
  'GM',
  'AAL',
  'DAL',
  'UAL',
  'CCL',
  'NCLH',
]);

const POSITIVE_WORDS =
  /\b(bullish|moon|pump|buy|long|hodl|lambo|rocket|beat|win|profit|mooning|breakout|strong|growth|green|upgrade|surge|soar|alpha|moonbag|diamond)\b/gi;
const NEGATIVE_WORDS =
  /\b(bearish|dump|sell|short|crash|down|loss|bear|rug|scam|fail|plunge|drop|red|downgrade|fear|panic|bleeding|rekt|bagholder|fud|cope)\b/gi;
const NEGATION_WORDS =
  /\b(not|no|don't|doesn't|didn't|won't|wouldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|never|hardly|neither|nor)\b/gi;

export function extractTickers(text: string): string[] {
  const found: string[] = [];
  const dollarMatches = text.matchAll(/\$([A-Z]{2,5})\b/g);
  for (const m of dollarMatches) {
    found.push(m[1]);
  }
  const bareMatches = text.matchAll(/\b([A-Z]{2,5})\b/g);
  for (const m of bareMatches) {
    if (COMMON_TICKERS.has(m[1])) found.push(m[1]);
  }
  return found;
}

/**
 * Negation-aware sentiment analysis.
 * Looks for sentiment keywords within a window; if a negation word appears
 * within 3 tokens before the keyword, flips the score.
 */
export function analyzeSentiment(text: string): {
  positive: number;
  negative: number;
  score: number;
} {
  let positive = 0;
  let negative = 0;

  const negPositions: number[] = [];
  let m: RegExpExecArray | null;
  const negRe = new RegExp(NEGATION_WORDS.source, 'gi');
  while ((m = negRe.exec(text)) !== null) {
    const before = text.slice(0, m.index).split(/\s+/).length;
    negPositions.push(before);
  }

  const posRe = new RegExp(POSITIVE_WORDS.source, 'gi');
  while ((m = posRe.exec(text)) !== null) {
    const tokenIdx = text.slice(0, m.index).split(/\s+/).length;
    const negated = negPositions.some(np => tokenIdx - np > 0 && tokenIdx - np <= 3);
    if (negated) negative++;
    else positive++;
  }

  const negRe2 = new RegExp(NEGATIVE_WORDS.source, 'gi');
  while ((m = negRe2.exec(text)) !== null) {
    const tokenIdx = text.slice(0, m.index).split(/\s+/).length;
    const negated = negPositions.some(np => tokenIdx - np > 0 && tokenIdx - np <= 3);
    if (negated) positive++;
    else negative++;
  }

  const total = positive + negative;
  const score = total > 0 ? Number(((positive - negative) / total).toFixed(3)) : 0;
  return { positive, negative, score: Math.max(-1, Math.min(1, score)) };
}

export type ContentType = 'analysis' | 'news' | 'sentiment' | 'meme';

export function classifyContent(title: string, body: string): ContentType {
  const text = `${title} ${body}`.toLowerCase();
  const wordCount = text.split(/\s+/).length;

  const linkPattern = /https?:\/\/\S+/;
  if (linkPattern.test(title) && wordCount < 100) return 'news';

  const analysisKeywords =
    /\b(dd|analysis|technical|fundamental|valuation|earnings review|breakdown|thesis|catalyst)\b/;
  if (analysisKeywords.test(text) && wordCount > 50) return 'analysis';

  const memeKeywords = /\b(meme|moon|rocket|🚀|💎|🙌|tendies|lambo|hodl)\b/;
  if (memeKeywords.test(text) && wordCount < 30) return 'meme';

  const sentimentKeywords = /\b(sentiment|mood|feeling|bearish|bullish|outlook)$/;
  if (sentimentKeywords.test(text)) return 'sentiment';

  if (wordCount > 100) return 'analysis';
  if (wordCount > 30) return 'news';
  return 'meme';
}

export interface WeightConfig {
  authority?: Record<string, number>;
  contentWeights?: Record<string, number>;
  engagementMultiplier?: number;
}

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  authority: {},
  contentWeights: { analysis: 1.5, news: 1.2, sentiment: 0.7, meme: 0.3 },
  engagementMultiplier: 0.3,
};

export function weightedScore(
  count: number,
  upvotes: number,
  source: string,
  contentType: string,
  config: WeightConfig = DEFAULT_WEIGHT_CONFIG
): number {
  const logNormalized = Math.log10(Math.max(1, count)) * 2;
  const authorityWeight = config.authority?.[source] ?? 1;
  const contentWeight = config.contentWeights?.[contentType] ?? 1;
  const engagementFactor =
    1 + Math.log10(Math.max(1, upvotes)) * (config.engagementMultiplier ?? 0.3);
  return Number((logNormalized * authorityWeight * contentWeight * engagementFactor).toFixed(2));
}

/**
 * Z-score based breakout detection.
 * Returns { isBreakout, zScore } where isBreakout = true when zScore > 3.
 */
export function detectBreakout(
  currentVelocity: number,
  history: number[]
): { isBreakout: boolean; zScore: number } {
  if (history.length < 4) return { isBreakout: false, zScore: 0 };
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return { isBreakout: currentVelocity > mean * 2, zScore: 0 };
  const zScore = (currentVelocity - mean) / stdDev;
  return { isBreakout: zScore > 3, zScore: Number(zScore.toFixed(2)) };
}
