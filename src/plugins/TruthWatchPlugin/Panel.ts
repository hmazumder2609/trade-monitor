import { Panel } from '@/components/Panel';
import { fetchPosts, fetchMarketImpact, type TruthPost, type MarketImpact } from './service';
import { escapeHtml } from '@/utils';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';
import {
  createSourceBadge,
  formatTimestamp,
  createDataLink,
  createTickerTags,
  createScoreBadge,
  createMetaRow,
} from '@/utils/data-display';

interface TruthWatchSettings {
  autoRefresh: boolean;
  sortOrder: 'newest' | 'oldest';
}

const STORAGE_KEY = 'mdm-truth-watch-settings';

function loadSettings(): TruthWatchSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultSettings };
}

function saveSettings(settings: TruthWatchSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const defaultSettings: TruthWatchSettings = { autoRefresh: true, sortOrder: 'newest' };

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
  private settings: TruthWatchSettings;

  constructor() {
    super({ id: 'truth-watch', title: 'TruthWatch', className: 'panel-wide' });
    this.settings = loadSettings();
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
      this.setDataWindow('Latest');
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
    const sorted = [...this.posts].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return this.settings.sortOrder === 'oldest' ? -diff : diff;
    });
    this.listEl.innerHTML = '';
    for (const p of sorted) {
      const item = document.createElement('div');
      item.className = 'sentiment-row';
      item.style.cssText = 'border-bottom:1px solid var(--border-subtle);padding:8px 4px;';

      const header = document.createElement('div');
      header.className = 'sentiment-row-header';
      header.style.cssText =
        'display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;flex-wrap:wrap;';

      if (p.url) {
        const titleLink = createDataLink(
          p.url,
          p.text.slice(0, 120) + (p.text.length > 120 ? '...' : '')
        );
        titleLink.style.cssText =
          'flex:1;min-width:0;font-size:12px;line-height:1.4;font-weight:500;';
        header.appendChild(titleLink);
      } else {
        const textSpan = document.createElement('span');
        textSpan.style.cssText =
          'flex:1;min-width:0;color:var(--text);font-size:12px;line-height:1.4;';
        textSpan.textContent = p.text;
        header.appendChild(textSpan);
      }

      item.appendChild(header);

      const sectorColor = SECTOR_COLORS[p.sector] || '#6b7280';
      const tickerTags = createTickerTags(p.tickers);
      const topicTags = document.createElement('span');
      topicTags.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;';
      for (const t of p.topics) {
        const tag = document.createElement('span');
        tag.textContent = t;
        tag.style.cssText = `font-size:9px;padding:1px 4px;border-radius:3px;background:${SECTOR_COLORS[t] || '#6b7280'};color:#fff;`;
        topicTags.appendChild(tag);
      }
      const sentimentColor =
        p.sentiment.score > 0.1 ? '#22c55e' : p.sentiment.score < -0.1 ? '#ef4444' : '#6b7280';

      const meta = createMetaRow(
        createSourceBadge('truth', 'Truth Social'),
        (() => {
          const span = document.createElement('span');
          span.style.cssText = `color:${sectorColor};font-weight:600;font-size:10px;`;
          span.textContent = p.sector;
          return span;
        })(),
        topicTags,
        tickerTags,
        (() => {
          const time = document.createElement('time');
          time.className = 'data-time';
          time.dateTime = new Date(p.created_at).toISOString();
          time.textContent = formatTimestamp(new Date(p.created_at));
          return time;
        })(),
        createScoreBadge(p.sentiment.score),
        (() => {
          const span = document.createElement('span');
          span.textContent = `${p.favorites_count.toLocaleString()} fav`;
          span.style.fontSize = '10px';
          return span;
        })()
      );
      item.appendChild(meta);

      this.listEl.appendChild(item);
    }
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

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<TruthWatchSettings>[] = [
      { key: 'autoRefresh', label: 'Auto-refresh', type: 'checkbox' },
      {
        key: 'sortOrder',
        label: 'Sort Order',
        type: 'select',
        options: [
          { value: 'newest', label: 'Newest first' },
          { value: 'oldest', label: 'Oldest first' },
        ],
      },
    ];

    return createSettingsForm<TruthWatchSettings>({
      title: 'TruthWatch Settings',
      schema,
      initialValues: { ...this.settings },
      onChange: vals => {
        this.settings = vals;
        saveSettings(this.settings);
        this.renderActiveTab();
      },
    });
  }
}
