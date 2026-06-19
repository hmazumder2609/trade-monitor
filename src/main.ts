import './styles/main.css';
import './styles/happy-theme.css';
import { applyStoredTheme, toggleTheme } from './utils/theme-manager';

// Apply stored theme ASAP (safety net — inline script in index.html does the flash-free path)
applyStoredTheme();

import {
  StockPanel,
  EmailPanel,
  SchedulePanel,
  CodeStatusPanel,
  SocialPanel,
  PortfolioPanel,
  FeishuPanel,
  LiveNewsPanel,
  QuickLinksPanel,
  DevOpsPanel,
  SystemMonitorPanel,
  MapPanel,
  WorldClockPanel,
  InsightsPanel,
  WeatherPanel,
  TradingPanel,
  FinancialNewsPanel,
  OptionsFlowPanel,
  OnChainPanel,
  SocialSentimentPanel,
  MacroCalendarPanel,
  EconomicIndicatorsPanel,
  CentralBankTrackerPanel,
  YieldCurvePanel,
  StrategyJournalPanel,
  TradeReviewPanel,
  PlaybookManagerPanel,
  BacktestLogPanel,
  openSettings,
  registerCommands,
  createTodayFocusSidebar,
  updateTodayFocus,
  scanForBreakingNews,
} from './components';

// Plugin self-registration (importing triggers registry.register)
import { registry } from '@/services/plugin-registry';
import '@/plugins/RedditPulsePlugin/plugin';
import '@/plugins/TruthWatchPlugin/plugin';
import '@/plugins/XWatchPlugin/plugin';
import '@/plugins/HabitTrackerPlugin/plugin';
import '@/plugins/HealthMetricsPlugin/plugin';
import '@/plugins/RoutineSchedulerPlugin/plugin';
import '@/plugins/MentalCheckInPlugin/plugin';
import { Panel } from './components/Panel';
import { RefreshScheduler } from './services/refresh-scheduler';
import { formatDate } from './utils';
import { generateDailyBriefing } from './services/ai-summary';
import { getPreferences, subscribeSettingsChange } from './services/settings-store';
import { migrateStrategyStore } from './services/strategy-store';
import { migrateHabitStore } from './services/habit-store';

// Fire-and-forget IndexedDB migration (silent, non-blocking)
migrateStrategyStore().catch(() => {});
migrateHabitStore().catch(() => {});

// ============================================================
//  Panel instances — organized by tab
// ============================================================

// Dashboard tab
const mapPanel = new MapPanel();
const insightsPanel = new InsightsPanel();
const weatherPanel = new WeatherPanel();
const worldClockPanel = new WorldClockPanel();
const quickLinksPanel = new QuickLinksPanel();
const schedulePanel = new SchedulePanel();
const emailPanel = new EmailPanel();
const socialPanel = new SocialPanel();
// Financial News tab
const financialNewsPanel = new FinancialNewsPanel();
const liveNewsPanel = new LiveNewsPanel();

// Trading tab
const tradingPanel = new TradingPanel();
const stockPanel = new StockPanel();
const portfolioPanel = new PortfolioPanel();
const optionsFlowPanel = new OptionsFlowPanel();
const onChainPanel = new OnChainPanel();

// Social sentiment (News tab)
const socialSentimentPanel = new SocialSentimentPanel();

// Macro tab
const macroCalendarPanel = new MacroCalendarPanel();
const economicIndicatorsPanel = new EconomicIndicatorsPanel();
const centralBankTrackerPanel = new CentralBankTrackerPanel();
const yieldCurvePanel = new YieldCurvePanel();

// Strategy tab
const strategyJournalPanel = new StrategyJournalPanel();
const tradeReviewPanel = new TradeReviewPanel();
const playbookManagerPanel = new PlaybookManagerPanel();
const backtestLogPanel = new BacktestLogPanel();

// DevOps tab
const devOpsPanel = new DevOpsPanel();
const codeStatusPanel = new CodeStatusPanel();
const feishuPanel = new FeishuPanel();
const systemMonitorPanel = new SystemMonitorPanel();

// ============================================================
//  Mount sidebar (persistent across all tabs)
// ============================================================
const sidebarMount = document.getElementById('sidebarMount')!;
sidebarMount.appendChild(createTodayFocusSidebar());

// ============================================================
//  Mount panels into their respective tab grids
// ============================================================
// Panel ID → instance lookup
const PANEL_BY_ID: Record<string, Panel> = {
  map: mapPanel,
  insights: insightsPanel,
  schedule: schedulePanel,
  weather: weatherPanel,
  email: emailPanel,
  social: socialPanel,
  'world-clock': worldClockPanel,
  'quick-links': quickLinksPanel,
  'financial-news': financialNewsPanel,
  'live-news': liveNewsPanel,
  trading: tradingPanel,
  stocks: stockPanel,
  finance: portfolioPanel,
  'options-flow': optionsFlowPanel,
  onchain: onChainPanel,
  'social-sentiment': socialSentimentPanel,
  'macro-calendar': macroCalendarPanel,
  'economic-indicators': economicIndicatorsPanel,
  'central-bank-tracker': centralBankTrackerPanel,
  'yield-curve': yieldCurvePanel,
  'strategy-journal': strategyJournalPanel,
  'trade-review': tradeReviewPanel,
  'playbook-manager': playbookManagerPanel,
  'backtest-log': backtestLogPanel,
  devops: devOpsPanel,
  'code-status': codeStatusPanel,
  feishu: feishuPanel,
  'system-monitor': systemMonitorPanel,
};

// Settings tab name → grid tab ID mapping
const TAB_NAME_TO_ID: Record<string, string> = {
  Dashboard: 'dashboard',
  Macro: 'macro',
  News: 'financial-news',
  Trading: 'trading',
  Strategy: 'strategy',
  Habits: 'habits',
  DevOps: 'devops',
};

// Default layout
const DEFAULT_TAB_PANELS: Record<string, string[]> = {
  dashboard: [
    'map',
    'insights',
    'schedule',
    'weather',
    'email',
    'social',
    'world-clock',
    'quick-links',
  ],
  macro: ['macro-calendar', 'economic-indicators', 'central-bank-tracker', 'yield-curve'],
  'financial-news': ['financial-news', 'live-news', 'social-sentiment'],
  trading: ['trading', 'stocks', 'finance', 'options-flow', 'onchain'],
  strategy: ['strategy-journal', 'trade-review', 'playbook-manager', 'backtest-log'],
  habits: ['habit-tracker', 'health-metrics', 'routine-scheduler', 'mental-checkin'],
  devops: ['devops', 'code-status', 'feishu', 'system-monitor'],
};

// Build effective layout from preferences
function buildTabPanels(): Record<string, Panel[]> {
  const { panelLayout = {} } = getPreferences();
  const result: Record<string, Panel[]> = {};

  // If user has custom layout, apply it
  if (Object.keys(panelLayout).length > 0) {
    const placed = new Set<string>();
    for (const [tabName, panelIds] of Object.entries(panelLayout)) {
      const tabId = TAB_NAME_TO_ID[tabName] || tabName.toLowerCase();
      result[tabId] = panelIds.map(id => PANEL_BY_ID[id]).filter(Boolean);
      for (const id of panelIds) placed.add(id);
    }
    // Place any unplaced panels in their default tab
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

// All panels flat list for cleanup
const allPanels: Panel[] = Object.values(TAB_PANELS).flat();

// Mount each panel set into its grid, then restore saved order
for (const [tabId, panels] of Object.entries(TAB_PANELS)) {
  const grid = document.getElementById(`panelsGrid-${tabId}`);
  if (!grid) continue;
  for (const p of panels) grid.appendChild(p.getElement());
  Panel.restorePanelOrder(grid);
}

// Apply panel visibility from preferences
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

// Re-apply when settings change
subscribeSettingsChange(applyPanelVisibility);

// ============================================================
//  Tab switching — instant DOM show/hide, no network requests
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

// Wire tab buttons
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab!));
});

// Restore last active tab
const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
if (savedTab && document.querySelector(`[data-tab-content="${savedTab}"]`)) {
  switchTab(savedTab);
}

// ============================================================
//  Custom Panel System — import via URL/iframe or user config
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
  // Custom panels go on the dashboard tab
  const panelGrid = document.getElementById('panelsGrid-dashboard');
  if (!panelGrid) return;

  // Remove existing custom panels
  panelGrid.querySelectorAll('[data-panel^="custom-"]').forEach(el => el.remove());

  for (const cfg of configs) {
    panelGrid.appendChild(createCustomPanel(cfg));
  }

  // Wire remove buttons
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

// Mount custom panels (appended to dashboard grid)
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
  { name: 'stocks', fn: () => stockPanel.refresh(), intervalMs: 60_000 },
  { name: 'trading', fn: () => tradingPanel.refresh(), intervalMs: 60_000 },
  {
    name: 'financial-news',
    fn: async () => {
      await financialNewsPanel.refresh();
      try {
        const { fetchNews } = await import('./services/news');
        const articles = await fetchNews();
        scanForBreakingNews(articles);
      } catch {}
    },
    intervalMs: 5 * 60_000,
  },

  { name: 'map-data', fn: () => refreshMapMarkers(), intervalMs: 10 * 60_000 },
  { name: 'email', fn: () => emailPanel.refresh(), intervalMs: 2 * 60_000 },
  { name: 'feishu', fn: () => feishuPanel.refresh(), intervalMs: 60_000 },
  { name: 'system-monitor', fn: () => systemMonitorPanel.refresh(), intervalMs: 60_000 },
  { name: 'social', fn: () => socialPanel.refresh(), intervalMs: 3 * 60_000 },
  { name: 'code-status', fn: () => codeStatusPanel.refresh(), intervalMs: 2 * 60_000 },
  { name: 'schedule', fn: () => schedulePanel.refresh(), intervalMs: 5 * 60_000 },
  { name: 'finance', fn: () => portfolioPanel.refresh(), intervalMs: 10 * 60_000 },
  { name: 'insights', fn: () => insightsPanel.refresh(), intervalMs: 15 * 60_000 },
  { name: 'weather', fn: () => weatherPanel.refresh(), intervalMs: 30 * 60_000 },
  { name: 'macro-calendar', fn: () => macroCalendarPanel.refresh(), intervalMs: 15 * 60_000 },
  {
    name: 'economic-indicators',
    fn: () => economicIndicatorsPanel.refresh(),
    intervalMs: 15 * 60_000,
  },
  {
    name: 'central-bank-tracker',
    fn: () => centralBankTrackerPanel.refresh(),
    intervalMs: 15 * 60_000,
  },
  { name: 'yield-curve', fn: () => yieldCurvePanel.refresh(), intervalMs: 15 * 60_000 },
  { name: 'strategy-journal', fn: () => strategyJournalPanel.refresh(), intervalMs: 60_000 },
  { name: 'trade-review', fn: () => tradeReviewPanel.refresh(), intervalMs: 60_000 },
  { name: 'playbook-manager', fn: () => playbookManagerPanel.refresh(), intervalMs: 60_000 },
  { name: 'backtest-log', fn: () => backtestLogPanel.refresh(), intervalMs: 60_000 },
  { name: 'options-flow', fn: () => optionsFlowPanel.refresh(), intervalMs: 3 * 60_000 },
  { name: 'onchain', fn: () => onChainPanel.refresh(), intervalMs: 5 * 60_000 },
  { name: 'social-sentiment', fn: () => socialSentimentPanel.refresh(), intervalMs: 5 * 60_000 },
]);

// ============================================================
//  Settings + Command Palette (with cross-tab navigation)
// ============================================================
document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
  const next = toggleTheme();
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '◐' : '◑';
});
// Set initial icon
{
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = document.documentElement.dataset.theme === 'dark' ? '◐' : '◑';
}

// Panel-to-tab mapping for cross-tab navigation (built dynamically from layout)
const PANEL_TAB_MAP: Record<string, string> = {};
for (const [tabId, panels] of Object.entries(TAB_PANELS)) {
  for (const p of panels) {
    const el = p.getElement();
    const panelId = el.dataset.panel;
    if (panelId) PANEL_TAB_MAP[panelId] = tabId;
  }
}

function scrollToPanel(id: string, glow = false): void {
  // Switch to the correct tab first
  const tabId = PANEL_TAB_MAP[id];
  if (tabId) switchTab(tabId);
  // Double rAF ensures the tab switch layout is fully painted before we scroll + glow
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const panel = document.querySelector(`[data-panel="${id}"]`) as HTMLElement | null;
      if (!panel) return;
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (glow) {
        panel.classList.remove('panel-glow'); // reset if already glowing
        void panel.offsetWidth; // force reflow
        panel.classList.add('panel-glow');
        setTimeout(() => panel.classList.remove('panel-glow'), 2500);
      }
    })
  );
}

// Listen for navigate events from sidebar / breaking news banner
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
  // Tab navigation
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
    label: 'Habits',
    description: 'Switch to Habits tab',
    action: () => switchTab('habits'),
    keywords: ['routine', 'health', 'checkin', 'wellness'],
  },
  {
    label: 'DevOps',
    description: 'Switch to DevOps tab',
    action: () => switchTab('devops'),
    keywords: ['ci', 'cd', 'pipeline', 'github'],
  },
  // Panel navigation (auto-switches tab)
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
    label: 'Macro Calendar',
    description: 'Jump to economic calendar',
    action: () => scrollToPanel('macro-calendar'),
    keywords: ['economic', 'calendar', 'event', 'cpi', 'nfp'],
  },
  {
    label: 'Economic Indicators',
    description: 'Jump to indicators panel',
    action: () => scrollToPanel('economic-indicators'),
    keywords: ['gdp', 'cpi', 'unemployment', 'inflation'],
  },
  {
    label: 'Central Bank Tracker',
    description: 'Jump to central bank rates',
    action: () => scrollToPanel('central-bank-tracker'),
    keywords: ['fed', 'rates', 'fomc', 'central bank'],
  },
  {
    label: 'Yield Curve',
    description: 'Jump to yield curve panel',
    action: () => scrollToPanel('yield-curve'),
    keywords: ['treasury', 'yields', '2s10s', 'inversion'],
  },
  {
    label: 'Strategy Journal',
    description: 'Jump to strategy journal',
    action: () => scrollToPanel('strategy-journal'),
    keywords: ['journal', 'notes', 'trading plan'],
  },
  {
    label: 'Trade Review',
    description: 'Jump to trade review panel',
    action: () => scrollToPanel('trade-review'),
    keywords: ['pnl', 'win', 'loss', 'trades'],
  },
  {
    label: 'Playbook Manager',
    description: 'Jump to playbook manager',
    action: () => scrollToPanel('playbook-manager'),
    keywords: ['setup', 'pattern', 'strategy'],
  },
  {
    label: 'Backtest Log',
    description: 'Jump to backtest log',
    action: () => scrollToPanel('backtest-log'),
    keywords: ['backtest', 'backtesting', 'results', 'equity'],
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
      insightsPanel.sendMessage(
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
      insightsPanel.sendMessage(
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
      insightsPanel.sendMessage(
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
        'stocks',
        'trading',
        'financial-news',
        'email',
        'feishu',
        'system-monitor',
        'social',
        'code-status',
        'schedule',
        'finance',
        'insights',
        'weather',
        'macro-calendar',
        'economic-indicators',
        'central-bank-tracker',
        'yield-curve',
        'strategy-journal',
        'trade-review',
        'playbook-manager',
        'backtest-log',
        'options-flow',
        'onchain',
        'social-sentiment',
      ]) {
        scheduler.trigger(name);
      }
    },
    keywords: ['reload', 'update'],
  },
  // Plugin-registered commands
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
      { fetchStockQuotes },
      { fetchWorkflowRuns },
      { fetchNews },
    ] = await Promise.all([
      import('./services/schedule'),
      import('./services/email'),
      import('./services/feishu'),
      import('./services/stock-market'),
      import('./services/code-status'),
      import('./services/news'),
    ]);

    const [events, emails, feishuMsgs, stocks, runs, news] = await Promise.all([
      fetchCalendarEvents(),
      fetchEmails(),
      fetchFeishuMessages(),
      fetchStockQuotes(),
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
//  Map markers from real data
// ============================================================
const SOURCE_COORDS: Record<string, [number, number]> = {
  'BBC World': [-0.12, 51.51],
  BBC: [-0.12, 51.51],
  Reuters: [-73.98, 40.75],
  'Reuters World': [-73.98, 40.75],
  'Reuters Business': [-73.98, 40.75],
  'AP News': [-73.98, 40.75],
  'Al Jazeera': [51.53, 25.29],
  CNBC: [-74.0, 40.71],
  Bloomberg: [-73.99, 40.72],
  CNN: [-84.39, 33.75],
  'Financial Times': [-0.1, 51.52],
  'France 24': [2.35, 48.86],
  'DW News': [13.38, 52.52],
  'Hacker News': [-122.42, 37.77],
  TechCrunch: [-122.42, 37.77],
  'The Verge': [-73.99, 40.73],
  'Ars Technica': [-73.99, 40.73],
  'VentureBeat AI': [-122.42, 37.77],
  'Yahoo Finance': [-122.42, 37.77],
  EuroNews: [4.85, 45.76],
  'Guardian World': [-0.12, 51.51],
  SCMP: [114.17, 22.28],
  Caixin: [121.47, 31.23],
  'Nature News': [-0.13, 51.53],
  'NPR News': [-77.01, 38.9],
  Politico: [-77.04, 38.91],
};

async function geolocateUrl(url: string): Promise<[number, number] | null> {
  try {
    const hostname = new URL(url).hostname;
    const resp = await fetch(`https://ipapi.co/${hostname}/json/`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    if (data.latitude && data.longitude) return [data.longitude, data.latitude];
  } catch {}
  return null;
}

async function refreshMapMarkers(): Promise<void> {
  const markers: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    type: 'news' | 'schedule' | 'alert' | 'activity';
    description?: string;
    url?: string;
    color?: string;
  }> = [];
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          mapPanel.addMarker({
            id: 'my-location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            title: 'You are here',
            type: 'activity',
            color: '#44ff88',
            description: 'Current location',
          });
        },
        () => {},
        { timeout: 3000 }
      );
    }
    try {
      const { fetchCalendarEvents } = await import('./services/schedule');
      const events = await fetchCalendarEvents();
      for (const ev of events) {
        if (!ev.location || ev.location.includes('http') || ev.location.includes('Meeting'))
          continue;
        try {
          const geoResp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ev.location)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'MyDailyMonitor/1.0' } }
          );
          const geoData = (await geoResp.json()) as any[];
          if (geoData[0])
            markers.push({
              id: `event-${ev.id}`,
              lat: parseFloat(geoData[0].lat),
              lng: parseFloat(geoData[0].lon),
              title: ev.title,
              type: 'schedule',
              description: ev.location,
              color: '#44ff88',
            });
        } catch {}
      }
    } catch {}
    try {
      const { fetchNews } = await import('./services/news');
      const articles = await fetchNews();
      const usedSources = new Set<string>();
      for (const a of articles.slice(0, 20)) {
        const coords = SOURCE_COORDS[a.source];
        if (!coords || usedSources.has(a.source)) continue;
        usedSources.add(a.source);
        const isAlert = a.threatLevel === 'critical' || a.threatLevel === 'high';
        markers.push({
          id: `news-${a.source}`,
          lat: coords[1],
          lng: coords[0],
          title: `${a.source}: ${a.title}`,
          type: isAlert ? 'alert' : 'news',
          description: a.source,
          url: a.url,
        });
      }
    } catch {}
    try {
      const probes = JSON.parse(localStorage.getItem('mdm-server-probes') || '[]') as string[];
      if (probes.length > 0) {
        const probeResp = await fetch(
          `/api/system?action=probe&urls=${probes.slice(0, 5).join(',')}`
        );
        const probeData = (await probeResp.json()) as any;
        for (const r of probeData.probes || []) {
          if (!r.url) continue;
          const coords = await geolocateUrl(r.url);
          if (coords)
            markers.push({
              id: `server-${r.url}`,
              lat: coords[1],
              lng: coords[0],
              title: `${new URL(r.url).hostname} — ${r.ok ? 'UP' : 'DOWN'}`,
              type: r.ok ? ('server-up' as any) : ('server-down' as any),
              description: r.ok ? `${r.status} OK · ${r.latencyMs}ms` : r.error || 'Failed',
              url: r.url,
            });
        }
      }
    } catch {}
    mapPanel.setMarkers(markers);
  } catch (err) {
    console.warn('[Map] marker refresh failed:', err);
  }
}

setTimeout(refreshMapMarkers, 5000);

// ============================================================
//  Cleanup
// ============================================================
window.addEventListener('beforeunload', () => {
  scheduler.destroy();
  for (const p of allPanels) p.destroy();
});

console.log(`[MyDailyMonitor] v0.5.0 — ${allPanels.length} panels, 7 tabs, tabbed layout`);
