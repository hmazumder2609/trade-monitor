import { escapeHtml } from './format';

export const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#ff4500',
  twitter: '#1d9bf0',
  x: '#1d9bf0',
  truth: '#1a1a2e',
  hackernews: '#ff6600',
  hn: '#ff6600',
  v2ex: '#444',
  whale: '#6366f1',
  youtube: '#ff0000',
  rss: '#3b82f6',
  bloomberg: '#e87910',
  cnbc: '#e2131b',
  reuters: '#e51937',
  ft: '#ff6600',
  wsj: '#000',
  api: '#3b82f6',
  default: '#6b7280',
};

export function getPlatformColor(platform: string): string {
  const key = platform.toLowerCase().replace(/\s+/g, '');
  return PLATFORM_COLORS[key] || PLATFORM_COLORS.default;
}

export function createSourceBadge(platform: string, label?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'data-source-badge';
  badge.style.backgroundColor = getPlatformColor(platform);
  badge.textContent = label || formatPlatformLabel(platform);
  return badge;
}

function formatPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    reddit: 'Reddit',
    twitter: 'X / Twitter',
    x: 'X',
    truth: 'Truth Social',
    hackernews: 'Hacker News',
    hn: 'Hacker News',
    v2ex: 'V2EX',
    whale: 'Whale Alert',
    youtube: 'YouTube',
    rss: 'RSS',
    bloomberg: 'Bloomberg',
    cnbc: 'CNBC',
    reuters: 'Reuters',
    ft: 'Financial Times',
    wsj: 'Wall Street Journal',
    api: 'API',
  };
  const key = platform.toLowerCase().replace(/\s+/g, '');
  return labels[key] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function formatTimestamp(date: Date, format: 'relative' | 'absolute' = 'relative'): string {
  if (format === 'absolute') {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return formatRelativeTime(date);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function createDataLink(
  url: string,
  text: string,
  className = 'data-title-link'
): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = className;
  link.textContent = text;
  return link;
}

export function createTickerTags(tickers: string[]): HTMLElement {
  const container = document.createElement('span');
  container.className = 'data-tickers';
  container.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
  for (const t of tickers) {
    const tag = document.createElement('span');
    tag.className = 'data-ticker';
    tag.style.cssText =
      'font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--overlay-medium);color:var(--text);';
    tag.textContent = t.startsWith('$') ? t : `$${t}`;
    container.appendChild(tag);
  }
  return container;
}

export function createScoreBadge(score: number): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'data-score';
  badge.style.fontWeight = '600';
  badge.style.fontSize = '10px';
  if (score > 0.1) {
    badge.style.color = 'var(--green)';
    badge.classList.add('data-score--positive');
  } else if (score < -0.1) {
    badge.style.color = 'var(--red)';
    badge.classList.add('data-score--negative');
  } else {
    badge.style.color = 'var(--text-muted)';
    badge.classList.add('data-score--neutral');
  }
  badge.textContent = score.toFixed(2);
  return badge;
}

export function createMetaRow(...elements: (HTMLElement | string)[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'data-meta';
  row.style.cssText =
    'display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-muted);flex-wrap:wrap;margin-top:4px;';
  for (const el of elements) {
    if (typeof el === 'string') {
      const span = document.createElement('span');
      span.textContent = el;
      row.appendChild(span);
    } else {
      row.appendChild(el);
    }
  }
  return row;
}

export interface DataItemOptions {
  title: string;
  url?: string;
  platform: string;
  platformLabel?: string;
  timestamp?: Date;
  timeFormat?: 'relative' | 'absolute';
  description?: string;
  tickers?: string[];
  author?: string;
  score?: number;
  metadata?: Record<string, string | HTMLElement>;
  onClick?: () => void;
}

export function renderDataItem(options: DataItemOptions): HTMLElement {
  const item = document.createElement('div');
  item.className = 'data-item';
  item.style.cssText = 'border-bottom:1px solid var(--border-subtle);padding:8px 4px;';

  const header = document.createElement('div');
  header.className = 'data-header';
  header.style.cssText =
    'display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;flex-wrap:wrap;';

  const sourceBadge = createSourceBadge(options.platform, options.platformLabel);
  header.appendChild(sourceBadge);

  if (options.url) {
    const titleLink = createDataLink(options.url, options.title);
    titleLink.style.cssText = 'flex:1;min-width:0;font-size:12px;line-height:1.4;font-weight:500;';
    header.appendChild(titleLink);
  } else {
    const titleSpan = document.createElement('span');
    titleSpan.style.cssText =
      'flex:1;min-width:0;color:var(--text);font-size:12px;line-height:1.4;font-weight:500;';
    titleSpan.textContent = options.title;
    header.appendChild(titleSpan);
  }

  item.appendChild(header);

  if (options.description) {
    const body = document.createElement('div');
    body.className = 'data-body';
    body.style.cssText =
      'font-size:11px;color:var(--text-dim);line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
    body.textContent = options.description;
    item.appendChild(body);
  }

  const metaElements: (HTMLElement | string)[] = [];

  if (options.author) {
    const author = document.createElement('span');
    author.className = 'data-author';
    author.style.fontSize = '10px';
    author.textContent = options.author;
    metaElements.push(author);
  }

  if (options.tickers && options.tickers.length > 0) {
    metaElements.push(createTickerTags(options.tickers));
  }

  if (options.timestamp) {
    const time = document.createElement('time');
    time.className = 'data-time';
    time.dateTime = options.timestamp.toISOString();
    time.textContent = formatTimestamp(options.timestamp, options.timeFormat);
    metaElements.push(time);
  }

  if (options.score !== undefined) {
    metaElements.push(createScoreBadge(options.score));
  }

  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      if (typeof value === 'string') {
        const span = document.createElement('span');
        span.style.fontSize = '10px';
        span.textContent = value;
        metaElements.push(span);
      } else {
        metaElements.push(value);
      }
    }
  }

  if (metaElements.length > 0) {
    item.appendChild(createMetaRow(...metaElements));
  }

  return item;
}
