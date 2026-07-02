import './styles/main.css';
import './styles/happy-theme.css';
import { applyStoredTheme, toggleTheme } from './utils/theme-manager';

applyStoredTheme();

import {
  openSettings,
  registerCommands,
  initAlertsSystem,
  updateTodayFocus,
  scanForBreakingNews,
} from './components';

import { registry } from '@/services/plugin-registry';
import '@/plugins/RedditPulsePlugin/plugin';
import '@/plugins/TruthWatchPlugin/plugin';
import '@/plugins/XWatchPlugin/plugin';
import '@/plugins/HabitTrackerPlugin/plugin';
import '@/plugins/HealthMetricsPlugin/plugin';
import '@/plugins/RoutineSchedulerPlugin/plugin';
import '@/plugins/MentalCheckInPlugin/plugin';
import '@/plugins/StrategyJournalPlugin/plugin';
import '@/plugins/TradeReviewPlugin/plugin';
import '@/plugins/PlaybookManagerPlugin/plugin';
import '@/plugins/BacktestLogPlugin/plugin';
import '@/plugins/MacroCalendarPlugin/plugin';
import '@/plugins/EconomicIndicatorsPlugin/plugin';
import '@/plugins/CentralBankTrackerPlugin/plugin';
import '@/plugins/YieldCurvePlugin/plugin';
import '@/plugins/MapPlugin/plugin';
import '@/plugins/WorldClockPlugin/plugin';
import '@/plugins/InsightsPlugin/plugin';
import '@/plugins/WeatherPlugin/plugin';
import '@/plugins/QuickLinksPlugin/plugin';
import '@/plugins/SchedulePlugin/plugin';
import '@/plugins/EmailPlugin/plugin';
import '@/plugins/SocialPlugin/plugin';
import '@/plugins/FinancialNewsPlugin/plugin';
import '@/plugins/LiveNewsPlugin/plugin';
import '@/plugins/TradingPlugin/plugin';
import '@/plugins/StockPlugin/plugin';
import '@/plugins/PortfolioPlugin/plugin';
import '@/plugins/OptionsFlowPlugin/plugin';
import '@/plugins/OnChainPlugin/plugin';
import '@/plugins/SocialSentimentPlugin/plugin';
import '@/plugins/DevOpsPlugin/plugin';
import '@/plugins/CodeStatusPlugin/plugin';
import '@/plugins/FeishuPlugin/plugin';
import '@/plugins/SystemMonitorPlugin/plugin';
import '@/plugins/VolatilityIndexPlugin/plugin';
import '@/plugins/SocialMonitorPlugin/plugin';
import { Panel } from './components/Panel';
import { RefreshScheduler } from './services/refresh-scheduler';
import { formatDate } from './utils';
import { generateDailyBriefing } from './services/ai-summary';
import { getPreferences, subscribeSettingsChange, persistToEnv } from './services/settings-store';
import { migrateStrategyStore } from './services/strategy-store';
import { migrateHabitStore } from './services/habit-store';
import { registerRealtimeQuotesSource, initRealtimeQuotes } from '@/services/data-layer';

migrateStrategyStore().catch(() => {});
migrateHabitStore().catch(() => {});

// Register and initialize realtime quotes WebSocket source
registerRealtimeQuotesSource();
initRealtimeQuotes();

// ============================================================
//  Panel instances (all registered via plugin side-effect imports)
// ============================================================

// Panel ID → instance lookup (built from registry)
const PANEL_BY_ID: Record<string, Panel> = {};
for (const p of registry.getAllPanels()) {
  const id = p.getElement().dataset.panel;
  if (id) PANEL_BY_ID[id] = p;
}

// ============================================================
//  Mount panels into their respective tab grids
// ============================================================

const TAB_NAME_TO_ID: Record<string, string> = {
  Dashboard: 'dashboard',
  Macro: 'macro',
  News: 'financial-news',
  Trading: 'trading',
  Strategy: 'strategy',
  Personal: 'personal',
  DevOps: 'devops',
};

const DEFAULT_TAB_PANELS: Record<string, string[]> = {
  dashboard: [
    'vix-gauge',
    'weather',
    'world-clock',
    'quick-links',
    'map',
    'insights',
    'schedule',
    'email',
  ],
  macro: ['macro-calendar', 'economic-indicators', 'central-bank-tracker', 'yield-curve'],
  'financial-news': ['financial-news', 'social-sentiment', 'social-monitor'],
  trading: ['trading', 'stocks', 'finance', 'options-flow', 'onchain', 'volatility-index'],
  strategy: ['strategy-journal', 'trade-review', 'playbook-manager', 'backtest-log'],
  personal: ['habit-tracker', 'health-metrics', 'routine-scheduler', 'mental-checkin'],
  devops: ['devops', 'code-status', 'system-monitor'],
};

function buildTabPanels(): Record<string, Panel[]> {
  const { panelLayout = {} } = getPreferences();
  const result: Record<string, Panel[]> = {};

  if (Object.keys(panelLayout).length > 0) {
    const placed = new Set<string>();
    for (const [tabName, panelIds] of Object.entries(panelLayout)) {
      const tabId = TAB_NAME_TO_ID[tabName] || tabName.toLowerCase();
      result[tabId] = panelIds.map(id => PANEL_BY_ID[id]).filter(Boolean);
      for (const id of panelIds) placed.add(id);
    }
    for (const [tabId, ids] of Object.entries(DEFAULT_TAB_PANELS)) {
      if (!result[tabId]) result[tabId] = [];
      for (const id of ids) {
        if (!placed.has(id) && PANEL_BY_ID[id]) {
          result[tabId].push(PANEL_BY_ID[id]);
        }
      }
    }
  } else {
    for (const [tabId, ids] of Object.entries(DEFAULT_TAB_PANELS)) {
      result[tabId] = ids.map(id => PANEL_BY_ID[id]).filter(Boolean);
    }
  }
  return result;
}

const TAB_PANELS = buildTabPanels();

const allPanels: Panel[] = Object.values(TAB_PANELS).flat();

for (const [tabId, panels] of Object.entries(TAB_PANELS)) {
  const grid = document.getElementById(`panelsGrid-${tabId}`);
  if (!grid) continue;
  for (const p of panels) grid.appendChild(p.getElement());
  Panel.restorePanelOrder(grid);
}

initAlertsSystem();

function applyPanelVisibility(): void {
  const { hiddenPanels = [] } = getPreferences();
  for (const p of allPanels) {
    const el = p.getElement();
    const id = el.dataset.panel;
    if (id && hiddenPanels.includes(id)) {
      p.hide();
    } else {
      p.show();
    }
  }
}
applyPanelVisibility();

subscribeSettingsChange(applyPanelVisibility);

// ============================================================
//  Tab switching
// ============================================================
const ACTIVE_TAB_KEY = 'mdm-active-tab';
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.app-tab');
const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

function switchTab(tabId: string): void {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  tabContents.forEach(content => {
    content.classList.toggle('active', content.dataset.tabContent === tabId);
  });
  localStorage.setItem(ACTIVE_TAB_KEY, tabId);
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab!));
});

const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
if (savedTab && document.querySelector(`[data-tab-content="${savedTab}"]`)) {
  switchTab(savedTab);
}

// ============================================================
//  Keyboard Shortcuts
// ============================================================
const TAB_SHORTCUTS = [
  'dashboard',
  'macro',
  'financial-news',
  'trading',
  'strategy',
  'personal',
  'devops',
];
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= TAB_SHORTCUTS.length) {
      e.preventDefault();
      const tabId = TAB_SHORTCUTS[num - 1];
      const btn = document.querySelector<HTMLButtonElement>(`.app-tab[data-tab="${tabId}"]`);
      if (btn) btn.click();
    }
  }
});

// ============================================================
//  Custom Panel System
// ============================================================
const CUSTOM_PANELS_KEY = 'mdm-custom-panels';

interface CustomPanelConfig {
  id: string;
  title: string;
  url: string;
  type: 'iframe' | 'api';
  width?: 'normal' | 'wide';
}

function loadCustomPanels(): CustomPanelConfig[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_PANELS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCustomPanels(panels: CustomPanelConfig[]): void {
  localStorage.setItem(CUSTOM_PANELS_KEY, JSON.stringify(panels));
}

function createCustomPanel(config: CustomPanelConfig): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `panel ${config.width === 'wide' ? 'panel-wide' : ''}`;
  panel.dataset.panel = config.id;

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-left">
        <span class="panel-title">${config.title}</span>
      </div>
      <button class="custom-panel-remove" data-cpid="${config.id}" title="Remove panel" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">✕</button>
    </div>
    <div class="panel-content" style="padding:0;overflow:hidden;">
      <iframe src="${config.url}" style="width:100%;height:100%;border:none;background:var(--bg);" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
    </div>
  `;

  return panel;
}

function renderCustomPanels(): void {
  const configs = loadCustomPanels();
  const panelGrid = document.getElementById('panelsGrid-dashboard');
  if (!panelGrid) return;

  panelGrid.querySelectorAll('[data-panel^="custom-"]').forEach(el => el.remove());

  for (const cfg of configs) {
    panelGrid.appendChild(createCustomPanel(cfg));
  }

  panelGrid.querySelectorAll<HTMLButtonElement>('.custom-panel-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cpid;
      const updated = loadCustomPanels().filter(p => p.id !== id);
      saveCustomPanels(updated);
      renderCustomPanels();
    });
  });
}

function showAddCustomPanelDialog(): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">Add Custom Panel</span>
      <button class="modal-close">&times;</button>
    </div>
    <div style="padding:16px;">
      <div class="settings-row">
        <label class="settings-label">Panel Title</label>
        <input class="settings-input" id="cpTitle" placeholder="e.g. Grafana Dashboard" />
      </div>
      <div class="settings-row">
        <label class="settings-label">URL (iframe embed)</label>
        <input class="settings-input" id="cpUrl" placeholder="https://grafana.example.com/d/xxx?orgId=1&kiosk" />
        <div class="settings-hint">Any URL that supports iframe embedding. Works with: Grafana, Kibana, Datadog, Notion, Google Sheets, etc.</div>
      </div>
      <div class="settings-row">
        <label class="settings-label">Width</label>
        <select class="settings-input" id="cpWidth" style="padding:6px 8px;">
          <option value="normal">Normal (1 column)</option>
          <option value="wide">Wide (2 columns)</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
        <button class="settings-cancel-btn" id="cpCancel">Cancel</button>
        <button class="settings-save-btn" id="cpSave">Add Panel</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
  modal.querySelector('#cpCancel')!.addEventListener('click', () => overlay.remove());
  modal.querySelector('#cpSave')!.addEventListener('click', () => {
    const title = (modal.querySelector('#cpTitle') as HTMLInputElement).value.trim();
    const url = (modal.querySelector('#cpUrl') as HTMLInputElement).value.trim();
    const width = (modal.querySelector('#cpWidth') as HTMLSelectElement).value as 'normal' | 'wide';
    if (!title || !url) return;

    const configs = loadCustomPanels();
    configs.push({ id: `custom-${Date.now()}`, title, url, type: 'iframe', width });
    saveCustomPanels(configs);
    renderCustomPanels();
    overlay.remove();
  });
}

renderCustomPanels();

// ============================================================
//  Header clock
// ============================================================
function updateClock(): void {
  const clockEl = document.getElementById('headerClock');
  const dateEl = document.getElementById('headerDate');
  const now = new Date();
  if (clockEl) clockEl.textContent = now.toLocaleTimeString();
  if (dateEl) dateEl.textContent = formatDate(now);
}
updateClock();
setInterval(updateClock, 1000);

// ============================================================
//  Refresh scheduler
// ============================================================
const scheduler = new RefreshScheduler();
scheduler.registerAll([
  {
    name: 'financial-news',
    fn: async () => {
      const panel = PANEL_BY_ID['financial-news'];
      if (panel) await panel.refresh();
      try {
        const { fetchNews } = await import('./services/news');
        const articles = await fetchNews();
        scanForBreakingNews(articles);
        // Check keyword alerts
        const { checkKeywordsForAlerts } = await import('./services/alert-triggers');
        checkKeywordsForAlerts(articles);
      } catch {}
    },
    intervalMs: 5 * 60_000,
  },
  {
    name: 'map-data',
    fn: () => (PANEL_BY_ID['map'] as any)?.refreshMarkers?.() || Promise.resolve(),
    intervalMs: 10 * 60_000,
  },
  // Plugin-registered refresh tasks
  ...registry.getRefreshTasks(),
]);

// Listen for per-panel refresh interval changes from settings popover
window.addEventListener('mdm-refresh-interval-changed', ((e: Event) => {
  const { panelId, intervalMs } = (e as CustomEvent<{ panelId: string; intervalMs: number }>)
    .detail;
  scheduler.updateInterval(panelId, intervalMs);
}) as EventListener);

// Start alert monitoring (sentiment, keyword, price, signal triggers)
import('./services/alert-triggers').then(m => m.startAllAlertMonitoring());

// ============================================================
//  Settings + Command Palette
// ============================================================
document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
  const next = toggleTheme();
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '◐' : '◑';
});
{
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = document.documentElement.dataset.theme === 'dark' ? '◐' : '◑';
}

const PANEL_TAB_MAP: Record<string, string> = {};
for (const [tabId, panels] of Object.entries(TAB_PANELS)) {
  for (const p of panels) {
    const el = p.getElement();
    const panelId = el.dataset.panel;
    if (panelId) PANEL_TAB_MAP[panelId] = tabId;
  }
}

function scrollToPanel(id: string, glow = false): void {
  const tabId = PANEL_TAB_MAP[id];
  if (tabId) switchTab(tabId);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const panel = document.querySelector(`[data-panel="${id}"]`) as HTMLElement | null;
      if (!panel) return;
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (glow) {
        panel.classList.remove('panel-glow');
        void panel.offsetWidth;
        panel.classList.add('panel-glow');
        setTimeout(() => panel.classList.remove('panel-glow'), 2500);
      }
    })
  );
}

window.addEventListener('mdm-navigate-panel', ((e: CustomEvent) => {
  const { panelId, glow } = e.detail || {};
  if (panelId) scrollToPanel(panelId, glow);
}) as EventListener);

registerCommands([
  {
    label: 'Settings',
    description: 'Open settings modal',
    action: openSettings,
    keywords: ['config', 'api', 'key'],
  },
  {
    label: 'Add Custom Panel',
    description: 'Import an external panel via URL',
    action: showAddCustomPanelDialog,
    keywords: ['custom', 'import', 'iframe', 'grafana'],
  },
  {
    label: 'Dashboard',
    description: 'Switch to Dashboard tab',
    action: () => switchTab('dashboard'),
    keywords: ['home', 'main', 'overview'],
  },
  {
    label: 'Macro',
    description: 'Switch to Macro tab',
    action: () => switchTab('macro'),
    keywords: ['economic', 'cpi', 'gdp', 'fed', 'yield'],
  },
  {
    label: 'News',
    description: 'Switch to News tab',
    action: () => switchTab('financial-news'),
    keywords: ['kobeissi', 'finance', 'rss', 'news'],
  },
  {
    label: 'Trading',
    description: 'Switch to Trading tab',
    action: () => switchTab('trading'),
    keywords: ['trade', 'chart', 'order', 'buy', 'sell'],
  },
  {
    label: 'Strategy',
    description: 'Switch to Strategy tab',
    action: () => switchTab('strategy'),
    keywords: ['journal', 'playbook', 'review', 'backtest'],
  },
  {
    label: 'Personal',
    description: 'Switch to Personal tab',
    action: () => switchTab('personal'),
    keywords: ['routine', 'health', 'checkin', 'wellness', 'weather', 'clock'],
  },
  {
    label: 'DevOps',
    description: 'Switch to DevOps tab',
    action: () => switchTab('devops'),
    keywords: ['ci', 'cd', 'pipeline', 'github'],
  },
  {
    label: 'AI Summary',
    description: 'Jump to AI Summary panel',
    action: () => scrollToPanel('insights'),
    keywords: ['summary', 'briefing', 'agent'],
  },
  {
    label: 'Stock Market',
    description: 'Jump to markets panel',
    action: () => scrollToPanel('stocks'),
    keywords: ['market', 'crypto', 'commodity'],
  },
  {
    label: 'Financial News',
    description: 'Jump to financial news panel',
    action: () => scrollToPanel('financial-news'),
    keywords: ['headlines', 'rss', 'kobeissi'],
  },
  {
    label: 'Email',
    description: 'Jump to email panel',
    action: () => scrollToPanel('email'),
    keywords: ['gmail', 'inbox'],
  },
  {
    label: 'Schedule',
    description: 'Jump to schedule panel',
    action: () => scrollToPanel('schedule'),
    keywords: ['calendar', 'events'],
  },
  {
    label: 'Feishu',
    description: 'Jump to Feishu panel',
    action: () => scrollToPanel('feishu'),
    keywords: ['lark', 'chat'],
  },
  {
    label: 'Code Status',
    description: 'Jump to CI/CD panel',
    action: () => scrollToPanel('code-status'),
    keywords: ['github', 'ci'],
  },
  {
    label: 'System Monitor',
    description: 'Jump to system monitor panel',
    action: () => scrollToPanel('system-monitor'),
    keywords: ['system', 'health', 'cpu', 'memory', 'uptime', 'probe'],
  },
  {
    label: 'Social',
    description: 'Jump to community feed',
    action: () => scrollToPanel('social'),
    keywords: ['hn', 'reddit'],
  },
  {
    label: 'Finance',
    description: 'Jump to daily finance',
    action: () => scrollToPanel('finance'),
    keywords: ['expenses'],
  },
  {
    label: 'Map',
    description: 'Jump to global map',
    action: () => scrollToPanel('map'),
    keywords: ['globe', 'world'],
  },
  {
    label: 'Weather',
    description: 'Jump to weather panel',
    action: () => scrollToPanel('weather'),
    keywords: ['forecast', 'temperature'],
  },
  {
    label: 'Options Flow',
    description: 'Jump to unusual options activity',
    action: () => scrollToPanel('options-flow'),
    keywords: ['options', 'calls', 'puts', 'unusual', 'flow'],
  },
  {
    label: 'On-Chain',
    description: 'Jump to whale transactions',
    action: () => scrollToPanel('onchain'),
    keywords: ['whale', 'crypto', 'bitcoin', 'ethereum', 'transaction'],
  },
  {
    label: 'Social Sentiment',
    description: 'Jump to social sentiment panel',
    action: () => scrollToPanel('social-sentiment'),
    keywords: ['reddit', 'twitter', 'sentiment', 'mentions', 'trending'],
  },
  {
    label: 'Weekly Review',
    description: 'Generate a weekly trading review with AI',
    action: () => {
      switchTab('dashboard');
      (PANEL_BY_ID['insights'] as any)?.sendMessage(
        '/task Generate a weekly review covering stock performance, macro events, news highlights, and any patterns in my trading'
      );
    },
    keywords: ['weekly', 'review', 'summary', 'recap', 'week'],
  },
  {
    label: 'Macro Regime',
    description:
      'Analyze current macro regime — economic indicators, yield curve, central bank policy',
    action: () => {
      scheduler.trigger('macro-calendar');
      scheduler.trigger('economic-indicators');
      scheduler.trigger('central-bank-tracker');
      scheduler.trigger('yield-curve');
      switchTab('dashboard');
      (PANEL_BY_ID['insights'] as any)?.sendMessage(
        'Analyze the current macro regime — summarize all economic indicators, yield curve status, and central bank policy stance'
      );
    },
    keywords: ['macro', 'regime', 'economic', 'yield', 'fed', 'cpi'],
  },
  {
    label: 'Options Flow Scan',
    description: 'Scan for unusual options activity and block trades',
    action: () => {
      scheduler.trigger('options-flow');
      switchTab('dashboard');
      (PANEL_BY_ID['insights'] as any)?.sendMessage(
        'Analyze unusual options activity — put/call ratio, block trades, and any unusual volume spikes'
      );
    },
    keywords: ['options', 'flow', 'scan', 'unusual', 'calls', 'puts'],
  },
  {
    label: 'Trading Chart',
    description: 'Jump to trading panel',
    action: () => scrollToPanel('trading'),
    keywords: ['candlestick', 'chart', 'trade'],
  },
  {
    label: 'Refresh All',
    description: 'Trigger all panel refreshes',
    action: () => {
      for (const name of [
        'map-data',
        'financial-news',
        ...registry.getRefreshTasks().map(t => t.name),
      ]) {
        scheduler.trigger(name);
      }
    },
    keywords: ['reload', 'update'],
  },
  ...registry.getCommandEntries(),
]);

// ============================================================
//  Today's Focus sidebar
// ============================================================
async function refreshFocusSidebar(): Promise<void> {
  try {
    const [
      { fetchCalendarEvents },
      { fetchEmails },
      { fetchFeishuMessages },
      { fetchQuotes },
      { fetchWorkflowRuns },
      { fetchNews },
    ] = await Promise.all([
      import('./services/schedule'),
      import('./services/email'),
      import('./services/feishu'),
      import('./services/data-layer'),
      import('./services/code-status'),
      import('./services/news'),
      import('./services/alert-triggers'),
    ]);

    const [events, emails, feishuMsgs, stocks, runs, news] = await Promise.all([
      fetchCalendarEvents(),
      fetchEmails(),
      fetchFeishuMessages(),
      fetchQuotes(),
      fetchWorkflowRuns(),
      fetchNews(),
    ]);

    const now = new Date();
    const upcoming = events
      .map(e => ({
        ...e,
        minutesUntil: Math.round((new Date(e.startTime).getTime() - now.getTime()) / 60_000),
      }))
      .filter(e => e.minutesUntil > -15)
      .sort((a, b) => a.minutesUntil - b.minutesUntil);

    let dailyBriefing: string | undefined;
    try {
      const b = await generateDailyBriefing({
        emails: emails.filter(e => e.unread).map(e => ({ from: e.from, subject: e.subject })),
        events: events.map(e => ({ title: e.title, startTime: e.startTime })),
        news: news.slice(0, 10).map(n => ({ title: n.title, source: n.source })),
        stocks: stocks.map(s => ({ symbol: s.symbol, changePercent: s.changePercent })),
      });
      if (b) dailyBriefing = b;
    } catch {}

    updateTodayFocus({
      nextEvent: upcoming[0]
        ? {
            title: upcoming[0].title,
            startTime: upcoming[0].startTime,
            minutesUntil: upcoming[0].minutesUntil,
          }
        : undefined,
      unreadEmails: emails.filter(e => e.unread).length,
      unreadFeishu: feishuMsgs.filter(m => m.unread).length,
      stockAlerts: stocks
        .filter(s => s.changePercent != null && Math.abs(s.changePercent!) > 2)
        .map(s => ({ symbol: s.symbol, changePercent: s.changePercent! })),
      ciFailures: runs.filter(r => r.conclusion === 'failure').length,
      dailyBriefing,
    });
  } catch (err) {
    console.warn('[Focus] Sidebar update failed:', err);
  }
}

refreshFocusSidebar();
setInterval(refreshFocusSidebar, 60_000);

// ============================================================
//  Cleanup
// ============================================================
window.addEventListener('beforeunload', () => {
  persistToEnv();
  scheduler.destroy();
  for (const p of allPanels) p.destroy();
});

console.log(`[MyDailyMonitor] v0.5.0 — ${allPanels.length} panels, 7 tabs, tabbed layout`);
