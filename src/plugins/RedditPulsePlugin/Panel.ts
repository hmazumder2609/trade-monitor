import { Panel } from '@/components/Panel';
import {
  fetchPosts,
  fetchSentiment,
  fetchBySubreddit,
  type RedditPost,
  type RedditMention,
  type RedditBreakout,
} from './service';
import { getStockSymbols } from '@/services/settings-store';
import { escapeHtml } from '@/utils';

type TabId = 'feed' | 'sentiment' | 'bysub';

export class RedditPulsePanel extends Panel {
  private posts: RedditPost[] = [];
  private mentions: RedditMention[] = [];
  private breakouts: RedditBreakout[] = [];
  private groups: Record<string, RedditPost[]> = {};
  private activeTab: TabId = 'feed';
  private expandedPost: string | null = null;
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;

  constructor() {
    super({ id: 'reddit-pulse', title: 'RedditPulse', className: 'panel-wide' });
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
    filterBtn.textContent = this.watchlistOnly ? 'Watchlist' : 'All Symbols';
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
    const tabBtns = this.tabsEl.querySelectorAll('.panel-tab');
    tabBtns.forEach(b => b.remove());
    const tabs: { id: TabId; label: string }[] = [
      { id: 'feed', label: 'News Feed' },
      { id: 'sentiment', label: 'Sentiment' },
      { id: 'bysub', label: 'By Subreddit' },
    ];
    for (const t of tabs) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${t.id === this.activeTab ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.activeTab = t.id;
        this.renderTabs();
        this.renderActiveTab();
      });
      if (this.tabsEl.firstChild) {
        this.tabsEl.insertBefore(btn, this.tabsEl.firstChild);
      } else {
        this.tabsEl.appendChild(btn);
      }
    }
  }

  async refresh(): Promise<void> {
    const gen = ++this.refreshGen;
    this.setFetching(true);
    try {
      const symbols = this.watchlistOnly ? getStockSymbols() : undefined;
      const [postsRes, sentRes, bySubRes] = await Promise.allSettled([
        fetchPosts(symbols),
        fetchSentiment(symbols),
        fetchBySubreddit(),
      ]);
      if (gen !== this.refreshGen) return;
      if (postsRes.status === 'fulfilled') this.posts = postsRes.value.posts || [];
      if (sentRes.status === 'fulfilled') {
        this.mentions = sentRes.value.mentions || [];
        this.breakouts = sentRes.value.breakouts || [];
      }
      if (bySubRes.status === 'fulfilled') this.groups = bySubRes.value.groups || {};
      this.renderActiveTab();
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private renderActiveTab(): void {
    this.expandedPost = null;
    if (!this.listEl) return;
    if (this.activeTab === 'feed') this.renderFeed();
    else if (this.activeTab === 'sentiment') this.renderSentiment();
    else if (this.activeTab === 'bysub') this.renderBySub();
  }

  private renderFeed(): void {
    if (!this.listEl) return;
    if (this.posts.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No posts available</div>';
      return;
    }
    const sorted = [...this.posts].sort((a, b) => b.score - a.score);
    const badgeColors: Record<string, string> = {
      analysis: '#8b5cf6',
      news: '#3b82f6',
      sentiment: '#f59e0b',
      meme: '#ef4444',
    };
    const rows = sorted
      .slice(0, 30)
      .map(p => {
        const isExpanded = this.expandedPost === p.permalink;
        const badges = p.tickers
          .map(
            t =>
              `<span class="sentiment-symbol" style="font-size:10px;cursor:pointer;">${escapeHtml(t)}</span>`
          )
          .join(' ');
        return `
        <div class="sentiment-row" data-permalink="${escapeHtml(p.permalink)}" style="border-bottom:1px solid var(--border);padding:6px 4px;">
          <div class="sentiment-row-header" style="gap:4px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:600;color:var(--text);flex:1;cursor:pointer;">${escapeHtml(p.title)}</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${badgeColors[p.contentType] || '#6b7280'};color:#fff;">${p.contentType}</span>
            <span style="font-size:10px;color:var(--text-muted);">r/${p.subreddit}</span>
            <span style="font-size:10px;color:var(--text-muted);">${p.score} pts</span>
          </div>
          ${badges ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">${badges}</div>` : ''}
          ${isExpanded && p.selftext ? `<div style="margin-top:4px;font-size:11px;color:var(--text-muted);line-height:1.4;">${escapeHtml(p.selftext)}</div>` : ''}
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;
    this.listEl.querySelectorAll('[data-permalink]').forEach(el => {
      el.addEventListener('click', () => {
        const permalink = (el as HTMLElement).dataset.permalink;
        if (!permalink) return;
        this.expandedPost = this.expandedPost === permalink ? null : permalink;
        this.renderFeed();
      });
    });
    this.listEl.querySelectorAll('.sentiment-symbol').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.activeTab = 'sentiment';
        this.renderTabs();
        this.renderSentiment();
      });
    });
  }

  private renderSentiment(): void {
    if (!this.listEl) return;
    if (this.mentions.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No sentiment data</div>';
      return;
    }
    const rows = this.mentions
      .map(m => {
        const breakout = this.breakouts.find(b => b.symbol === m.symbol);
        const breakoutBadge = breakout?.isBreakout
          ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#ef4444;color:#fff;margin-left:4px;">BREAKOUT</span>'
          : '';
        const clamped = Math.max(-1, Math.min(1, m.sentiment));
        const pct = Math.round(Math.abs(clamped) * 100);
        const color = clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#6b7280';
        return `
        <div class="sentiment-row" style="padding:6px 4px;border-bottom:1px solid var(--border);">
          <div class="sentiment-row-header">
            <span class="sentiment-symbol">${escapeHtml(m.symbol)}</span>
            <span class="sentiment-badge">${m.count}</span>
            ${breakoutBadge}
          </div>
          <div class="sentiment-bar"><div class="sentiment-bar-fill" style="width:${Math.max(2, pct)}%;background:${color}"></div><span class="sentiment-score">${clamped.toFixed(2)}</span></div>
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;
  }

  private renderBySub(): void {
    if (!this.listEl) return;
    const subNames = Object.keys(this.groups);
    if (subNames.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No subreddit data</div>';
      return;
    }
    let html = '';
    for (const sub of subNames.sort()) {
      const posts = this.groups[sub].slice(0, 5);
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:12px;font-weight:600;color:var(--text);padding:4px 0;border-bottom:1px solid var(--border);">r/${escapeHtml(sub)}</div>
        ${posts
          .map(
            p => `
          <div style="padding:4px 0;font-size:11px;display:flex;justify-content:space-between;">
            <span style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${escapeHtml(p.title)}</span>
            <span style="color:var(--text-muted);margin-left:8px;">${p.score} pts</span>
          </div>
        `
          )
          .join('')}
      </div>`;
    }
    this.listEl.innerHTML = html;
  }
}
