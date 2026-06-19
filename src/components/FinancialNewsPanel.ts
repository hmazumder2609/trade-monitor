import { Panel } from './Panel';
import { fetchNews, type NewsArticle, type ThreatLevel } from '@/services/news';
import { formatTime, escapeHtml } from '@/utils';
import { getPreferences, setPreferences } from '@/services/settings-store';

interface NewsSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  type: 'rss' | 'twitter' | 'custom';
}

interface FinNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description?: string;
  image?: string | null;
  threatLevel?: string;
  matchedKeywords?: string[];
  category?: string;
}

const SOURCES_KEY = 'mdm-financial-news-sources';

const DEFAULT_SOURCES: NewsSource[] = [
  {
    id: 'kobeissi',
    name: 'The Kobeissi Letter',
    url: 'https://thekobeissiletter.com/blog/rss.xml',
    enabled: true,
    type: 'rss',
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    enabled: true,
    type: 'rss',
  },
  {
    id: 'cnbc',
    name: 'CNBC Finance',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    enabled: true,
    type: 'rss',
  },
  {
    id: 'bloomberg-markets',
    name: 'Bloomberg Markets',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    enabled: true,
    type: 'rss',
  },
  {
    id: 'ft-markets',
    name: 'Financial Times',
    url: 'https://www.ft.com/markets?format=rss',
    enabled: false,
    type: 'rss',
  },
  {
    id: 'wsj-markets',
    name: 'WSJ Markets',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    enabled: false,
    type: 'rss',
  },
  {
    id: 'zerohedge',
    name: 'ZeroHedge',
    url: 'https://feeds.feedburner.com/zerohedge/feed',
    enabled: false,
    type: 'rss',
  },
  {
    id: 'seeking-alpha',
    name: 'Seeking Alpha',
    url: 'https://seekingalpha.com/feed.xml',
    enabled: false,
    type: 'rss',
  },
];

function loadSources(): NewsSource[] {
  try {
    const stored = localStorage.getItem(SOURCES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...DEFAULT_SOURCES];
}

function saveSources(sources: NewsSource[]): void {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

const CATEGORY_LABELS: Record<string, string> = {
  tech: 'Tech',
  finance: 'Finance',
  world: 'World',
  ai: 'AI',
  china: 'China',
  science: 'Science',
  us: 'US',
  europe: 'Europe',
};
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

const THREAT_COLORS: Record<ThreatLevel, string> = {
  critical: 'var(--red)',
  high: 'var(--semantic-high)',
  medium: 'var(--yellow)',
  low: 'var(--blue)',
  info: 'var(--text-muted)',
};
const SOURCE_COLORS: Record<string, string> = {
  BBC: '#3b82f6',
  Reuters: '#ff8800',
  AP: '#44aa44',
  'Al Jazeera': '#9333ea',
};

export class FinancialNewsPanel extends Panel {
  private articles: FinNewsItem[] = [];
  private listEl: HTMLElement | null = null;
  private sourceManagerEl: HTMLElement | null = null;
  private showSourceManager = false;
  private activeFilter: string | null = null;
  private activeCategories: string[];

  constructor() {
    super({
      id: 'financial-news',
      title: 'Financial News',
      showCount: true,
      className: 'panel-wide',
    });
    this.activeCategories = getPreferences().newsCategories;
    this.buildLayout();
    this.refresh();
  }

  private buildLayout(): void {
    this.content.innerHTML = '';
    this.content.style.padding = '0';

    const controls = document.createElement('div');
    controls.className = 'finnews-controls';
    controls.innerHTML = `
      <div class="finnews-tabs" id="finnewsTabs"></div>
      <button class="trading-btn trading-btn-outline finnews-manage-btn" id="finnewsManageBtn">Sources</button>
    `;
    this.content.appendChild(controls);

    this.sourceManagerEl = document.createElement('div');
    this.sourceManagerEl.className = 'finnews-source-manager';
    this.sourceManagerEl.style.display = 'none';
    this.content.appendChild(this.sourceManagerEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'news-list';
    this.content.appendChild(this.listEl);

    controls.querySelector('#finnewsManageBtn')?.addEventListener('click', () => {
      this.showSourceManager = !this.showSourceManager;
      this.renderSourceManager();
    });

    this.renderSourceTabs();
  }

  private renderSourceTabs(): void {
    const tabsEl = this.content.querySelector('#finnewsTabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = '';

    for (const cat of ALL_CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = `panel-tab ${this.activeCategories.includes(cat) ? 'active' : ''}`;
      btn.textContent = CATEGORY_LABELS[cat] || cat;
      btn.addEventListener('click', () => this.toggleCategory(cat));
      tabsEl.appendChild(btn);
    }
  }

  private toggleCategory(cat: string): void {
    if (this.activeCategories.includes(cat)) {
      if (this.activeCategories.length <= 1) return;
      this.activeCategories = this.activeCategories.filter(c => c !== cat);
    } else {
      this.activeCategories = [...this.activeCategories, cat];
    }
    setPreferences({ newsCategories: this.activeCategories });
    this.renderSourceTabs();
    this.renderArticleList();
  }

  private renderSourceManager(): void {
    if (!this.sourceManagerEl) return;
    if (!this.showSourceManager) {
      this.sourceManagerEl.style.display = 'none';
      return;
    }
    this.sourceManagerEl.style.display = 'block';

    const sources = loadSources();
    this.sourceManagerEl.innerHTML = `
      <div class="finnews-sm-header">
        <span class="finnews-sm-title">RSS Sources</span>
        <button class="finnews-sm-close" id="finnewsSmClose">&times;</button>
      </div>
      <div class="finnews-sm-list">
        ${sources
          .map(
            s => `
          <div class="finnews-sm-item">
            <label class="finnews-sm-toggle">
              <input type="checkbox" ${s.enabled ? 'checked' : ''} data-source-id="${s.id}" />
              <span class="finnews-sm-name">${escapeHtml(s.name)}</span>
            </label>
            <span class="finnews-sm-type">${s.type.toUpperCase()}</span>
            ${!DEFAULT_SOURCES.find(d => d.id === s.id) ? `<button class="finnews-sm-remove" data-source-id="${s.id}">Remove</button>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
      <div class="finnews-sm-add">
        <input class="trading-input" id="finnewsNewName" placeholder="Source name" style="flex:1;" />
        <input class="trading-input" id="finnewsNewUrl" placeholder="RSS feed URL" style="flex:2;" />
        <button class="trading-btn trading-submit-btn" id="finnewsAddBtn" style="background:var(--blue);padding:6px 12px;">Add</button>
      </div>`;

    this.sourceManagerEl
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach(cb => {
        cb.addEventListener('change', () => {
          const src = loadSources().find(s => s.id === cb.dataset.sourceId);
          if (src) {
            src.enabled = cb.checked;
            saveSources(loadSources().map(s => (s.id === src!.id ? src! : s)));
          }
        });
      });
    this.sourceManagerEl.querySelectorAll<HTMLButtonElement>('.finnews-sm-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSources(loadSources().filter(s => s.id !== btn.dataset.sourceId));
        this.renderSourceManager();
      });
    });
    this.sourceManagerEl.querySelector('#finnewsAddBtn')?.addEventListener('click', () => {
      const name = (
        this.sourceManagerEl!.querySelector('#finnewsNewName') as HTMLInputElement
      ).value.trim();
      const url = (
        this.sourceManagerEl!.querySelector('#finnewsNewUrl') as HTMLInputElement
      ).value.trim();
      if (!name || !url) return;
      const sources = loadSources();
      sources.push({ id: `custom-${Date.now()}`, name, url, enabled: true, type: 'rss' });
      saveSources(sources);
      this.renderSourceManager();
      this.refresh();
    });
    this.sourceManagerEl.querySelector('#finnewsSmClose')?.addEventListener('click', () => {
      this.showSourceManager = false;
      this.renderSourceManager();
    });
  }

  async refresh(): Promise<void> {
    if (this.isFetching) return;
    this.setFetching(true);
    try {
      const [fetchedArticles, rssSources] = await Promise.all([
        fetchNews(),
        Promise.all(
          loadSources()
            .filter(s => s.enabled)
            .map(async src => {
              try {
                const resp = await fetch(
                  `/api/news/rss?url=${encodeURIComponent(src.url)}&source=${encodeURIComponent(src.name)}`
                );
                if (!resp.ok) return [];
                const data = (await resp.json()) as any;
                return (data.articles || data.items || []).map((item: any) => ({
                  title: item.title || '',
                  url: item.url || item.link || '#',
                  source: src.name,
                  publishedAt: item.publishedAt || item.pubDate || new Date().toISOString(),
                  description: item.description || item.summary || '',
                  image: item.image || null,
                  threatLevel: item.threatLevel || ('info' as const),
                  matchedKeywords: item.matchedKeywords || [],
                  category: item.category || 'finance',
                }));
              } catch {
                return [];
              }
            })
        ),
      ]);

      const rssArticles = rssSources.flat();
      const seen = new Set<string>();
      const merged = [...fetchedArticles, ...rssArticles]
        .filter(a => {
          const key = a.title.toLowerCase().slice(0, 40);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      this.articles = merged;
      this.renderArticleList();
      this.setDataBadge(merged.length > 0 ? 'live' : 'unavailable');
    } catch {
      this.setDataBadge('unavailable');
      this.renderArticleList();
    } finally {
      this.setFetching(false);
    }
  }

  private renderArticleList(): void {
    if (!this.listEl) return;
    let filtered = this.articles.filter(
      a => !a.category || this.activeCategories.includes(a.category)
    );
    if (this.activeFilter) {
      const src = loadSources().find(s => s.id === this.activeFilter);
      if (src) filtered = filtered.filter(a => a.source === src.name);
    }

    this.setCount(filtered.length);
    if (filtered.length === 0) {
      this.listEl.innerHTML =
        '<div class="panel-empty">No articles match the current filters.</div>';
      return;
    }

    this.listEl.innerHTML = filtered
      .map(a => {
        const threatColor = THREAT_COLORS[(a.threatLevel as ThreatLevel) || 'info'];
        const hasImage = a.image && !a.image.includes('data:');
        const sourceColor = SOURCE_COLORS[a.source] || '#666';
        const matchBadges = (a.matchedKeywords || [])
          .map(kw => `<span class="news-keyword-badge">${escapeHtml(kw)}</span>`)
          .join('');
        const thumbHtml = hasImage
          ? `<div class="news-thumb"><img src="${a.image}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'news-thumb-fallback\\'>📰</div>'" /></div>`
          : `<div class="news-thumb"><div class="news-thumb-fallback">📰</div></div>`;

        return `
        <div class="news-item-rich">
          <div class="news-item-threat" style="background:${threatColor}"></div>
          ${thumbHtml}
          <div class="news-item-body">
            <div class="news-item-header">
              <a href="${a.url}" target="_blank" rel="noopener" class="news-title">${escapeHtml(a.title)}</a>
            </div>
            ${a.description ? `<div class="news-description">${escapeHtml(a.description)}</div>` : ''}
            <div class="news-meta">
              <span class="source-badge" style="background-color:${sourceColor}">${escapeHtml(a.source)}</span>
              <span class="news-time">${formatTime(new Date(a.publishedAt))}</span>
              ${a.threatLevel && a.threatLevel !== 'info' ? `<span class="news-threat-label" style="color:${threatColor}">${a.threatLevel.toUpperCase()}</span>` : ''}
              ${matchBadges}
            </div>
          </div>
        </div>`;
      })
      .join('');
  }
}
