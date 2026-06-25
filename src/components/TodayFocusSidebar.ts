/**
 * Alerts system — renders as a dropdown from the app bar alerts button.
 * Alerts are dismissable individually or cleared all at once.
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

let dropdownEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
const activeAlerts: FocusAlert[] = [];
const dismissedAlertIds = new Set<string>();

function navigateToPanel(panelId: string): void {
  window.dispatchEvent(
    new CustomEvent('mdm-navigate-panel', {
      detail: { panelId, glow: true },
    })
  );
}

/** Add an alert to the dropdown */
export function addFocusAlert(alert: FocusAlert): void {
  if (dismissedAlertIds.has(alert.id)) return;
  if (activeAlerts.some(a => a.id === alert.id)) return;
  activeAlerts.unshift(alert);
  if (activeAlerts.length > 50) activeAlerts.pop();
  updateBadge();
  if (dropdownEl) renderAlerts();
}

function dismissAlert(id: string): void {
  dismissedAlertIds.add(id);
  const idx = activeAlerts.findIndex(a => a.id === id);
  if (idx >= 0) activeAlerts.splice(idx, 1);
  updateBadge();
  renderAlerts();
}

function clearAllAlerts(): void {
  for (const a of activeAlerts) dismissedAlertIds.add(a.id);
  activeAlerts.length = 0;
  updateBadge();
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

function updateBadge(): void {
  if (!badgeEl) return;
  const count = activeAlerts.length;
  if (count > 0) {
    badgeEl.textContent = count > 99 ? '99+' : `${count}`;
    badgeEl.style.display = 'inline-flex';
  } else {
    badgeEl.style.display = 'none';
  }
}

function renderAlerts(): void {
  if (!dropdownEl) return;

  if (activeAlerts.length === 0) {
    dropdownEl.innerHTML = `
      <div class="alerts-dropdown-header">
        <span class="alerts-dropdown-title">ALERTS</span>
      </div>
      <div class="alerts-empty">No active alerts</div>
    `;
    return;
  }

  dropdownEl.innerHTML = `
    <div class="alerts-dropdown-header">
      <span class="alerts-dropdown-title">ALERTS (${activeAlerts.length})</span>
      <button class="alerts-clear-btn" id="alertsClearAll">Clear All</button>
    </div>
    ${activeAlerts
      .map(
        a => `
      <div class="alert-item ${a.level}" data-alert-id="${a.id}">
        <span class="alert-dot" style="background:${LEVEL_COLORS[a.level] || 'var(--text-dim)'}"></span>
        <div class="alert-body" ${a.panelTarget ? `data-navigate="${a.panelTarget}"` : ''}>
          <span class="alert-text">${a.headline}</span>
          <span class="alert-meta">${a.source} · ${formatTime(a.timestamp)}</span>
        </div>
        <button class="alert-dismiss" data-dismiss="${a.id}" title="Dismiss">&times;</button>
      </div>
    `
      )
      .join('')}
  `;

  // Wire clear all
  dropdownEl.querySelector('#alertsClearAll')?.addEventListener('click', clearAllAlerts);

  // Wire dismiss
  dropdownEl.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      dismissAlert(btn.dataset.dismiss!);
    });
  });

  // Wire navigate
  dropdownEl.querySelectorAll<HTMLElement>('[data-navigate]').forEach(el => {
    el.addEventListener('click', () => navigateToPanel(el.dataset.navigate!));
  });
}

/** Initialize the alerts system — call once on app load */
export function initAlertsSystem(): void {
  const btn = document.getElementById('alertsBtn');
  badgeEl = document.getElementById('alertsBadge');
  if (!btn) return;

  // Create dropdown element
  dropdownEl = document.createElement('div');
  dropdownEl.className = 'alerts-dropdown';
  dropdownEl.style.display = 'none';
  document.body.appendChild(dropdownEl);

  // Toggle dropdown on button click
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dropdownEl!.style.display !== 'none';
    if (isOpen) {
      dropdownEl!.style.display = 'none';
    } else {
      // Position near the button
      const rect = btn.getBoundingClientRect();
      let left = rect.right - 320;
      let top = rect.bottom + 4;
      if (left < 8) left = 8;
      if (left + 320 > window.innerWidth - 8) left = window.innerWidth - 328;
      if (top + 400 > window.innerHeight - 8) top = rect.top - 404;
      if (top < 8) top = 8;
      dropdownEl!.style.left = `${left}px`;
      dropdownEl!.style.top = `${top}px`;
      dropdownEl!.style.display = 'block';
      renderAlerts();
    }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (dropdownEl && dropdownEl.style.display !== 'none') {
      if (!dropdownEl.contains(e.target as Node) && e.target !== btn) {
        dropdownEl.style.display = 'none';
      }
    }
  });

  updateBadge();
  renderAlerts();
}

/** Still called by main.ts — no-op now since we only show alerts */
export function updateTodayFocus(_data: FocusData): void {
  // Alerts are managed via addFocusAlert() — no dynamic content
}
