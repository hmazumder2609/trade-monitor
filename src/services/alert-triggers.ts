/**
 * Alert Triggers — Monitor various data sources and fire alerts.
 * Supports: sentiment, keyword, price, and cross-panel signal triggers.
 */

import { pushBreakingAlert } from '@/components/BreakingNewsBanner';
import {
  dataLayer,
  type SocialSentimentData,
  type XWatchData,
  type RedditPulseData,
} from '@/services/data-layer';

export type TriggerType = 'sentiment' | 'keyword' | 'price' | 'signal';

export interface AlertTrigger {
  id: string;
  type: TriggerType;
  enabled: boolean;
  /** For sentiment: symbol to watch. For keyword: the keyword. For price: symbol. */
  target: string;
  /** Threshold value (sentiment: -1 to 1, price: dollar amount) */
  threshold?: number;
  /** Condition: 'above' | 'below' for price, 'drops_below' | 'rises_above' for sentiment */
  condition?: string;
  /** For keyword: which panels to scan */
  sources?: string[];
  /** Cooldown in ms between repeated alerts for same trigger */
  cooldownMs: number;
  /** Last time this trigger fired */
  lastFired: number;
  /** Level to use for the alert */
  level: 'critical' | 'high' | 'medium' | 'low';
}

const STORAGE_KEY = 'mdm-alert-triggers';

function loadTriggers(): AlertTrigger[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTriggers(triggers: AlertTrigger[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(triggers));
}

export function getTriggers(): AlertTrigger[] {
  return loadTriggers();
}

export function addTrigger(trigger: Omit<AlertTrigger, 'id' | 'lastFired'>): AlertTrigger {
  const triggers = loadTriggers();
  const newTrigger: AlertTrigger = {
    ...trigger,
    id: `trigger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    lastFired: 0,
  };
  triggers.push(newTrigger);
  saveTriggers(triggers);
  return newTrigger;
}

export function removeTrigger(id: string): void {
  const triggers = loadTriggers().filter(t => t.id !== id);
  saveTriggers(triggers);
}

export function updateTrigger(id: string, updates: Partial<AlertTrigger>): void {
  const triggers = loadTriggers();
  const idx = triggers.findIndex(t => t.id === id);
  if (idx !== -1) {
    triggers[idx] = { ...triggers[idx], ...updates };
    saveTriggers(triggers);
  }
}

function canFire(trigger: AlertTrigger): boolean {
  return Date.now() - trigger.lastFired > trigger.cooldownMs;
}

function fireAlert(trigger: AlertTrigger, headline: string, source: string): void {
  const now = Date.now();
  updateTrigger(trigger.id, { lastFired: now });

  pushBreakingAlert({
    id: `${trigger.id}-${now}`,
    headline,
    source,
    level: trigger.level,
    timestamp: new Date(),
    panelTarget: trigger.type === 'price' ? 'trading' : undefined,
  });
}

// ---- Sentiment Monitor ----

let sentimentCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startSentimentMonitoring(): void {
  if (sentimentCheckInterval) return;

  sentimentCheckInterval = setInterval(() => {
    const triggers = loadTriggers().filter(t => t.type === 'sentiment' && t.enabled);
    if (triggers.length === 0) return;

    // Check social sentiment
    const socialData = dataLayer.getData<SocialSentimentData>('social-sentiment');
    if (socialData) {
      for (const trigger of triggers) {
        if (!canFire(trigger)) continue;
        const symbol = trigger.target.toUpperCase();
        const mention = socialData.trending?.find(m => m.symbol === symbol);
        if (mention && trigger.threshold != null) {
          if (
            (trigger.condition === 'drops_below' && mention.sentiment < trigger.threshold) ||
            (trigger.condition === 'rises_above' && mention.sentiment > trigger.threshold)
          ) {
            const dir = trigger.condition === 'drops_below' ? 'dropped below' : 'risen above';
            fireAlert(
              trigger,
              `${symbol} sentiment ${dir} ${trigger.threshold.toFixed(2)} (now ${mention.sentiment.toFixed(2)})`,
              'Social Sentiment'
            );
          }
        }
      }
    }

    // Check Reddit sentiment
    const redditData = dataLayer.getData<RedditPulseData>('reddit-pulse');
    if (redditData) {
      for (const trigger of triggers) {
        if (!canFire(trigger)) continue;
        const symbol = trigger.target.toUpperCase();
        const mention = redditData.mentions?.find(m => m.symbol === symbol);
        if (mention && trigger.threshold != null) {
          if (
            (trigger.condition === 'drops_below' && mention.sentiment < trigger.threshold) ||
            (trigger.condition === 'rises_above' && mention.sentiment > trigger.threshold)
          ) {
            const dir = trigger.condition === 'drops_below' ? 'dropped below' : 'risen above';
            fireAlert(
              trigger,
              `${symbol} Reddit sentiment ${dir} ${trigger.threshold.toFixed(2)} (now ${mention.sentiment.toFixed(2)})`,
              'Reddit Pulse'
            );
          }
        }
      }
    }

    // Check XWatch sentiment
    const xData = dataLayer.getData<XWatchData>('x-watch');
    if (xData) {
      for (const trigger of triggers) {
        if (!canFire(trigger)) continue;
        const symbol = trigger.target.toUpperCase();
        const mention = xData.mentions?.find(m => m.symbol === symbol);
        if (mention && trigger.threshold != null) {
          if (
            (trigger.condition === 'drops_below' && mention.sentiment < trigger.threshold) ||
            (trigger.condition === 'rises_above' && mention.sentiment > trigger.threshold)
          ) {
            const dir = trigger.condition === 'drops_below' ? 'dropped below' : 'risen above';
            fireAlert(
              trigger,
              `${symbol} X sentiment ${dir} ${trigger.threshold.toFixed(2)} (now ${mention.sentiment.toFixed(2)})`,
              'X Watch'
            );
          }
        }
      }
    }
  }, 30_000); // Check every 30 seconds
}

export function stopSentimentMonitoring(): void {
  if (sentimentCheckInterval) {
    clearInterval(sentimentCheckInterval);
    sentimentCheckInterval = null;
  }
}

// ---- Keyword Monitor ----

export function checkKeywordsForAlerts(
  articles: Array<{ title: string; source: string; url: string }>
): void {
  const triggers = loadTriggers().filter(t => t.type === 'keyword' && t.enabled);
  if (triggers.length === 0) return;

  for (const trigger of triggers) {
    if (!canFire(trigger)) continue;

    const keyword = trigger.target.toLowerCase();
    const matching = articles.find(a => a.title.toLowerCase().includes(keyword));

    if (matching) {
      fireAlert(trigger, matching.title, matching.source);
    }
  }
}

// ---- Cross-Panel Signal Aggregator ----

export interface SignalScore {
  symbol: string;
  news: number; // -1 to 1
  social: number; // -1 to 1
  reddit: number; // -1 to 1
  x: number; // -1 to 1
  composite: number; // weighted average
  confidence: number; // 0 to 1
}

export function calculateSignalScores(): SignalScore[] {
  const symbolScores = new Map<string, { scores: number[]; weights: number[] }>();

  // Gather social sentiment
  const socialData = dataLayer.getData<SocialSentimentData>('social-sentiment');
  if (socialData?.trending) {
    for (const m of socialData.trending) {
      const existing = symbolScores.get(m.symbol) || { scores: [], weights: [] };
      existing.scores.push(m.sentiment);
      existing.weights.push(0.3);
      symbolScores.set(m.symbol, existing);
    }
  }

  // Gather Reddit sentiment
  const redditData = dataLayer.getData<RedditPulseData>('reddit-pulse');
  if (redditData?.mentions) {
    for (const m of redditData.mentions) {
      const existing = symbolScores.get(m.symbol) || { scores: [], weights: [] };
      existing.scores.push(m.sentiment);
      existing.weights.push(0.25);
      symbolScores.set(m.symbol, existing);
    }
  }

  // Gather X sentiment
  const xData = dataLayer.getData<XWatchData>('x-watch');
  if (xData?.mentions) {
    for (const m of xData.mentions) {
      const existing = symbolScores.get(m.symbol) || { scores: [], weights: [] };
      existing.scores.push(m.sentiment);
      existing.weights.push(0.25);
      symbolScores.set(m.symbol, existing);
    }
  }

  // Calculate composite scores
  const results: SignalScore[] = [];
  for (const [symbol, data] of symbolScores) {
    const totalWeight = data.weights.reduce((a, b) => a + b, 0);
    const weightedSum = data.scores.reduce((sum, s, i) => sum + s * data.weights[i], 0);
    const composite = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = Math.min(1, totalWeight / 0.8); // normalize to 0-1

    results.push({
      symbol,
      news: 0,
      social: data.scores[0] || 0,
      reddit: data.scores[1] || 0,
      x: data.scores[2] || 0,
      composite,
      confidence,
    });
  }

  return results.sort((a, b) => Math.abs(b.composite) - Math.abs(a.composite));
}

// ---- Signal Alerts ----

let signalCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startSignalMonitoring(): void {
  if (signalCheckInterval) return;

  signalCheckInterval = setInterval(() => {
    const triggers = loadTriggers().filter(t => t.type === 'signal' && t.enabled);
    if (triggers.length === 0) return;

    const scores = calculateSignalScores();

    for (const trigger of triggers) {
      if (!canFire(trigger)) continue;

      const symbol = trigger.target.toUpperCase();
      const score = scores.find(s => s.symbol === symbol);

      if (score && trigger.threshold != null) {
        if (
          (trigger.condition === 'drops_below' && score.composite < trigger.threshold) ||
          (trigger.condition === 'rises_above' && score.composite > trigger.threshold)
        ) {
          const dir = trigger.condition === 'drops_below' ? 'dropped below' : 'risen above';
          fireAlert(
            trigger,
            `${symbol} composite signal ${dir} ${trigger.threshold.toFixed(2)} (now ${score.composite.toFixed(2)}, confidence: ${(score.confidence * 100).toFixed(0)}%)`,
            'Signal Aggregator'
          );
        }
      }
    }
  }, 60_000); // Check every minute
}

export function stopSignalMonitoring(): void {
  if (signalCheckInterval) {
    clearInterval(signalCheckInterval);
    signalCheckInterval = null;
  }
}

// ---- Initialize All Monitoring ----

export function startAllAlertMonitoring(): void {
  startSentimentMonitoring();
  startSignalMonitoring();
}

export function stopAllAlertMonitoring(): void {
  stopSentimentMonitoring();
  stopSignalMonitoring();
}
