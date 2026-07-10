import { Panel } from '@/components/Panel';
import {
  dataLayer,
  REDDIT_PULSE_SOURCE_ID,
  getWatchlistSymbols,
  type RedditPulseData,
  type RedditPost,
  type RedditMention,
  type RedditBreakout,
} from '@/services/data-layer';
import {
  escapeHtml,
  createSourceBadge,
  createDataLink,
  formatTimestamp,
  createTickerTags,
  createMetaRow,
} from '@/utils';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

type TabId = 'feed' | 'sentiment' | 'bysub';

interface TrackedAccount {
  name: string;
  platform: 'twitter' | 'reddit';
}

const STORAGE_KEY = 'mdm-reddit-pulse-accounts';

function loadTrackedAccounts(): TrackedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveTrackedAccounts(accounts: TrackedAccount[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export class RedditPulsePanel extends Panel {
  private posts: RedditPost[] = [];
  private mentions: RedditMention[] = [];
  private breakouts: RedditBreakout[] = [];
  private groups: Record<string, RedditPost[]> = {};
  private activeTab: TabId = 'feed';
  private expandedPost: string | null = null;
  private tabsEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;
  private dataUnsub: (() => void) | null = null;
  private trackedAccounts: TrackedAccount[] = [];

  constructor() {
    super({ id: 'reddit-pulse', title: 'RedditPulse', className: 'panel-wide' });
    this.trackedAccounts = loadTrackedAccounts();
    this.buildLayout();
    this.setupDataSubscription();
    this.refresh();
  }

  private setupDataSubscription(): void {
    this.dataUnsub = dataLayer.subscribe<RedditPulseData>(REDDIT_PULSE_SOURCE_ID, data => {
      if (!data) return;
      this.posts = data.posts || [];
      this.mentions = data.mentions || [];
      this.breakouts = data.breakouts || [];
      this.groups = data.bySubreddit || {};
      this.renderSummary();
      this.renderActiveTab();
    });
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    // Tabs row
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

    // Sentiment summary (pinned at top)
    this.summaryEl = document.createElement('div');
    this.summaryEl.className = 'sentiment-summary';
    this.content.appendChild(this.summaryEl);

    // Scrollable feed below
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
      this.setDataWindow('Latest');
      await dataLayer.fetch(REDDIT_PULSE_SOURCE_ID);
      if (gen !== this.refreshGen) return;
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private renderSummary(): void {
    if (!this.summaryEl) return;
    if (this.mentions.length === 0) {
      this.summaryEl.innerHTML = '<div class="sentiment-summary-empty">No sentiment data yet</div>';
      return;
    }
    const sorted = [...this.mentions].sort((a, b) => b.count - a.count);
    const rows = sorted
      .slice(0, 8)
      .map(m => {
        const clamped = Math.max(-1, Math.min(1, m.sentiment));
        const pct = Math.round(Math.abs(clamped) * 100);
        const color = clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#6b7280';
        const breakout = this.breakouts.find(b => b.symbol === m.symbol);
        const breakoutBadge = breakout?.isBreakout
          ? '<span style="font-size:8px;padding:0 3px;border-radius:2px;background:#ef4444;color:#fff;margin-left:4px;">!</span>'
          : '';
        return `
        <div class="sentiment-summary-row">
          <span class="sentiment-summary-symbol">${escapeHtml(m.symbol)}${breakoutBadge}</span>
          <div class="sentiment-summary-bar">
            <div class="sentiment-summary-bar-fill" style="width:${Math.max(2, pct)}%;background:${color}"></div>
          </div>
          <span class="sentiment-summary-score" style="color:${color}">${clamped.toFixed(2)}</span>
          <span class="sentiment-summary-count">${m.count} mentions</span>
        </div>`;
      })
      .join('');
    this.summaryEl.innerHTML = rows;
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
    const rows = sorted.slice(0, 30).map(p => {
      const isExpanded = this.expandedPost === p.permalink;
      const tickerTags = createTickerTags(p.tickers);
      const postUrl = `https://reddit.com${p.permalink}`;
      const item = document.createElement('div');
      item.className = 'sentiment-row';
      item.dataset.permalink = p.permalink;
      item.style.cssText = 'border-bottom:1px solid var(--border-subtle);padding:8px 4px;';

      const header = document.createElement('div');
      header.className = 'sentiment-row-header';
      header.style.cssText =
        'display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;flex-wrap:wrap;';

      const titleLink = createDataLink(postUrl, escapeHtml(p.title));
      titleLink.style.cssText =
        'flex:1;min-width:0;font-size:12px;line-height:1.4;font-weight:500;';
      titleLink.addEventListener('click', e => e.stopPropagation());
      header.appendChild(titleLink);

      const typeBadge = document.createElement('span');
      typeBadge.style.cssText =
        'font-size:10px;padding:1px 6px;border-radius:4px;background:' +
        (badgeColors[p.contentType] || '#6b7280') +
        ';color:#fff;white-space:nowrap;';
      typeBadge.textContent = p.contentType;
      header.appendChild(typeBadge);

      item.appendChild(header);

      const meta = createMetaRow(
        createSourceBadge('reddit', `r/${escapeHtml(p.subreddit)}`),
        formatTimestamp(new Date(p.created_utc * 1000)),
        (() => {
          const score = document.createElement('span');
          score.style.fontWeight = '600';
          score.textContent = `${p.score} pts`;
          return score;
        })(),
        tickerTags
      );
      item.appendChild(meta);

      if (isExpanded && p.selftext) {
        const expanded = document.createElement('div');
        expanded.style.cssText =
          'margin-top:4px;font-size:11px;color:var(--text-muted);line-height:1.4;';
        expanded.textContent = p.selftext;
        item.appendChild(expanded);
      }

      return item;
    });

    this.listEl.innerHTML = '';
    for (const row of rows) {
      this.listEl.appendChild(row);
    }

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
    this.listEl.innerHTML = '';
    for (const sub of subNames.sort()) {
      const posts = this.groups[sub].slice(0, 5);
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:8px;';

      const header = document.createElement('div');
      header.className = 'data-meta';
      header.style.cssText =
        'padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;';
      header.appendChild(createSourceBadge('reddit', `r/${escapeHtml(sub)}`));

      const count = document.createElement('span');
      count.style.cssText = 'font-size:10px;color:var(--text-muted);';
      count.textContent = `${posts.length} posts`;
      header.appendChild(count);

      section.appendChild(header);

      for (const p of posts) {
        const item = document.createElement('div');
        item.style.cssText =
          'padding:4px 0;font-size:11px;display:flex;justify-content:space-between;';

        const titleLink = createDataLink(`https://reddit.com${p.permalink}`, escapeHtml(p.title));
        titleLink.style.cssText =
          'font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;';
        item.appendChild(titleLink);

        const score = document.createElement('span');
        score.style.cssText = 'color:var(--text-muted);margin-left:8px;font-size:11px;';
        score.textContent = `${p.score} pts`;
        item.appendChild(score);

        section.appendChild(item);
      }

      this.listEl.appendChild(section);
    }
  }

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const schema: SettingSchema<Record<string, unknown>>[] = [
      {
        key: 'trackedAccounts',
        label: 'Tracked Accounts',
        type: 'tracked-list',
        platforms: ['reddit', 'twitter'],
        placeholder: '@username or r/subreddit',
      },
    ];

    return createSettingsForm({
      title: 'RedditPulse',
      schema,
      initialValues: { trackedAccounts: this.trackedAccounts },
      onChange: vals => {
        this.trackedAccounts = (vals.trackedAccounts as TrackedAccount[]) || [];
        saveTrackedAccounts(this.trackedAccounts);
      },
    });
  }

  public destroy(): void {
    this.dataUnsub?.();
    super.destroy();
  }
}
