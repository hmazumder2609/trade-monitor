import { Panel } from '@/components/Panel';
import {
  fetchTrending,
  fetchMentions,
  fetchTwitterSentiment,
  type MentionCount,
} from '@/services/social-sentiment';
import { getStockSymbols } from '@/services/settings-store';
import { escapeHtml } from '@/utils';

export class SocialSentimentPanel extends Panel {
  private trending: MentionCount[] = [];
  private mentions: MentionCount[] = [];
  private twitterSentiment: MentionCount[] = [];
  private activeTab: 'trending' | 'reddit' | 'twitter' = 'trending';
  private expandedSymbol: string | null = null;
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;

  constructor() {
    super({ id: 'social-sentiment', title: 'Social Sentiment', className: 'panel-wide' });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'panel-tabs';
    this.renderTabs();

    const filterBtn = document.createElement('button');
    filterBtn.className = `trading-btn ${this.watchlistOnly ? 'trading-submit-btn' : 'trading-btn-outline'}`;
    filterBtn.textContent = this.watchlistOnly ? '📋 Watchlist' : '🌐 All Symbols';
    filterBtn.style.cssText = 'padding:4px 10px;font-size:11px;margin-left:auto;';
    filterBtn.addEventListener('click', () => {
      this.watchlistOnly = !this.watchlistOnly;
      this.refresh();
    });
    this.tabsEl.appendChild(filterBtn);

    this.content.appendChild(this.tabsEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'sentiment-list';
    this.listEl.style.padding = '0 4px 4px';
    this.content.appendChild(this.listEl);
  }

  private renderTabs(): void {
    if (!this.tabsEl) return;
    this.tabsEl.innerHTML = '';
    const tabs: { id: 'trending' | 'reddit' | 'twitter'; label: string }[] = [
      { id: 'trending', label: 'Trending' },
      { id: 'reddit', label: 'Reddit Mentions' },
      { id: 'twitter', label: 'Twitter Sentiment' },
    ];
    for (const t of tabs) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${t.id === this.activeTab ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.activeTab = t.id;
        this.renderTabs();
        this.switchTab();
      });
      this.tabsEl.appendChild(btn);
    }
  }

  private async switchTab(): Promise<void> {
    this.setFetching(true);
    try {
      if (this.activeTab === 'twitter' && this.twitterSentiment.length === 0) {
        const res = await fetchTwitterSentiment();
        this.twitterSentiment = res.sentiment || [];
      }
      this.renderActiveTab();
    } catch {
      this.renderActiveTab();
    } finally {
      this.setFetching(false);
    }
  }

  async refresh(): Promise<void> {
    const gen = ++this.refreshGen;
    this.setFetching(true);
    try {
      const symbols = this.watchlistOnly ? getStockSymbols() : undefined;
      const [trendingRes, mentionsRes] = await Promise.allSettled([
        fetchTrending(symbols),
        fetchMentions(symbols),
      ]);
      if (gen !== this.refreshGen) return;
      if (trendingRes.status === 'fulfilled') this.trending = trendingRes.value.trending || [];
      if (mentionsRes.status === 'fulfilled') this.mentions = mentionsRes.value.mentions || [];
      this.renderActiveTab();
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private renderActiveTab(): void {
    if (this.activeTab === 'trending') this.renderTrending();
    else if (this.activeTab === 'reddit') this.renderReddit();
    else if (this.activeTab === 'twitter') this.renderTwitter();
  }

  private renderTrending(): void {
    this.expandedSymbol = null;
    this.renderMentionList(this.trending);
  }

  private renderReddit(): void {
    this.expandedSymbol = null;
    const redditMentions = this.mentions.filter(m => m.source === 'reddit');
    this.renderMentionList(redditMentions);
  }

  private renderTwitter(): void {
    this.expandedSymbol = null;
    if (this.twitterSentiment.length === 0) {
      if (!this.listEl) return;
      this.listEl.innerHTML = '<div class="panel-empty">Twitter API not configured</div>';
      return;
    }
    this.renderMentionList(this.twitterSentiment);
  }

  private renderMentionList(items: MentionCount[]): void {
    if (!this.listEl) return;
    if (items.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No data available</div>';
      return;
    }
    const sorted = [...items].sort((a, b) => b.count - a.count);
    const rows = sorted
      .map(item => {
        const isExpanded = this.expandedSymbol === item.symbol;
        const postsHtml = isExpanded && item.posts.length > 0
          ? `<div class="sentiment-posts">${item.posts
              .map(p => `
            <div class="sentiment-post">
              <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="sentiment-post-title">${escapeHtml(p.title)}</a>
              <div class="sentiment-post-meta">
                <span class="sentiment-post-score">${p.score} pts</span>
                <span class="sentiment-post-platform">${escapeHtml(p.platform)}</span>
              </div>
            </div>`)
              .join('')}</div>`
          : '';
        return `
        <div class="sentiment-row" data-symbol="${item.symbol}">
          <div class="sentiment-row-header">
            <span class="sentiment-symbol">${escapeHtml(item.symbol)}</span>
            <span class="sentiment-badge">${item.count}</span>
            <span class="sentiment-source-label">${escapeHtml(item.source)}</span>
          </div>
          <div class="sentiment-bar-container">${this.sentimentBar(item.sentiment)}</div>
          ${postsHtml}
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;
    this.listEl.querySelectorAll('.sentiment-row').forEach(el => {
      el.addEventListener('click', () => {
        const sym = (el as HTMLElement).dataset.symbol;
        if (!sym) return;
        this.expandedSymbol = this.expandedSymbol === sym ? null : sym;
        this.renderActiveTab();
      });
    });
  }

  private sentimentBar(score: number): string {
    const clamped = Math.max(-1, Math.min(1, score));
    const pct = Math.round(Math.abs(clamped) * 100);
    const pctWidth = Math.max(2, pct);
    const color = clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#6b7280';
    return `<div class="sentiment-bar"><div class="sentiment-bar-fill" style="width:${pctWidth}%;background:${color}"></div><span class="sentiment-score">${clamped.toFixed(2)}</span></div>`;
  }
}
