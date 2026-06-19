/**
 * BreakingNewsBanner — top-of-screen alert banner for breaking news.
 * Supports 4 severity levels with distinct sound alerts via Web Audio API.
 * Desktop notifications + auto-dismiss.
 *
 * Alerts are staggered with a global cooldown so they don't all fire at once.
 */
import { playAlertSound, type AlertLevel } from '@/services/alert-sounds';
import { addFocusAlert } from './TodayFocusSidebar';

export interface BreakingAlert {
  id: string;
  headline: string;
  source: string;
  level: AlertLevel;
  url?: string;
  timestamp: Date;
  panelTarget?: string;
}

const DISMISS_MS: Record<AlertLevel, number> = {
  critical: 60_000,
  high: 30_000,
  medium: 15_000,
  low: 8_000,
};

const GLOBAL_COOLDOWN_MS = 8_000; // minimum gap between ANY two alerts
const dismissed = new Set<string>();
let lastAlertTime = 0;
const alertQueue: BreakingAlert[] = [];
let drainTimer: ReturnType<typeof setTimeout> | null = null;

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'breaking-news-container';
    document.body.appendChild(container);
  }
  return container;
}

function showAlert(alert: BreakingAlert): void {
  lastAlertTime = Date.now();

  // Play sound
  playAlertSound(alert.level);

  // Push to sidebar
  addFocusAlert({
    id: alert.id,
    headline: alert.headline,
    source: alert.source,
    level: alert.level,
    timestamp: alert.timestamp,
    panelTarget: alert.panelTarget,
  });

  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = `breaking-alert breaking-${alert.level}`;
  if (alert.panelTarget) el.dataset.panelTarget = alert.panelTarget;

  el.innerHTML = `
    <span class="breaking-level">${alert.level.toUpperCase()}</span>
    <span class="breaking-headline">${alert.headline}</span>
    <span class="breaking-source">${alert.source}</span>
    ${alert.url ? `<a href="${alert.url}" target="_blank" class="breaking-link">→</a>` : ''}
    <button class="breaking-dismiss" aria-label="Dismiss">&times;</button>
  `;

  if (alert.panelTarget) {
    const hl = el.querySelector('.breaking-headline') as HTMLElement;
    hl.style.cursor = 'pointer';
    hl.addEventListener('click', () => {
      window.dispatchEvent(
        new CustomEvent('mdm-navigate-panel', {
          detail: { panelId: alert.panelTarget, glow: true },
        })
      );
    });
  }

  el.querySelector('.breaking-dismiss')?.addEventListener('click', () => el.remove());
  c.appendChild(el);

  setTimeout(() => el.remove(), DISMISS_MS[alert.level]);

  // Desktop notification
  if (Notification.permission === 'granted') {
    new Notification(`[${alert.level.toUpperCase()}] ${alert.source}`, {
      body: alert.headline,
      icon: '/favicon.ico',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

/** Drain the queue one alert at a time with stagger delay */
function drainQueue(): void {
  if (drainTimer) return;

  const processNext = () => {
    drainTimer = null;
    if (alertQueue.length === 0) return;

    const next = alertQueue.shift()!;
    showAlert(next);

    if (alertQueue.length > 0) {
      drainTimer = setTimeout(processNext, GLOBAL_COOLDOWN_MS);
    }
  };

  const elapsed = Date.now() - lastAlertTime;
  const wait = Math.max(0, GLOBAL_COOLDOWN_MS - elapsed);
  drainTimer = setTimeout(processNext, wait);
}

export function pushBreakingAlert(alert: BreakingAlert): void {
  if (dismissed.has(alert.id)) return;
  dismissed.add(alert.id);

  // Queue the alert (prioritize by severity)
  const PRIORITY: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const pri = PRIORITY[alert.level] ?? 3;
  const insertIdx = alertQueue.findIndex(a => (PRIORITY[a.level] ?? 3) > pri);
  if (insertIdx === -1) alertQueue.push(alert);
  else alertQueue.splice(insertIdx, 0, alert);

  // Cap queue size
  if (alertQueue.length > 10) alertQueue.length = 10;

  drainQueue();
}

/** Scan news articles for breaking alerts */
export function scanForBreakingNews(
  articles: Array<{ title: string; source: string; url: string; threatLevel?: string }>
): void {
  for (const a of articles) {
    if (a.threatLevel === 'critical' || a.threatLevel === 'high' || a.threatLevel === 'medium') {
      pushBreakingAlert({
        id: a.title.slice(0, 50),
        headline: a.title,
        source: a.source,
        level: a.threatLevel as AlertLevel,
        url: a.url,
        timestamp: new Date(),
        panelTarget: 'financial-news',
      });
    }
  }
}
