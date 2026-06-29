import { Panel } from '@/components/Panel';
import {
  dataLayer,
  REDDIT_PULSE_SOURCE_ID,
  X_WATCH_SOURCE_ID,
  getWatchlistSymbols,
  type RedditPost,
  type RedditPulseData,
  type XTweet,
  type XWatchData,
} from '@/services/data-layer';
import { escapeHtml } from '@/utils';
import { fetchPosts, type TruthPost } from '@/plugins/TruthWatchPlugin/service';
import { createSettingsForm, type SettingSchema } from '@/utils/settings-form';

interface SocialMonitorSettings {
  platforms: { reddit: boolean; truth: boolean; x: boolean };
  minScore: number;
}

const DEFAULT_SETTINGS: SocialMonitorSettings = {
  platforms: { reddit: true, truth: true, x: true },
  minScore: 0,
};

type Platform = 'all' | 'reddit' | 'truth' | 'x';

const PLATFORM_META: Record<Platform, { label: string; color: string }> = {
  all: { label: 'All', color: 'var(--accent)' },
  reddit: { label: 'Reddit', color: '#ff4500' },
  truth: { label: 'Truth Social', color: '#1a1a2e' },
  x: { label: 'X / Twitter', color: '#1d9bf0' },
};

interface UnifiedPost {
  platform: 'reddit' | 'truth' | 'x';
  title: string;
  content: string;
  url: string;
  author: string;
  score: number;
  created: string;
  tickerTags: string[];
}

export class SocialMonitorPanel extends Panel {
  private posts: UnifiedPost[] = [];
  private activeTab: Platform = 'all';
  private tabsEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private watchlistOnly = true;
  private refreshGen = 0;
  private redditUnsub: (() => void) | null = null;
  private xUnsub: (() => void) | null = null;
  private redditPosts: RedditPost[] = [];
  private xTweets: XTweet[] = [];
  private truthPosts: TruthPost[] = [];
  private settings: SocialMonitorSettings;

  constructor() {
    super({ id: 'social-monitor', title: 'Social Monitor' });
    this.settings = this.loadSettings();
    this.buildLayout();
    this.setupDataSubscriptions();
    this.refresh();
  }

  private loadSettings(): SocialMonitorSettings {
    try {
      const raw = localStorage.getItem('mdm-social-monitor-settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    localStorage.setItem('mdm-social-monitor-settings', JSON.stringify(this.settings));
  }

  private setupDataSubscriptions(): void {
    this.redditUnsub = dataLayer.subscribe(
      REDDIT_PULSE_SOURCE_ID,
      (data: RedditPulseData | null) => {
        if (!data) return;
        this.redditPosts = data.posts || [];
        this.mergeAndRender();
      }
    );
    this.xUnsub = dataLayer.subscribe(X_WATCH_SOURCE_ID, (data: XWatchData | null) => {
      if (!data) return;
      this.xTweets = data.tweets || [];
      this.mergeAndRender();
    });
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
    const tabs: { id: Platform; label: string }[] = [
      { id: 'all', label: 'All' },
      { id: 'reddit', label: 'Reddit' },
      { id: 'truth', label: 'Truth Social' },
      { id: 'x', label: 'X / Twitter' },
    ];
    for (const t of tabs) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${t.id === this.activeTab ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.activeTab = t.id;
        this.renderTabs();
        this.renderPosts();
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
      await Promise.allSettled([
        fetchPosts().then(res => {
          this.truthPosts = res.posts || [];
        }),
        dataLayer.fetch(REDDIT_PULSE_SOURCE_ID),
        dataLayer.fetch(X_WATCH_SOURCE_ID),
      ]);
      if (gen !== this.refreshGen) return;
      this.mergeAndRender();
    } finally {
      if (gen === this.refreshGen) this.setFetching(false);
    }
  }

  private mergeAndRender(): void {
    const watchlist = this.watchlistOnly ? getWatchlistSymbols() : [];
    const hasWatchlist = this.watchlistOnly && watchlist.length > 0;

    const redditUnified: UnifiedPost[] = this.settings.platforms.reddit
      ? this.redditPosts.map(p => ({
          platform: 'reddit' as const,
          title: p.title,
          content: p.selftext || '',
          url: `https://reddit.com${p.permalink}`,
          author: `r/${p.subreddit}`,
          score: p.score,
          created: new Date(p.created_utc * 1000).toISOString(),
          tickerTags: p.tickers,
        }))
      : [];

    const xUnified: UnifiedPost[] = this.settings.platforms.x
      ? this.xTweets.map(t => ({
          platform: 'x' as const,
          title: t.text.slice(0, 100) + (t.text.length > 100 ? '...' : ''),
          content: t.text,
          url: `https://x.com/${t.author.username}/status/${t.id}`,
          author: `@${t.author.username}`,
          score: t.like_count,
          created: t.created_at,
          tickerTags: t.tickers,
        }))
      : [];

    const truthUnified: UnifiedPost[] = this.settings.platforms.truth
      ? this.truthPosts.map(p => ({
          platform: 'truth' as const,
          title: p.text.slice(0, 100) + (p.text.length > 100 ? '...' : ''),
          content: p.text,
          url: p.url || '',
          author: p.sector || 'Truth Social',
          score: p.favorites_count,
          created: p.created_at,
          tickerTags: p.tickers,
        }))
      : [];

    let allPosts = [...redditUnified, ...xUnified, ...truthUnified];

    if (this.settings.minScore > 0) {
      allPosts = allPosts.filter(p => p.score >= this.settings.minScore);
    }

    if (hasWatchlist) {
      const watchSet = new Set(watchlist.map(s => s.toUpperCase()));
      allPosts = allPosts.filter(p => p.tickerTags.some(t => watchSet.has(t.toUpperCase())));
    }

    allPosts.sort((a, b) => b.score - a.score);
    this.posts = allPosts;
    this.renderPosts();
  }

  private renderPosts(): void {
    if (!this.listEl) return;
    const filtered =
      this.activeTab === 'all' ? this.posts : this.posts.filter(p => p.platform === this.activeTab);

    if (filtered.length === 0) {
      this.listEl.innerHTML = '<div class="panel-empty">No posts available</div>';
      return;
    }

    const rows = filtered
      .slice(0, 50)
      .map(p => {
        const meta = PLATFORM_META[p.platform];
        const posted = new Date(p.created).toLocaleString();
        const tickerBadges = p.tickerTags
          .map(
            t => `<span class="sentiment-symbol" style="font-size:10px;">${escapeHtml(t)}</span>`
          )
          .join(' ');
        return `
        <div class="sentiment-row" style="padding:6px 4px;border-bottom:1px solid var(--border);cursor:pointer;" data-url="${escapeHtml(p.url)}">
          <div class="sentiment-row-header" style="gap:4px;flex-wrap:wrap;">
            <span class="sentiment-badge" style="background:${meta.color};font-size:9px;">${meta.label}</span>
            <span style="font-size:12px;font-weight:600;color:var(--text);flex:1;">${escapeHtml(p.title)}</span>
            <span class="sentiment-score">${p.score.toLocaleString()}</span>
          </div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;font-size:10px;color:var(--text-muted);">
            <span>${escapeHtml(p.author)}</span>
            ${tickerBadges}
            <span style="margin-left:auto;">${posted}</span>
          </div>
        </div>`;
      })
      .join('');
    this.listEl.innerHTML = rows;

    this.listEl.querySelectorAll('[data-url]').forEach(el => {
      el.addEventListener('click', () => {
        const url = (el as HTMLElement).dataset.url;
        if (url) window.open(url, '_blank');
      });
    });
  }

  public getSettingsPopover(): HTMLElement {
    type FlatSettings = {
      reddit: boolean;
      truth: boolean;
      x: boolean;
      minScore: number;
    };

    const schema: SettingSchema<FlatSettings>[] = [
      { key: 'reddit', label: 'Reddit', type: 'checkbox' },
      { key: 'truth', label: 'Truth Social', type: 'checkbox' },
      { key: 'x', label: 'X / Twitter', type: 'checkbox' },
      { key: 'minScore', label: 'Min score', type: 'number', min: 0, step: 10 },
    ];

    return createSettingsForm<FlatSettings>({
      title: 'Social Monitor Settings',
      schema,
      initialValues: {
        reddit: this.settings.platforms.reddit,
        truth: this.settings.platforms.truth,
        x: this.settings.platforms.x,
        minScore: this.settings.minScore,
      },
      onChange: vals => {
        this.settings.platforms.reddit = vals.reddit;
        this.settings.platforms.truth = vals.truth;
        this.settings.platforms.x = vals.x;
        this.settings.minScore = vals.minScore;
        this.saveSettings();
        this.mergeAndRender();
      },
    });
  }

  public destroy(): void {
    this.redditUnsub?.();
    this.xUnsub?.();
    super.destroy();
  }
}
