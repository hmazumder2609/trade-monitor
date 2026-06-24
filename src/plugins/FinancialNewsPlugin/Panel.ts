import { Panel } from '@/components/Panel';
import { fetchNews, type ThreatLevel } from '@/services/news';
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
  private activeThreatLevels: ThreatLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
  private keywordFilter = '';
  private highlightKeywords: string[] = [];

  constructor() {
    super({
      id: 'financial-news',
      title: 'Financial News',
      showCount: true,
      className: 'panel-wide',
    });
    this.activeCategories = getPreferences().newsCategories;
    this.loadFilterState();
    this.buildLayout();
    this.refresh();
  }

  private loadFilterState(): void {
    try {
      const stored = localStorage.getItem('mdm-financial-news-filters');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.activeThreatLevels = parsed.threatLevels || ['critical', 'high', 'medium', 'low', 'info'];
        this.keywordFilter = parsed.keywordFilter || '';
        this.highlightKeywords = parsed.highlightKeywords || [];
      }
    } catch {}
  }

  private saveFilterState(): void {
    localStorage.setItem('mdm-financial-news-filters', JSON.stringify({
      threatLevels: this.activeThreatLevels,
      keywordFilter: this.keywordFilter,
      highlightKeywords: this.highlightKeywords,
    }));
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

  public getSettingsPopover(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'social-settings';

    const isDefault = (id: string) => DEFAULT_SOURCES.some(d => d.id === id);

    const renderList = () => {
      const list = el.querySelector('.social-settings-list');
      if (!list) return;
      const sources = loadSources();
      if (sources.length === 0) {
        list.innerHTML =
          '<div class="social-settings-item" style="color:var(--text-muted);justify-content:center;">No sources configured</div>';
        return;
      }
      list.innerHTML = sources
        .map(
          s => `
        <div class="social-settings-item">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;">
            <input type="checkbox" ${s.enabled ? 'checked' : ''} data-source-id="${s.id}" />
            <span class="social-settings-item-name">${escapeHtml(s.name)}</span>
          </label>
          <span class="social-settings-item-platform">${s.type.toUpperCase()}</span>
          ${!isDefault(s.id) ? `<button class="social-settings-item-remove" data-source-id="${s.id}" title="Remove">&times;</button>` : ''}
        </div>
      `
        )
        .join('');

      list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const src = loadSources().find(s => s.id === cb.dataset.sourceId);
          if (src) {
            src.enabled = cb.checked;
            saveSources(loadSources().map(s => (s.id === src!.id ? src! : s)));
          }
        });
      });

      list.querySelectorAll<HTMLButtonElement>('.social-settings-item-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          saveSources(loadSources().filter(s => s.id !== btn.dataset.sourceId));
          renderList();
        });
      });
    };

    const renderThreatToggles = () => {
      const container = el.querySelector('#fnThreatToggles');
      if (!container) return;
      const levels: ThreatLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
      container.innerHTML = levels.map(level => `
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0;">
          <input type="checkbox" ${this.activeThreatLevels.includes(level) ? 'checked' : ''} data-level="${level}" />
          <span style="color:${THREAT_COLORS[level]};font-size:10px;font-weight:700;">${level.toUpperCase()}</span>
        </label>
      `).join('');

      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const level = cb.dataset.level as ThreatLevel;
          if (cb.checked) {
            if (!this.activeThreatLevels.includes(level)) {
              this.activeThreatLevels.push(level);
            }
          } else {
            this.activeThreatLevels = this.activeThreatLevels.filter(l => l !== level);
          }
          this.saveFilterState();
          this.renderArticleList();
        });
      });
    };

    el.innerHTML = `
      <div class="social-settings-header">Filter Settings</div>

      <div class="social-settings-label" style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Threat Levels</div>
      <div id="fnThreatToggles" style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:12px;"></div>

      <div class="social-settings-label" style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Keywords (comma-separated)</div>
      <input type="text" class="social-settings-input" id="fnKeywordFilter" placeholder="e.g. tariff, recession, AI" value="${escapeHtml(this.keywordFilter)}" style="margin-bottom:8px;" />

      <div class="social-settings-label" style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Highlight Keywords</div>
      <input type="text" class="social-settings-input" id="fnHighlightKw" placeholder="e.g. Tesla, Fed, earnings" value="${escapeHtml(this.highlightKeywords.join(', '))}" style="margin-bottom:12px;" />

      <div class="social-settings-header" style="margin-top:8px;">RSS Sources</div>
      <div class="social-settings-list"></div>
      <div class="social-settings-add">
        <input type="text" class="social-settings-input" id="fnNewName" placeholder="Source name" />
        <input type="text" class="social-settings-input" id="fnNewUrl" placeholder="RSS feed URL" style="flex:2;" />
        <button class="social-settings-add-btn" id="fnAddBtn">Add</button>
      </div>
    `;

    renderThreatToggles();
    renderList();

    // Keyword filter
    el.querySelector('#fnKeywordFilter')?.addEventListener('input', (e) => {
      this.keywordFilter = (e.target as HTMLInputElement).value;
      this.saveFilterState();
      this.renderArticleList();
    });

    // Highlight keywords
    el.querySelector('#fnHighlightKw')?.addEventListener('input', (e) => {
      this.highlightKeywords = (e.target as HTMLInputElement).value.split(',').map(k => k.trim()).filter(Boolean);
      this.saveFilterState();
      this.renderArticleList();
    });

    el.querySelector('#fnAddBtn')?.addEventListener('click', () => {
      const name = (el.querySelector('#fnNewName') as HTMLInputElement).value.trim();
      const url = (el.querySelector('#fnNewUrl') as HTMLInputElement).value.trim();
      if (!name || !url) return;
      const sources = loadSources();
      sources.push({ id: `custom-${Date.now()}`, name, url, enabled: true, type: 'rss' });
      saveSources(sources);
      (el.querySelector('#fnNewName') as HTMLInputElement).value = '';
      (el.querySelector('#fnNewUrl') as HTMLInputElement).value = '';
      renderList();
    });

    return el;
  }

  private renderArticleList(): void {
    if (!this.listEl) return;
    let filtered = this.articles.filter(
      a => !a.category || this.activeCategories.includes(a.category)
    );

    // Filter by threat level
    filtered = filtered.filter(a =>
      this.activeThreatLevels.includes((a.threatLevel as ThreatLevel) || 'info')
    );

    // Filter by keyword
    if (this.keywordFilter.trim()) {
      const keywords = this.keywordFilter.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      if (keywords.length > 0) {
        filtered = filtered.filter(a => {
          const title = a.title.toLowerCase();
          const desc = (a.description || '').toLowerCase();
          return keywords.some(kw => title.includes(kw) || desc.includes(kw));
        });
      }
    }

    // Source filter
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

        // Highlight user-specified keywords in title
        let titleHtml = escapeHtml(a.title);
        for (const kw of this.highlightKeywords) {
          if (!kw) continue;
          const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          titleHtml = titleHtml.replace(regex, '<mark style="background:var(--yellow);color:#111;padding:0 2px;border-radius:2px;">$1</mark>');
        }

        const thumbHtml = hasImage
          ? `<div class="news-thumb"><img src="${a.image}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'news-thumb-fallback\\'>📰</div>'" /></div>`
          : `<div class="news-thumb"><div class="news-thumb-fallback">📰</div></div>`;

        return `
        <div class="news-item-rich">
          <div class="news-item-threat" style="background:${threatColor}"></div>
          ${thumbHtml}
          <div class="news-item-body">
            <div class="news-item-header">
              <a href="${a.url}" target="_blank" rel="noopener" class="news-title">${titleHtml}</a>
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
