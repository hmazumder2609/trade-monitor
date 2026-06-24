import { Panel } from '@/components/Panel';
import {
  dataLayer,
  SOCIAL_SENTIMENT_SOURCE_ID,
  getWatchlistSymbols,
  type SocialSentimentData,
  type MentionCount,
} from '@/services/data-layer';
import { escapeHtml } from '@/utils';

interface TrackedAccount {
  name: string;
  platform: 'twitter' | 'reddit';
}

const STORAGE_KEY = 'mdm-social-sentiment-accounts';

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

export class SocialSentimentPanel extends Panel {
  private trending: MentionCount[] = [];
  private mentions: MentionCount[] = [];
  private twitterSentiment: MentionCount[] = [];
  private activeTab: 'trending' | 'reddit' | 'twitter' = 'trending';
  private expandedSymbol: string | null = null;
  private tabsEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;
  private dataUnsub: (() => void) | null = null;
  private trackedAccounts: TrackedAccount[] = [];

  constructor() {
    super({ id: 'social-sentiment', title: 'Social Sentiment', className: 'panel-wide' });
    this.trackedAccounts = loadTrackedAccounts();
    this.buildLayout();
    this.setupDataSubscription();
    this.refresh();
  }

  private setupDataSubscription(): void {
    this.dataUnsub = dataLayer.subscribe<SocialSentimentData>(SOCIAL_SENTIMENT_SOURCE_ID, data => {
      if (!data) return;
      this.trending = data.trending || [];
      this.mentions = data.mentions || [];
      this.twitterSentiment = data.twitterSentiment || [];
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
    filterBtn.textContent = this.watchlistOnly ? '📋 Watchlist' : '🌐 All Symbols';
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
      await dataLayer.fetch(SOCIAL_SENTIMENT_SOURCE_ID);
      if (gen !== this.refreshGen) return;
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private getAllMentions(): MentionCount[] {
    const merged = new Map<string, MentionCount>();
    for (const m of [...this.trending, ...this.mentions, ...this.twitterSentiment]) {
      const existing = merged.get(m.symbol);
      if (existing) {
        existing.count += m.count;
        existing.positiveCount += m.positiveCount;
        existing.negativeCount += m.negativeCount;
        existing.sentiment = (existing.sentiment + m.sentiment) / 2;
      } else {
        merged.set(m.symbol, { ...m });
      }
    }
    return [...merged.values()].sort((a, b) => b.count - a.count);
  }

  private renderSummary(): void {
    if (!this.summaryEl) return;
    const all = this.getAllMentions();
    if (all.length === 0) {
      this.summaryEl.innerHTML = '<div class="sentiment-summary-empty">No sentiment data yet</div>';
      return;
    }
    const rows = all
      .slice(0, 8)
      .map(m => {
        const clamped = Math.max(-1, Math.min(1, m.sentiment));
        const pct = Math.round(Math.abs(clamped) * 100);
        const color = clamped > 0.1 ? '#22c55e' : clamped < -0.1 ? '#ef4444' : '#6b7280';
        return `
        <div class="sentiment-summary-row">
          <span class="sentiment-summary-symbol">${escapeHtml(m.symbol)}</span>
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
        const postsHtml =
          isExpanded && item.posts.length > 0
            ? `<div class="sentiment-posts">${item.posts
                .map(
                  p => `
            <div class="sentiment-post">
              <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="sentiment-post-title">${escapeHtml(p.title)}</a>
              <div class="sentiment-post-meta">
                <span class="sentiment-post-score">${p.score} pts</span>
                <span class="sentiment-post-platform">${escapeHtml(p.platform)}</span>
              </div>
            </div>`
                )
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

  // ──────────────────────────────────────────────
  //  Settings popover (⚙ gear)
  // ──────────────────────────────────────────────

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    const renderList = () => {
      const list = el.querySelector('.social-settings-list');
      if (!list) return;
      if (this.trackedAccounts.length === 0) {
        list.innerHTML =
          '<div class="social-settings-item" style="color:var(--text-muted);justify-content:center;">No tracked accounts</div>';
        return;
      }
      list.innerHTML = this.trackedAccounts
        .map(
          (a, i) => `
        <div class="social-settings-item">
          <span class="social-settings-item-name">${escapeHtml(a.name)}</span>
          <span class="social-settings-item-platform">${a.platform}</span>
          <button class="social-settings-item-remove" data-idx="${i}" title="Remove">&times;</button>
        </div>
      `
        )
        .join('');

      list.querySelectorAll<HTMLButtonElement>('.social-settings-item-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx!, 10);
          this.trackedAccounts.splice(idx, 1);
          saveTrackedAccounts(this.trackedAccounts);
          renderList();
        });
      });
    };

    el.innerHTML = `
      <div class="social-settings-header">Tracked Accounts</div>
      <div class="social-settings-list"></div>
      <div class="social-settings-add">
        <input type="text" class="social-settings-input" id="ssAccountName" placeholder="@username or r/subreddit" />
        <select class="social-settings-select" id="ssPlatform">
          <option value="twitter">Twitter</option>
          <option value="reddit">Reddit</option>
        </select>
        <button class="social-settings-add-btn" id="ssAddBtn">Add</button>
      </div>
    `;

    renderList();

    const addBtn = el.querySelector('#ssAddBtn')!;
    addBtn.addEventListener('click', () => {
      const name = (el.querySelector('#ssAccountName') as HTMLInputElement).value.trim();
      const platform = (el.querySelector('#ssPlatform') as HTMLSelectElement).value as
        | 'twitter'
        | 'reddit';
      if (!name) return;

      // Normalize: add @ for twitter, r/ for reddit if missing
      let normalizedName = name;
      if (platform === 'twitter' && !name.startsWith('@')) normalizedName = '@' + name;
      if (platform === 'reddit' && !name.startsWith('r/')) normalizedName = 'r/' + name;

      // Don't add duplicates
      if (!this.trackedAccounts.some(a => a.name === normalizedName && a.platform === platform)) {
        this.trackedAccounts.push({ name: normalizedName, platform });
        saveTrackedAccounts(this.trackedAccounts);
      }

      (el.querySelector('#ssAccountName') as HTMLInputElement).value = '';
      renderList();
    });

    el.querySelector('#ssAccountName')!.addEventListener('keydown', e => {
      if ((e as KeyboardEvent).key === 'Enter') (addBtn as HTMLElement).click();
    });

    return el;
  }

  public destroy(): void {
    this.dataUnsub?.();
    super.destroy();
  }
}
