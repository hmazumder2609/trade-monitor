import { Panel } from '@/components/Panel';
import { fetchPosts, fetchMarketImpact, type TruthPost, type MarketImpact } from './service';
import { escapeHtml } from '@/utils';

type TabId = 'posts' | 'impact';

const SECTOR_COLORS: Record<string, string> = {
  tariffs: '#ef4444',
  crypto: '#f59e0b',
  ai: '#8b5cf6',
  fed: '#3b82f6',
  china: '#dc2626',
  energy: '#22c55e',
  stocks: '#10b981',
  general: '#6b7280',
};

export class TruthWatchPanel extends Panel {
  private posts: TruthPost[] = [];
  private impact: MarketImpact | null = null;
  private activeTab: TabId = 'posts';
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private refreshGen = 0;

  constructor() {
    super({ id: 'truth-watch', title: 'TruthWatch', className: 'panel-wide' });
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'panel-tabs';
    this.renderTabs();
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
      { id: 'posts', label: 'Posts' },
      { id: 'impact', label: 'Market Impact' },
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
      const [postsRes, impactRes] = await Promise.allSettled([fetchPosts(), fetchMarketImpact()]);
      if (gen !== this.refreshGen) return;
      if (postsRes.status === 'fulfilled') this.posts = postsRes.value.posts || [];
      if (impactRes.status === 'fulfilled') this.impact = impactRes.value;
      this.renderActiveTab();
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private renderActiveTab(): void {
    if (!this.listEl) return;
    if (this.activeTab === 'posts') this.renderPosts();
    else if (this.activeTab === 'impact') this.renderMarketImpact();
  }

  private renderPosts(): void {
    if (!this.listEl) return;
    if (this.posts.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No posts available</div>';
      return;
    }
    const sorted = [...this.posts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const rows = sorted
      .map(p => {
        const posted = new Date(p.created_at).toLocaleString();
        const sectorColor = SECTOR_COLORS[p.sector] || '#6b7280';
        const tickerTags = p.tickers
          .map(
            t => `<span class="sentiment-symbol" style="font-size:10px;">${escapeHtml(t)}</span>`
          )
          .join(' ');
        const topicTags = p.topics
          .map(
            t =>
              `<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:${SECTOR_COLORS[t] || '#6b7280'};color:#fff;margin-right:2px;">${t}</span>`
          )
          .join(' ');
        const sentimentColor =
          p.sentiment.score > 0.1 ? '#22c55e' : p.sentiment.score < -0.1 ? '#ef4444' : '#6b7280';
        return `
        <div style="padding:8px 4px;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text);line-height:1.4;margin-bottom:4px;">${escapeHtml(p.text)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;font-size:10px;color:var(--text-muted);">
            <span style="color:${sectorColor};font-weight:600;">${p.sector}</span>
            ${topicTags} ${tickerTags}
            <span>${posted}</span>
            <span style="color:${sentimentColor};">${p.sentiment.score.toFixed(2)}</span>
            <span>${p.favorites_count.toLocaleString()} fav</span>
          </div>
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;
  }

  private renderMarketImpact(): void {
    if (!this.listEl) return;
    if (!this.impact || this.impact.totalPosts === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No market impact data</div>';
      return;
    }
    let html = `<div style="padding:4px;font-size:11px;color:var(--text-muted);margin-bottom:4px;">${this.impact.totalPosts} posts analyzed</div>`;
    html +=
      '<div style="font-size:12px;font-weight:600;color:var(--text);padding:4px 0;">Sector Breakdown</div>';
    for (const [sector, data] of Object.entries(this.impact.sectorBreakdown)) {
      const color = SECTOR_COLORS[sector] || '#6b7280';
      const pct = Math.round(Math.abs(data.avgSentiment) * 100);
      const barColor =
        data.avgSentiment > 0.1 ? '#22c55e' : data.avgSentiment < -0.1 ? '#ef4444' : '#6b7280';
      html += `
        <div style="padding:4px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span><span style="color:${color};font-weight:600;">${sector}</span> — ${data.count} posts</span>
            <span style="color:${barColor};">${data.avgSentiment.toFixed(2)}</span>
          </div>
          <div class="sentiment-bar"><div class="sentiment-bar-fill" style="width:${Math.max(2, pct)}%;background:${barColor};"></div></div>
        </div>`;
    }
    if (this.impact.tickerMentions.length > 0) {
      html +=
        '<div style="font-size:12px;font-weight:600;color:var(--text);padding:8px 0 4px;">Ticker Mentions</div>';
      html += this.impact.tickerMentions
        .map(m => {
          const clamped = Math.max(-1, Math.min(1, m.sentiment));
          const pct = Math.round(Math.abs(clamped) * 100);
          const color = clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#6b7280';
          return `
          <div style="padding:4px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
            <span class="sentiment-symbol">${escapeHtml(m.symbol)}</span>
            <span class="sentiment-badge">${m.count}</span>
            <div class="sentiment-bar" style="flex:1;"><div class="sentiment-bar-fill" style="width:${Math.max(2, pct)}%;background:${color}"></div><span class="sentiment-score">${clamped.toFixed(2)}</span></div>
          </div>`;
        })
        .join('');
    }
    this.listEl.innerHTML = html;
  }
}
