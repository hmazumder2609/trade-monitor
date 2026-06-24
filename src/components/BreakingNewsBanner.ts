/**
 * BreakingNewsBanner — Modern toast-style alert notifications.
 * Features: bottom-right toasts, waveform visualization, alert history, desktop actions.
 * Alerts are staggered with a global cooldown.
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

export interface AlertHistoryEntry extends BreakingAlert {
  read: boolean;
}

const DISMISS_MS: Record<AlertLevel, number> = {
  critical: 60_000,
  high: 30_000,
  medium: 15_000,
  low: 8_000,
};

const GLOBAL_COOLDOWN_MS = 5_000;
const HISTORY_KEY = 'mdm-alert-history';
const MAX_HISTORY = 100;

const dismissed = new Set<string>();
let lastAlertTime = 0;
const alertQueue: BreakingAlert[] = [];
let drainTimer: ReturnType<typeof setTimeout> | null = null;

let toastContainer: HTMLElement | null = null;
let historyPanel: HTMLElement | null = null;
let historyVisible = false;

// ---- History Management ----

function loadHistory(): AlertHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHistory(history: AlertHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function addToHistory(alert: BreakingAlert): void {
  const history = loadHistory();
  history.unshift({ ...alert, read: false });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  saveHistory(history);
  updateHistoryBadge();
}

function markAllRead(): void {
  const history = loadHistory();
  history.forEach(h => (h.read = true));
  saveHistory(history);
  updateHistoryBadge();
  renderHistoryList();
}

function updateHistoryBadge(): void {
  const badge = document.querySelector('.alert-history-badge') as HTMLElement;
  if (!badge) return;
  const history = loadHistory();
  const unread = history.filter(h => !h.read).length;
  badge.textContent = unread > 0 ? String(unread) : '';
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

// ---- Toast Container ----

function ensureToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'alert-toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(alert: BreakingAlert): void {
  lastAlertTime = Date.now();

  playAlertSound(alert.level);
  addToHistory(alert);

  addFocusAlert({
    id: alert.id,
    headline: alert.headline,
    source: alert.source,
    level: alert.level,
    timestamp: alert.timestamp,
    panelTarget: alert.panelTarget,
  });

  const c = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `alert-toast alert-toast-${alert.level}`;
  if (alert.panelTarget) el.dataset.panelTarget = alert.panelTarget;

  const timeStr = alert.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  el.innerHTML = `
    <div class="alert-toast-header">
      <span class="alert-toast-level">${alert.level.toUpperCase()}</span>
      <span class="alert-toast-time">${timeStr}</span>
      <button class="alert-toast-dismiss" aria-label="Dismiss">&times;</button>
    </div>
    <div class="alert-toast-headline">${alert.headline}</div>
    <div class="alert-toast-footer">
      <span class="alert-toast-source">${alert.source}</span>
      ${alert.url ? `<a href="${alert.url}" target="_blank" class="alert-toast-link">Open</a>` : ''}
    </div>
    <div class="alert-toast-progress">
      <div class="alert-toast-progress-bar" style="animation-duration:${DISMISS_MS[alert.level]}ms"></div>
    </div>
  `;

  if (alert.panelTarget) {
    el.querySelector('.alert-toast-headline')?.addEventListener('click', () => {
      window.dispatchEvent(
        new CustomEvent('mdm-navigate-panel', {
          detail: { panelId: alert.panelTarget, glow: true },
        })
      );
    });
  }

  el.querySelector('.alert-toast-dismiss')?.addEventListener('click', () => {
    el.classList.add('alert-toast-exit');
    setTimeout(() => el.remove(), 300);
  });

  c.appendChild(el);

  // Auto-dismiss with progress bar
  setTimeout(() => {
    if (el.parentNode) {
      el.classList.add('alert-toast-exit');
      setTimeout(() => el.remove(), 300);
    }
  }, DISMISS_MS[alert.level]);

  // Desktop notification with action buttons
  if (Notification.permission === 'granted') {
    const notification = new Notification(`[${alert.level.toUpperCase()}] ${alert.source}`, {
      body: alert.headline,
      icon: '/favicon.ico',
      tag: alert.id,
      requireInteraction: alert.level === 'critical',
    });

    notification.onclick = () => {
      window.focus();
      if (alert.panelTarget) {
        window.dispatchEvent(
          new CustomEvent('mdm-navigate-panel', {
            detail: { panelId: alert.panelTarget, glow: true },
          })
        );
      }
    };
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// ---- Queue Management ----

function drainQueue(): void {
  if (drainTimer) return;

  const processNext = () => {
    drainTimer = null;
    if (alertQueue.length === 0) return;

    const next = alertQueue.shift()!;
    showToast(next);

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

  const PRIORITY: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const pri = PRIORITY[alert.level] ?? 3;
  const insertIdx = alertQueue.findIndex(a => (PRIORITY[a.level] ?? 3) > pri);
  if (insertIdx === -1) alertQueue.push(alert);
  else alertQueue.splice(insertIdx, 0, alert);

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

// ---- History Panel ----

export function toggleHistoryPanel(): void {
  if (historyVisible) {
    historyPanel?.remove();
    historyPanel = null;
    historyVisible = false;
  } else {
    showHistoryPanel();
  }
}

function showHistoryPanel(): void {
  if (historyPanel) return;

  historyPanel = document.createElement('div');
  historyPanel.className = 'alert-history-panel';
  historyPanel.innerHTML = `
    <div class="alert-history-header">
      <span class="alert-history-title">Alert History</span>
      <div class="alert-history-actions">
        <button class="alert-history-mark-read" title="Mark all read">✓</button>
        <button class="alert-history-close">&times;</button>
      </div>
    </div>
    <div class="alert-history-list"></div>
  `;

  document.body.appendChild(historyPanel);
  historyVisible = true;

  historyPanel.querySelector('.alert-history-close')?.addEventListener('click', () => {
    historyPanel?.remove();
    historyPanel = null;
    historyVisible = false;
  });

  historyPanel.querySelector('.alert-history-mark-read')?.addEventListener('click', () => {
    markAllRead();
  });

  renderHistoryList();
}

function renderHistoryList(): void {
  const list = historyPanel?.querySelector('.alert-history-list');
  if (!list) return;

  const history = loadHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="alert-history-empty">No alerts yet</div>';
    return;
  }

  list.innerHTML = history
    .map(h => {
      const time = new Date(h.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `
      <div class="alert-history-item ${h.read ? '' : 'unread'}" data-id="${h.id}">
        <div class="alert-history-item-header">
          <span class="alert-history-item-level alert-history-level-${h.level}">${h.level.toUpperCase()}</span>
          <span class="alert-history-item-time">${time}</span>
        </div>
        <div class="alert-history-item-headline">${h.headline}</div>
        <div class="alert-history-item-source">${h.source}</div>
      </div>
    `;
    })
    .join('');

  list.querySelectorAll('.alert-history-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id;
      const entry = history.find(h => h.id === id);
      if (entry?.panelTarget) {
        window.dispatchEvent(
          new CustomEvent('mdm-navigate-panel', {
            detail: { panelId: entry.panelTarget, glow: true },
          })
        );
      }
    });
  });
}

/** Initialize history badge in header */
export function initAlertHistoryButton(): void {
  // This will be called from main.ts to add the history button to the header
  const btn = document.createElement('button');
  btn.className = 'alert-history-btn';
  btn.innerHTML = `<span class="alert-history-icon">🔔</span><span class="alert-history-badge"></span>`;
  btn.title = 'Alert History';
  btn.addEventListener('click', toggleHistoryPanel);

  const header = document.querySelector('.header-actions') || document.querySelector('.header');
  if (header) {
    header.insertBefore(btn, header.firstChild);
  }

  updateHistoryBadge();
}
