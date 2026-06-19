/**
 * Today's Focus sidebar — persistent left sidebar showing only alerts.
 * Alerts are dismissable individually or cleared all at once.
 * Auto-collapses on narrow viewports.
 */
import type { AlertLevel } from '@/services/alert-sounds';

export interface FocusData {
  nextEvent?: { title: string; startTime: string; minutesUntil: number };
  unreadEmails: number;
  unreadFeishu: number;
  stockAlerts: Array<{ symbol: string; changePercent: number }>;
  ciFailures: number;
  dailyBriefing?: string;
}

export interface FocusAlert {
  id: string;
  headline: string;
  source: string;
  level: AlertLevel;
  timestamp: Date;
  panelTarget?: string;
}

let sidebarEl: HTMLElement | null = null;
const activeAlerts: FocusAlert[] = [];
const dismissedAlertIds = new Set<string>();

function navigateToPanel(panelId: string): void {
  window.dispatchEvent(
    new CustomEvent('mdm-navigate-panel', {
      detail: { panelId, glow: true },
    })
  );
}

/** Add an alert to the sidebar */
export function addFocusAlert(alert: FocusAlert): void {
  if (dismissedAlertIds.has(alert.id)) return;
  if (activeAlerts.some(a => a.id === alert.id)) return;
  activeAlerts.unshift(alert);
  if (activeAlerts.length > 50) activeAlerts.pop();
  renderAlerts();
}

function dismissAlert(id: string): void {
  dismissedAlertIds.add(id);
  const idx = activeAlerts.findIndex(a => a.id === id);
  if (idx >= 0) activeAlerts.splice(idx, 1);
  renderAlerts();
}

function clearAllAlerts(): void {
  for (const a of activeAlerts) dismissedAlertIds.add(a.id);
  activeAlerts.length = 0;
  renderAlerts();
}

const LEVEL_COLORS: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--semantic-high)',
  medium: 'var(--yellow)',
  low: 'var(--blue)',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderAlerts(): void {
  const container = document.getElementById('focusAlerts');
  if (!container) return;

  if (activeAlerts.length === 0) {
    container.innerHTML = `
      <div class="focus-empty-state">
        <div class="focus-empty-icon">✓</div>
        <div class="focus-empty-text">No active alerts</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="focus-alerts-header">
      <span class="focus-section-title">ALERTS (${activeAlerts.length})</span>
      <button class="focus-clear-all" id="focusClearAll" title="Clear all alerts">Clear All</button>
    </div>
    ${activeAlerts
      .map(
        a => `
      <div class="focus-alert-item" data-alert-id="${a.id}">
        <span class="focus-alert-dot" style="background:${LEVEL_COLORS[a.level] || 'var(--text-dim)'}"></span>
        <div class="focus-alert-body" ${a.panelTarget ? `data-navigate="${a.panelTarget}"` : ''}>
          <span class="focus-alert-text">${a.headline}</span>
          <span class="focus-alert-meta">${a.source} · ${formatTime(a.timestamp)}</span>
        </div>
        <button class="focus-alert-dismiss" data-dismiss="${a.id}" title="Dismiss">&times;</button>
      </div>
    `
      )
      .join('')}
  `;

  // Wire clear all
  container.querySelector('#focusClearAll')?.addEventListener('click', clearAllAlerts);

  // Wire dismiss
  container.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      dismissAlert(btn.dataset.dismiss!);
    });
  });

  // Wire navigate
  container.querySelectorAll<HTMLElement>('[data-navigate]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => navigateToPanel(el.dataset.navigate!));
  });
}

export function createTodayFocusSidebar(): HTMLElement {
  sidebarEl = document.createElement('aside');
  sidebarEl.className = 'today-focus-sidebar';
  sidebarEl.id = 'todayFocus';
  sidebarEl.innerHTML = `
    <div class="focus-header">
      <span class="focus-title">ALERTS</span>
      <button class="focus-toggle" id="focusToggle" title="Toggle sidebar">◀</button>
    </div>
    <div class="focus-content" id="focusContent">
      <div class="focus-section" id="focusAlerts">
        <div class="focus-empty-state">
          <div class="focus-empty-icon">✓</div>
          <div class="focus-empty-text">No active alerts</div>
        </div>
      </div>
    </div>
  `;

  sidebarEl.querySelector('#focusToggle')?.addEventListener('click', () => {
    sidebarEl?.classList.toggle('collapsed');
    const btn = sidebarEl?.querySelector('#focusToggle');
    if (btn) btn.textContent = sidebarEl?.classList.contains('collapsed') ? '▶' : '◀';
  });

  // Auto-collapse on narrow viewports
  const mq = window.matchMedia('(max-width: 1100px)');
  const handleResize = (e: MediaQueryList | MediaQueryListEvent) => {
    if (!sidebarEl) return;
    if ('matches' in e && e.matches) {
      sidebarEl.classList.add('collapsed');
      const btn = sidebarEl.querySelector('#focusToggle');
      if (btn) btn.textContent = '▶';
    }
  };
  handleResize(mq);
  mq.addEventListener('change', handleResize);

  return sidebarEl;
}

/** Still called by main.ts — no-op now since we only show alerts */
export function updateTodayFocus(_data: FocusData): void {
  // Alerts are managed via addFocusAlert() — no dynamic content
}
