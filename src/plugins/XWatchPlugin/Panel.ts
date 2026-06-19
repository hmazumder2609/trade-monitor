import { Panel } from '@/components/Panel';
import {
  fetchTweets,
  fetchSentiment,
  fetchByAccount,
  type XTweet,
  type XWatchMention,
} from './service';
import { getStockSymbols } from '@/services/settings-store';
import { escapeHtml } from '@/utils';

type TabId = 'tweets' | 'sentiment' | 'byaccount';

export class XWatchPanel extends Panel {
  private tweets: XTweet[] = [];
  private mentions: XWatchMention[] = [];
  private byAccount: Record<string, XTweet[]> = {};
  private activeTab: TabId = 'tweets';
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;

  constructor() {
    super({ id: 'x-watch', title: 'XWatch', className: 'panel-wide' });
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
      { id: 'tweets', label: 'Tweets' },
      { id: 'sentiment', label: 'Sentiment' },
      { id: 'byaccount', label: 'By Account' },
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
      if (this.tabsEl.firstChild) this.tabsEl.insertBefore(btn, this.tabsEl.firstChild);
      else this.tabsEl.appendChild(btn);
    }
  }

  async refresh(): Promise<void> {
    const gen = ++this.refreshGen;
    this.setFetching(true);
    try {
      const symbols = this.watchlistOnly ? getStockSymbols() : undefined;
      const [tweetsRes, sentRes, byAcctRes] = await Promise.allSettled([
        fetchTweets(symbols),
        fetchSentiment(symbols),
        fetchByAccount(),
      ]);
      if (gen !== this.refreshGen) return;
      if (tweetsRes.status === 'fulfilled') this.tweets = tweetsRes.value.tweets || [];
      if (sentRes.status === 'fulfilled') this.mentions = sentRes.value.mentions || [];
      if (byAcctRes.status === 'fulfilled') this.byAccount = byAcctRes.value.accounts || {};
      this.renderActiveTab();
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private renderActiveTab(): void {
    if (!this.listEl) return;
    if (this.activeTab === 'tweets') this.renderTweets();
    else if (this.activeTab === 'sentiment') this.renderSentiment();
    else if (this.activeTab === 'byaccount') this.renderByAccount();
  }

  private renderTweets(): void {
    if (!this.listEl) return;
    if (this.tweets.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No tweets available</div>';
      return;
    }
    const sorted = [...this.tweets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const rows = sorted
      .map(t => {
        const posted = new Date(t.created_at).toLocaleString();
        const tickerTags = t.tickers
          .map(
            sym =>
              `<span class="sentiment-symbol" style="font-size:10px;">${escapeHtml(sym)}</span>`
          )
          .join(' ');
        const sentimentColor =
          t.sentiment.score > 0.1 ? '#22c55e' : t.sentiment.score < -0.1 ? '#ef4444' : '#6b7280';
        return `
        <div style="padding:8px 4px;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:600;color:#1d9bf0;">@${escapeHtml(t.author.username)}</span>
            <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(t.author.label)}</span>
          </div>
          <div style="font-size:12px;color:var(--text);line-height:1.4;margin-bottom:4px;">${escapeHtml(t.text)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:10px;color:var(--text-muted);">
            ${tickerTags}
            <span>${posted}</span>
            <span>♥ ${t.like_count.toLocaleString()}</span>
            <span>🔁 ${t.retweet_count.toLocaleString()}</span>
            <span style="color:${sentimentColor};">${t.sentiment.score.toFixed(2)}</span>
          </div>
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;
  }

  private renderSentiment(): void {
    if (!this.listEl) return;
    if (this.mentions.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No sentiment data</div>';
      return;
    }
    const rows = this.mentions
      .map(m => {
        const clamped = Math.max(-1, Math.min(1, m.sentiment));
        const pct = Math.round(Math.abs(clamped) * 100);
        const color = clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#6b7280';
        return `
        <div style="padding:6px 4px;border-bottom:1px solid var(--border);">
          <div class="sentiment-row-header">
            <span class="sentiment-symbol">${escapeHtml(m.symbol)}</span>
            <span class="sentiment-badge">${m.count}</span>
          </div>
          <div class="sentiment-bar"><div class="sentiment-bar-fill" style="width:${Math.max(2, pct)}%;background:${color}"></div><span class="sentiment-score">${clamped.toFixed(2)}</span></div>
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;
  }

  private renderByAccount(): void {
    if (!this.listEl) return;
    const accountNames = Object.keys(this.byAccount);
    if (accountNames.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No account data</div>';
      return;
    }
    let html = '';
    for (const name of accountNames) {
      const tweets = this.byAccount[name].slice(0, 5);
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:12px;font-weight:600;color:#1d9bf0;padding:4px 0;border-bottom:1px solid var(--border);">${escapeHtml(name)}</div>
        ${tweets
          .map(
            t => `
          <div style="padding:4px 0;font-size:11px;color:var(--text);">${escapeHtml(t.text.slice(0, 200))}</div>
        `
          )
          .join('')}
      </div>`;
    }
    this.listEl.innerHTML = html;
  }
}
