/**
 * SentimentBadge — shows news/social sentiment score for a symbol.
 *
 * Displays a colored score (-1 to +1) with trend indicator and news count.
 * Data comes from the DataLayer sentiment source.
 */

import {
  registerSentimentSource,
  getSentiment,
  type SentimentData,
} from '@/services/data-layer/sources/sentiment';

export class SentimentBadge {
  private el: HTMLElement;
  private symbol: string;
  private data: SentimentData | null = null;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.el = document.createElement('span');
    this.el.className = 'stock-sentiment-badge';
    this.render();
  }

  getElement(): HTMLElement {
    return this.el;
  }

  async load(): Promise<void> {
    registerSentimentSource(this.symbol);
    this.data = getSentiment(this.symbol);

    if (!this.data) {
      const { fetchSentiment } = await import('@/services/data-layer/sources/sentiment');
      this.data = await fetchSentiment(this.symbol);
    }

    this.render();
  }

  private render(): void {
    if (!this.data) {
      this.el.innerHTML = '';
      return;
    }

    const d = this.data;
    const scoreColor =
      d.score > 0.2 ? 'var(--green)' : d.score < -0.2 ? 'var(--red)' : 'var(--text-muted)';
    const trendIcon = d.trend === 'up' ? '▲' : d.trend === 'down' ? '▼' : '–';
    const trendColor =
      d.trend === 'up' ? 'var(--green)' : d.trend === 'down' ? 'var(--red)' : 'var(--text-muted)';

    this.el.innerHTML = `
      <span class="stock-sentiment-score" style="color: ${scoreColor}" title="Sentiment: ${d.score.toFixed(2)}">
        ${d.score.toFixed(2)}
      </span>
      <span class="stock-sentiment-trend" style="color: ${trendColor}" title="Trend: ${d.trend}">
        ${trendIcon}
      </span>
      <span class="stock-sentiment-count" title="${d.newsCount} news, ${d.mentionCount} mentions">
        ${d.newsCount}n/${d.mentionCount}m
      </span>
    `;
  }
}
