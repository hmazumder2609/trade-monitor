import { Panel } from '@/components/Panel';
import {
  dataLayer,
  X_WATCH_SOURCE_ID,
  getWatchlistSymbols,
  type XWatchData,
  type XTweet,
  type XWatchMention,
} from '@/services/data-layer';
import {
  escapeHtml,
  createSourceBadge,
  createDataLink,
  formatTimestamp,
  createTickerTags,
  createMetaRow,
  createScoreBadge,
} from '@/utils';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

type TabId = 'tweets' | 'sentiment' | 'byaccount';

interface TrackedAccount {
  name: string;
  platform: 'twitter' | 'reddit';
}

const STORAGE_KEY = 'mdm-x-watch-accounts';

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

export class XWatchPanel extends Panel {
  private tweets: XTweet[] = [];
  private mentions: XWatchMention[] = [];
  private byAccount: Record<string, XTweet[]> = {};
  private activeTab: TabId = 'tweets';
  private tabsEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;
  private dataUnsub: (() => void) | null = null;
  private trackedAccounts: TrackedAccount[] = [];

  constructor() {
    super({ id: 'x-watch', title: 'XWatch', className: 'panel-wide' });
    this.trackedAccounts = loadTrackedAccounts();
    this.buildLayout();
    this.setupDataSubscription();
    this.refresh();
  }

  private setupDataSubscription(): void {
    this.dataUnsub = dataLayer.subscribe<XWatchData>(X_WATCH_SOURCE_ID, data => {
      if (!data) return;
      this.tweets = data.tweets || [];
      this.mentions = data.mentions || [];
      this.byAccount = data.byAccount || {};
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
      this.setDataWindow('Latest');
      await dataLayer.fetch(X_WATCH_SOURCE_ID);
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
    this.listEl.innerHTML = '';
    for (const t of sorted) {
      const item = document.createElement('div');
      item.className = 'sentiment-row';
      item.style.cssText = 'border-bottom:1px solid var(--border-subtle);padding:8px 4px;';

      const header = document.createElement('div');
      header.className = 'sentiment-row-header';
      header.style.cssText =
        'display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;flex-wrap:wrap;';

      const author = document.createElement('span');
      author.style.cssText = 'font-size:11px;font-weight:600;color:#1d9bf0;';
      author.textContent = `@${escapeHtml(t.author.username)}`;
      header.appendChild(author);

      const label = document.createElement('span');
      label.style.cssText = 'font-size:10px;color:var(--text-muted);';
      label.textContent = escapeHtml(t.author.label);
      header.appendChild(label);

      item.appendChild(header);

      const tweetUrl = `https://x.com/${t.author.username}/status/${t.id}`;
      const titleLink = createDataLink(
        tweetUrl,
        t.text.slice(0, 160) + (t.text.length > 160 ? '...' : '')
      );
      titleLink.style.cssText = 'display:block;margin-top:4px;font-size:12px;line-height:1.4;';
      item.appendChild(titleLink);

      const tickerTags = createTickerTags(t.tickers);
      const sentimentColor =
        t.sentiment.score > 0.1 ? '#22c55e' : t.sentiment.score < -0.1 ? '#ef4444' : '#6b7280';

      const meta = createMetaRow(
        createSourceBadge('x', 'X / Twitter'),
        (() => {
          const time = document.createElement('time');
          time.className = 'data-time';
          time.dateTime = new Date(t.created_at).toISOString();
          time.textContent = formatTimestamp(new Date(t.created_at));
          return time;
        })(),
        (() => {
          const span = document.createElement('span');
          span.textContent = `♥ ${t.like_count.toLocaleString()}`;
          span.style.fontSize = '10px';
          return span;
        })(),
        (() => {
          const span = document.createElement('span');
          span.textContent = `🔁 ${t.retweet_count.toLocaleString()}`;
          span.style.fontSize = '10px';
          return span;
        })(),
        createScoreBadge(t.sentiment.score),
        tickerTags
      );
      item.appendChild(meta);

      this.listEl.appendChild(item);
    }
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
    this.listEl.innerHTML = '';
    for (const name of accountNames) {
      const tweets = this.byAccount[name].slice(0, 5);
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:8px;';

      const header = document.createElement('div');
      header.className = 'data-meta';
      header.style.cssText =
        'padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;';
      header.appendChild(createSourceBadge('x', `@${escapeHtml(name)}`));
      section.appendChild(header);

      for (const t of tweets) {
        const item = document.createElement('div');
        item.style.cssText = 'padding:4px 0;font-size:11px;';

        const tweetUrl = `https://x.com/${name}/status/${t.id}`;
        const titleLink = createDataLink(
          tweetUrl,
          t.text.slice(0, 200) + (t.text.length > 200 ? '...' : '')
        );
        titleLink.style.cssText = 'font-size:11px;display:block;';
        item.appendChild(titleLink);

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
        platforms: ['twitter', 'reddit'],
        placeholder: '@username or r/subreddit',
      },
    ];

    return createSettingsForm({
      title: 'XWatch',
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
