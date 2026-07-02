/**
 * SettingsModal — 4-tab modal for configuring the dashboard.
 *
 * Tabs: General | Alerts & Sound | Data Sources | API Keys
 * All tabs rendered simultaneously (hidden via CSS) so switching tabs
 * doesn't destroy inputs. Save always captures all values.
 */
import { SECRET_REGISTRY, SECRET_GROUPS, type SecretKey } from '@/config/settings-keys';
import {
  getSecret,
  setSecret,
  maskSecret,
  getAllSecrets,
  setAllSecrets,
  getPreferences,
  setPreferences,
  waitForSync,
  persistToEnv,
} from '@/services/settings-store';
import { getWatchlist, getWatchlistSymbols, setWatchlist } from '@/services/data-layer';
import {
  getAlertSoundPrefs,
  setAlertSoundPrefs,
  isGlobalMute,
  setGlobalMute,
  getToneNames,
  playTestTone,
  ALERT_LEVELS,
  type AlertSoundPrefs,
  type AlertLevel,
} from '@/services/alert-sounds';
import {
  isSnapTradeConfigured,
  getSnapTradeUser,
  registerUser,
  getConnectionUrl,
  listAccounts,
  getBalances,
  getBrokerCapabilities,
  clearSnapTradeUser,
  resetSnapTradeUser,
  type SnapTradeAccount,
  type BrokerCapabilities,
} from '@/services/snaptrade';
import { tradingExecutor, positionManager } from '@/agents/trading';
import { escapeHtml } from '@/utils';
import {
  getCurrentTheme,
  getCurrentVariant,
  setTheme,
  setVariant,
  type Theme,
  type ThemeVariant,
} from '@/utils/theme-manager';
import { pushBreakingAlert } from './BreakingNewsBanner';
import { exportAllSettings, importSettings } from '@/services/settings-registry';

let overlayEl: HTMLElement | null = null;

export function openSettings(): void {
  if (overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay active';
  overlayEl.id = 'settingsModal';
  overlayEl.addEventListener('click', e => {
    if (e.target === overlayEl) closeSettings();
  });

  const modal = document.createElement('div');
  modal.className = 'modal settings-modal';

  modal.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">Settings</span>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <div class="settings-body">
      <div class="settings-tabs" id="settingsTabs"></div>
      <div class="settings-content">
        <div id="settingsGeneral"></div>
        <div id="settingsAlerts" style="display:none"></div>
        <div id="settingsDataSources" style="display:none"></div>
        <div id="settingsAccounts" style="display:none"></div>
        <div id="settingsApiKeys" style="display:none"></div>
        <div id="settingsImportExport" style="display:none"></div>
      </div>
    </div>
    <div class="settings-footer">
      <button class="settings-save-btn" id="settingsSaveBtn">Save</button>
      <button class="settings-cancel-btn" id="settingsCancelBtn">Cancel</button>
    </div>
  `;

  overlayEl.appendChild(modal);
  document.body.appendChild(overlayEl);

  const tabContainer = modal.querySelector('#settingsTabs')!;
  const generalPane = modal.querySelector('#settingsGeneral') as HTMLElement;
  const alertsPane = modal.querySelector('#settingsAlerts') as HTMLElement;
  const dataSourcesPane = modal.querySelector('#settingsDataSources') as HTMLElement;
  const accountsPane = modal.querySelector('#settingsAccounts') as HTMLElement;
  const apiKeysPane = modal.querySelector('#settingsApiKeys') as HTMLElement;

  // Render ALL tabs at once (never destroyed)
  renderGeneralTab(generalPane);
  wirePanelDragDrop(generalPane);
  renderAlertsTab(alertsPane);
  renderDataSourcesTab(dataSourcesPane);
  renderAccountsTab(accountsPane);
  renderApiKeysTab(apiKeysPane);
  const importExportPane = modal.querySelector('#settingsImportExport') as HTMLElement;
  renderImportExportTab(importExportPane);

  // Tab switching (show/hide, no re-render)
  const panes = [
    generalPane,
    alertsPane,
    dataSourcesPane,
    accountsPane,
    apiKeysPane,
    importExportPane,
  ];
  const tabDefs = [
    { label: 'General', icon: '⚙' },
    { label: 'Alerts & Sound', icon: '🔔' },
    { label: 'Data Sources', icon: '📡' },
    { label: 'Accounts', icon: '🏦' },
    { label: 'API Keys', icon: '🔑' },
    { label: 'Import/Export', icon: '💾' },
  ];

  tabDefs.forEach((def, i) => {
    const btn = document.createElement('button');
    btn.className = `settings-tab-btn ${i === 0 ? 'active' : ''}`;
    btn.innerHTML = `<span class="settings-tab-icon">${def.icon}</span><span class="settings-tab-label">${def.label}</span>`;
    btn.addEventListener('click', () => {
      tabContainer.querySelectorAll('.settings-tab-btn').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      panes.forEach((p, j) => {
        p.style.display = j === i ? '' : 'none';
      });
    });
    tabContainer.appendChild(btn);
  });

  // Live preview: apply theme changes immediately
  const variantSelect = modal.querySelector('#prefVariant') as HTMLSelectElement | null;
  const themeSelect = modal.querySelector('#prefTheme') as HTMLSelectElement | null;
  variantSelect?.addEventListener('change', () => {
    setVariant(variantSelect.value as ThemeVariant);
    if (variantSelect.value === 'happy' && themeSelect) {
      themeSelect.value = 'light';
      setTheme('light');
    } else if (variantSelect.value === 'default' && themeSelect) {
      themeSelect.value = 'dark';
      setTheme('dark');
    }
  });
  themeSelect?.addEventListener('change', () => {
    setTheme(themeSelect.value as Theme);
  });

  // Events
  modal.querySelector('.modal-close')!.addEventListener('click', closeSettings);
  modal.querySelector('#settingsCancelBtn')!.addEventListener('click', closeSettings);
  modal.querySelector('#settingsSaveBtn')!.addEventListener('click', async () => {
    saveSecrets(apiKeysPane);
    savePrefs(generalPane, dataSourcesPane);
    saveAlertPrefs(alertsPane);
    await persistToEnv();
    closeSettings();
  });
}

export function closeSettings(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

// ========================================
// Tab 1: General — Appearance + Panel Visibility
// ========================================
function renderGeneralTab(container: HTMLElement): void {
  const p = getPreferences();
  const currentTheme = getCurrentTheme();
  const currentVariant = getCurrentVariant();
  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-group-title">Appearance</div>
      <div class="settings-row">
        <label class="settings-label">Color Scheme</label>
        <select class="settings-input" id="prefVariant" style="padding:6px 8px;">
          <option value="default" ${currentVariant === 'default' ? 'selected' : ''}>Default (Dark Ops)</option>
          <option value="happy" ${currentVariant === 'happy' ? 'selected' : ''}>Happy (Calm & Serene)</option>
        </select>
        <div class="settings-hint">Happy theme uses sage green + warm gold tones with rounded panels.</div>
      </div>
      <div class="settings-row">
        <label class="settings-label">Theme Mode</label>
        <select class="settings-input" id="prefTheme" style="padding:6px 8px;">
          <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
        </select>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group-title">Panel Layout</div>
      <div class="settings-hint" style="margin-bottom:10px">Drag panels between tabs to reorganize. Toggle visibility with the switch.</div>
      <div id="panelLayoutEditor">${renderPanelLayoutSection(p.hiddenPanels || [], p.panelLayout || {})}</div>
    </div>
  `;
}

// ========================================
// Tab 2: Alerts & Sound
// ========================================
function renderAlertsTab(container: HTMLElement): void {
  const soundPrefs = getAlertSoundPrefs();
  const muted = isGlobalMute();
  const tones = getToneNames();

  let html = `
    <div class="settings-group">
      <div class="settings-group-title">Alert Sounds</div>
      <div class="settings-row">
        <label class="settings-label">Mute All Sounds</label>
        <label class="settings-toggle">
          <input type="checkbox" id="alertMuteAll" ${muted ? 'checked' : ''} />
          <span class="settings-toggle-slider"></span>
        </label>
      </div>
    </div>
    <div class="settings-group" id="alertLevelSettings">
      <div class="settings-group-title">Sound per Alert Level</div>
      <div class="settings-hint" style="margin-bottom:8px">Configure distinct sounds for each severity level. Click the play button to test.</div>
  `;

  for (const level of ALERT_LEVELS) {
    const cfg = soundPrefs[level.id];
    html += `
      <div class="alert-level-row" data-level="${level.id}">
        <div class="alert-level-header">
          <span class="alert-level-dot" style="background:${level.color}"></span>
          <span class="alert-level-name">${level.label}</span>
          <label class="settings-toggle settings-toggle-sm">
            <input type="checkbox" class="alert-level-enabled" ${cfg.enabled ? 'checked' : ''} />
            <span class="settings-toggle-slider"></span>
          </label>
        </div>
        <div class="alert-level-controls">
          <div class="alert-level-field">
            <label class="settings-label">Tone</label>
            <select class="settings-input alert-level-tone">
              ${tones.map(t => `<option value="${t.id}" ${t.id === cfg.tone ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="alert-level-field">
            <label class="settings-label">Volume</label>
            <div class="alert-volume-wrap">
              <input type="range" class="alert-level-volume" min="0" max="100" value="${cfg.volume}" />
              <span class="alert-volume-val">${cfg.volume}</span>
            </div>
          </div>
          <button class="trading-btn trading-btn-outline alert-test-btn" title="Test">▶</button>
        </div>
      </div>
    `;
  }

  html += `</div>
    <div class="settings-group">
      <div class="settings-group-title">Test In-App Alert</div>
      <div class="settings-hint" style="margin-bottom:8px">Fire a test alert banner to preview how it looks and sounds.</div>
      <div class="alert-test-row">
        <select class="settings-input" id="alertTestLevel" style="flex:1;padding:6px 8px;">
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium" selected>Medium</option>
          <option value="low">Low / Info</option>
        </select>
        <button class="trading-btn" id="alertTestFire" style="background:var(--green);color:var(--bg);font-weight:700;">Fire Test Alert</button>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">Alert Triggers</div>
      <div class="settings-hint" style="margin-bottom:8px">Automatically fire alerts when conditions are met. Monitors sentiment, keywords, and cross-panel signals.</div>
      <div id="alertTriggersList"></div>
      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
        <div class="settings-hint" style="margin-bottom:8px;font-weight:600;">Add New Trigger</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <select class="settings-input" id="triggerType" style="flex:1;min-width:100px;">
            <option value="sentiment">Sentiment</option>
            <option value="keyword">Keyword</option>
            <option value="signal">Signal</option>
          </select>
          <input type="text" class="settings-input" id="triggerTarget" placeholder="Symbol or keyword" style="flex:1;min-width:120px;" />
          <select class="settings-input" id="triggerCondition" style="flex:1;min-width:100px;">
            <option value="drops_below">Drops below</option>
            <option value="rises_above">Rises above</option>
          </select>
          <input type="number" class="settings-input" id="triggerThreshold" placeholder="Threshold" step="0.1" style="flex:0.6;min-width:70px;" />
          <select class="settings-input" id="triggerLevel" style="flex:0.8;min-width:80px;">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium" selected>Medium</option>
            <option value="low">Low</option>
          </select>
          <button class="trading-btn" id="triggerAddBtn" style="background:var(--blue);color:#fff;font-weight:700;">Add</button>
        </div>
      </div>
    </div>`;

  container.innerHTML = html;

  // Wire test alert
  container.querySelector('#alertTestFire')?.addEventListener('click', () => {
    const level = (container.querySelector('#alertTestLevel') as HTMLSelectElement).value as
      | 'critical'
      | 'high'
      | 'medium'
      | 'low';
    pushBreakingAlert({
      id: 'test-' + Date.now(),
      headline: 'This is a test alert — ' + level.toUpperCase() + ' severity',
      source: 'Settings',
      level,
      timestamp: new Date(),
    });
  });

  // Wire volume labels
  container.querySelectorAll<HTMLInputElement>('.alert-level-volume').forEach(slider => {
    const valLabel = slider.parentElement?.querySelector('.alert-volume-val');
    slider.addEventListener('input', () => {
      if (valLabel) valLabel.textContent = slider.value;
    });
  });

  // Wire test buttons
  container.querySelectorAll<HTMLElement>('.alert-level-row').forEach(row => {
    const testBtn = row.querySelector('.alert-test-btn');
    const toneSelect = row.querySelector('.alert-level-tone') as HTMLSelectElement;
    const volSlider = row.querySelector('.alert-level-volume') as HTMLInputElement;
    testBtn?.addEventListener('click', () => {
      playTestTone(toneSelect.value, parseInt(volSlider.value));
    });
  });

  // Trigger management
  const renderTriggers = async () => {
    const { getTriggers, removeTrigger } = await import('@/services/alert-triggers');
    const triggers = getTriggers();
    const listEl = container.querySelector('#alertTriggersList');
    if (!listEl) return;

    if (triggers.length === 0) {
      listEl.innerHTML =
        '<div style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px;">No triggers configured</div>';
      return;
    }

    const typeIcons: Record<string, string> = {
      sentiment: '📊',
      keyword: '🔍',
      price: '💰',
      signal: '🔗',
    };
    const typeColors: Record<string, string> = {
      sentiment: 'var(--blue)',
      keyword: 'var(--yellow)',
      price: 'var(--green)',
      signal: 'var(--purple)',
    };

    listEl.innerHTML = triggers
      .map(
        t => `
      <div class="alert-trigger-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;font-size:11px;">
        <span style="font-size:14px;">${typeIcons[t.type] || '⚡'}</span>
        <span style="color:${typeColors[t.type] || 'var(--text-muted)'};font-weight:600;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;min-width:56px;">${t.type}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <strong>${escapeHtml(t.target)}</strong> ${t.condition || ''} ${t.threshold != null ? t.threshold : ''}
        </span>
        <span style="color:var(--text-muted);font-size:10px;">${t.level}</span>
        <label class="settings-toggle settings-toggle-sm" style="margin:0;">
          <input type="checkbox" ${t.enabled ? 'checked' : ''} data-trigger-id="${t.id}" class="trigger-enabled-toggle" />
          <span class="settings-toggle-slider"></span>
        </label>
        <button class="trigger-remove-btn" data-trigger-id="${t.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;" title="Remove">&times;</button>
      </div>
    `
      )
      .join('');

    listEl.querySelectorAll<HTMLInputElement>('.trigger-enabled-toggle').forEach(cb => {
      cb.addEventListener('change', async () => {
        const { updateTrigger } = await import('@/services/alert-triggers');
        updateTrigger(cb.dataset.triggerId!, { enabled: cb.checked });
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>('.trigger-remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { removeTrigger } = await import('@/services/alert-triggers');
        removeTrigger(btn.dataset.triggerId!);
        renderTriggers();
      });
    });
  };

  renderTriggers();

  container.querySelector('#triggerAddBtn')?.addEventListener('click', async () => {
    const { addTrigger } = await import('@/services/alert-triggers');
    const type = (container.querySelector('#triggerType') as HTMLSelectElement).value as
      | 'sentiment'
      | 'keyword'
      | 'signal';
    const target = (container.querySelector('#triggerTarget') as HTMLInputElement).value.trim();
    const condition = (container.querySelector('#triggerCondition') as HTMLSelectElement).value;
    const thresholdStr = (container.querySelector('#triggerThreshold') as HTMLInputElement).value;
    const level = (container.querySelector('#triggerLevel') as HTMLSelectElement).value as
      | 'critical'
      | 'high'
      | 'medium'
      | 'low';

    if (!target) return;

    const threshold = thresholdStr ? parseFloat(thresholdStr) : undefined;

    addTrigger({
      type,
      target,
      condition,
      threshold,
      level,
      enabled: true,
      cooldownMs: 300_000,
    });

    (container.querySelector('#triggerTarget') as HTMLInputElement).value = '';
    (container.querySelector('#triggerThreshold') as HTMLInputElement).value = '';
    renderTriggers();
  });
}

// ========================================
// Tab 3: Data Sources
// ========================================
function renderDataSourcesTab(container: HTMLElement): void {
  const p = getPreferences();
  const watchlist = getWatchlist();
  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-group-title">Stock Watchlist</div>
      <div class="settings-row">
        <label class="settings-label">Symbols (one per line: SYMBOL|Name)</label>
        <textarea class="settings-textarea" data-dl-watchlist="true" rows="6">${watchlist.map(w => (w.name ? `${w.symbol}|${w.name}` : w.symbol)).join('\n')}</textarea>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group-title">News</div>
      <div class="settings-row">
        <label class="settings-label">Categories (comma-separated)</label>
        <input class="settings-input" data-pref="newsCategories" value="${escapeHtml(p.newsCategories.join(', '))}" />
      </div>
      <div class="settings-row">
        <label class="settings-label">Alert keywords (comma-separated)</label>
        <input class="settings-input" data-pref="newsKeywords" value="${escapeHtml(p.newsKeywords.join(', '))}" />
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group-title">AI</div>
      <div class="settings-row">
        <label class="settings-label">Enable AI summaries</label>
        <label class="settings-toggle">
          <input type="checkbox" data-pref-toggle="aiSummaryEnabled" ${p.aiSummaryEnabled ? 'checked' : ''} />
          <span class="settings-toggle-slider"></span>
        </label>
      </div>
    </div>
  `;
}

// ========================================
// Tab 4: Accounts (SnapTrade + Manual)
// ========================================
const ACCOUNTS_KEY = 'mdm-trading-accounts';
const ACCOUNT_NAMES_KEY = 'mdm-account-names';

interface LocalAccount {
  id: string;
  name: string;
  broker: string;
  balance: number;
  connected: boolean;
  source: 'local' | 'snaptrade';
}

function loadLocalAccounts(): LocalAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalAccounts(accounts: LocalAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function loadAccountNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_NAMES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAccountNames(names: Record<string, string>): void {
  localStorage.setItem(ACCOUNT_NAMES_KEY, JSON.stringify(names));
}

function renderAccountsTab(container: HTMLElement): void {
  const snapConfigured = isSnapTradeConfigured();
  const snapUser = getSnapTradeUser();
  const localAccounts = loadLocalAccounts();
  const accountNames = loadAccountNames();

  let html = `
    <div class="settings-group">
      <div class="settings-group-title">SnapTrade Brokerage Accounts</div>
  `;

  if (!snapConfigured) {
    html += `<div class="settings-hint">Add your SnapTrade API keys in the API Keys tab to connect real brokerage accounts.</div>`;
  } else if (!snapUser) {
    html += `
      <div class="settings-hint" style="margin-bottom:8px">Register with SnapTrade to connect your brokerage accounts.</div>
      <button class="trading-btn" id="snapRegisterBtn" style="width:100%">Register & Connect Brokerage</button>
      <div id="snapRegisterError" class="settings-hint" style="display:none;margin-top:8px;padding:8px;border:1px solid var(--red);color:var(--red);white-space:pre-wrap;line-height:1.4;"></div>
    `;
  } else {
    html += `
      <div class="settings-hint" style="margin-bottom:8px">User: <code>${escapeHtml(snapUser.userId)}</code></div>
      <div id="snapAccountsList" class="settings-accounts-list">
        <div class="panel-loading" style="min-height:40px"><div class="panel-loading-text" style="font-size:11px">Loading accounts...</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="trading-btn trade-snap-btn" id="snapConnectMoreBtn" style="flex:1">+ Connect Another Brokerage</button>
        <button class="trading-btn trading-btn-outline" id="snapResetBtn" style="color:var(--red);border-color:var(--red)">Reset SnapTrade</button>
      </div>
    `;
  }

  html += `</div>`;

  // Manual accounts section
  html += `
    <div class="settings-group">
      <div class="settings-group-title">Manual Accounts</div>
      <div id="manualAccountsList">
        ${
          localAccounts.length === 0
            ? '<div class="settings-hint">No manual accounts added yet.</div>'
            : localAccounts
                .map(
                  a => `
            <div class="settings-account-row" data-id="${a.id}">
              <div class="settings-account-info">
                <span class="settings-account-broker">${escapeHtml(a.broker)}</span>
                <input class="trading-input settings-account-name-input" value="${escapeHtml(accountNames[a.id] || a.name)}" data-acct-id="${a.id}" placeholder="Account name" />
              </div>
              <button class="trading-btn trading-btn-outline settings-acct-remove" data-id="${a.id}" style="color:var(--red);border-color:var(--red);padding:2px 8px;font-size:11px">Remove</button>
            </div>
          `
                )
                .join('')
        }
      </div>
      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
        <div class="trading-label" style="margin-bottom:6px;font-weight:600;">Add Manual Account</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <select class="trading-select" id="newAcctBroker" style="flex:1">
            <option>Interactive Brokers</option>
            <option>TD Ameritrade</option>
            <option>Alpaca</option>
            <option>Schwab</option>
            <option>Webull</option>
            <option>E*TRADE</option>
            <option>Robinhood</option>
            <option>Fidelity</option>
            <option>Coinbase</option>
            <option>Other</option>
          </select>
          <input class="trading-input" id="newAcctName" placeholder="Account name" style="flex:1" />
          <button class="trading-btn" id="addManualAcctBtn" style="background:var(--blue);color:var(--bg);">Add</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Wire SnapTrade actions
  container.querySelector('#snapRegisterBtn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#snapRegisterBtn') as HTMLButtonElement;
    const errBox = container.querySelector('#snapRegisterError') as HTMLElement | null;
    const originalText = btn.textContent || 'Register & Connect Brokerage';
    btn.textContent = 'Registering...';
    btn.disabled = true;
    if (errBox) {
      errBox.style.display = 'none';
      errBox.textContent = '';
    }
    try {
      await registerUser(`mdm-user-${Date.now()}`);
      const url = await getConnectionUrl({ redirectUri: window.location.origin });
      window.open(url, '_blank', 'width=600,height=700');
      // Re-render after a delay to show connected accounts
      setTimeout(() => renderAccountsTab(container), 5000);
      setTimeout(() => renderAccountsTab(container), 15000);
    } catch (err: any) {
      // Extract a clean message by peeling nested JSON wrappers from error strings like:
      // 'SnapTrade API error 500: {"error":"SnapTrade 400: {\"detail\":\"...\"}"}'
      let msg = err?.message || 'Unknown error';
      for (let i = 0; i < 4; i++) {
        const braceIdx = msg.indexOf('{');
        if (braceIdx < 0) break;
        try {
          const parsed = JSON.parse(msg.slice(braceIdx));
          msg = parsed.error || parsed.detail || parsed.message || JSON.stringify(parsed);
          if (typeof msg !== 'string') {
            msg = String(msg);
            break;
          }
        } catch {
          break;
        }
      }
      btn.textContent = originalText;
      btn.disabled = false;
      if (errBox) {
        errBox.textContent = msg;
        errBox.style.display = 'block';
      } else {
        alert(`SnapTrade registration failed:\n\n${msg}`);
      }
    }
  });

  container.querySelector('#snapConnectMoreBtn')?.addEventListener('click', async () => {
    try {
      const url = await getConnectionUrl({ redirectUri: window.location.origin });
      window.open(url, '_blank', 'width=600,height=700');
      setTimeout(() => renderAccountsTab(container), 5000);
      setTimeout(() => renderAccountsTab(container), 15000);
    } catch (err: any) {
      alert(`Failed to get connection URL: ${err.message}`);
    }
  });

  container.querySelector('#snapResetBtn')?.addEventListener('click', async () => {
    if (
      !confirm(
        'This will delete the SnapTrade user, disconnect all brokerages, and free the personal-key quota so you can re-register. Continue?'
      )
    )
      return;
    const btn = container.querySelector('#snapResetBtn') as HTMLButtonElement;
    btn.textContent = 'Resetting...';
    btn.disabled = true;
    try {
      await resetSnapTradeUser();
    } catch {
      /* still proceed to clear UI */
    }
    clearSnapTradeUser();
    renderAccountsTab(container);
  });

  // Load SnapTrade accounts asynchronously
  if (snapConfigured && snapUser) {
    loadSnapAccountsInto(container);
  }

  // Wire manual account remove buttons
  container.querySelectorAll<HTMLButtonElement>('.settings-acct-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const updated = loadLocalAccounts().filter(a => a.id !== btn.dataset.id);
      saveLocalAccounts(updated);
      renderAccountsTab(container);
    });
  });

  // Wire manual account name inputs (save on blur)
  container.querySelectorAll<HTMLInputElement>('.settings-account-name-input').forEach(input => {
    input.addEventListener('blur', () => {
      const names = loadAccountNames();
      const id = input.dataset.acctId!;
      const val = input.value.trim();
      if (val) names[id] = val;
      else delete names[id];
      saveAccountNames(names);
    });
  });

  // Wire add manual account
  container.querySelector('#addManualAcctBtn')?.addEventListener('click', () => {
    const broker = (container.querySelector('#newAcctBroker') as HTMLSelectElement).value;
    const name = (container.querySelector('#newAcctName') as HTMLInputElement).value.trim();
    if (!name) return;
    const accounts = loadLocalAccounts();
    accounts.push({
      id: `acct-${Date.now()}`,
      name,
      broker,
      balance: 0,
      connected: true,
      source: 'local',
    });
    saveLocalAccounts(accounts);
    renderAccountsTab(container);
  });
}

async function loadSnapAccountsInto(container: HTMLElement): Promise<void> {
  const listEl = container.querySelector('#snapAccountsList');
  if (!listEl) return;
  const accountNames = loadAccountNames();

  try {
    const [accounts, caps] = await Promise.all([
      tradingExecutor.getAccounts(),
      tradingExecutor.getCapabilities(),
    ]);

    const capMap = new Map(caps.brokerages.map(b => [b.brokerageId, b]));

    if (accounts.length === 0) {
      listEl.innerHTML = caps.canTrade
        ? '<div class="settings-hint">No brokerage accounts yet. + Connect Another Brokerage to add accounts.</div>'
        : '<div class="settings-hint" style="color:var(--yellow);">No accounts connected. Your connection is read-only — use Reconnect to enable trading.</div>';
      return;
    }

    listEl.innerHTML = accounts
      .map(a => {
        const capId = a.brokerageId || '';
        const cap = capMap.get(capId);
        const canTrade = cap?.connectionType === 'trade' && !cap?.isDisabled;
        const connType = canTrade ? 'trade' : 'read';
        return `
        <div class="settings-account-row" data-id="${a.id}">
          <div class="settings-account-info">
            <span class="settings-account-broker">${escapeHtml(a.broker)}</span>
            <input class="trading-input settings-account-name-input" value="${escapeHtml(accountNames[a.id] || a.name)}" data-acct-id="${a.id}" placeholder="Account name" />
            <span class="settings-account-meta">${a.accountNumber ? '#' + a.accountNumber : ''} · ${a.currency || 'USD'} $${a.balance.toLocaleString()}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <span class="settings-account-meta" style="color:${canTrade ? 'var(--green)' : 'var(--yellow)'}">${connType}</span>
            <button class="trading-btn reconnect-broker-btn" data-broker-id="${capId}" style="font-size:9px;padding:2px 6px;">Reconnect</button>
          </div>
        </div>
      `;
      })
      .join('');

    listEl.querySelectorAll<HTMLInputElement>('.settings-account-name-input').forEach(input => {
      input.addEventListener('blur', () => {
        const names = loadAccountNames();
        const id = input.dataset.acctId!;
        const val = input.value.trim();
        if (val) names[id] = val;
        else delete names[id];
        saveAccountNames(names);
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>('.reconnect-broker-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { getConnectionUrl } = await import('@/services/snaptrade');
        const url = await getConnectionUrl({
          reconnect: true,
          redirectUri: window.location.origin,
        });
        window.open(url, '_blank', 'width=600,height=700');
        setTimeout(() => loadSnapAccountsInto(container), 10000);
      });
    });
  } catch {
    listEl.innerHTML =
      '<div class="settings-hint" style="color:var(--red)">Failed to load SnapTrade accounts.</div>';
  }
}

// ========================================
// Tab 5: API Keys
// ========================================
const SERVICE_KEY_MAP: Record<string, string> = {
  FINNHUB_API_KEY: 'finnhub',
  NEWSAPI_KEY: 'newsapi',
  GITHUB_PAT: 'github',
  OPENROUTER_API_KEY: 'openrouter',
  SNAPTRADE_CLIENT_ID: 'snaptrade',
  SNAPTRADE_CONSUMER_KEY: 'snaptrade',
  SNAPTRADE_USER_ID: 'snaptrade',
  SNAPTRADE_USER_SECRET: 'snaptrade',
  FRED_API_KEY: 'fred',
  CBOE_API_KEY: 'cboe',
  GLASSNODE_API_KEY: 'glassnode',
  WHALE_ALERT_API_KEY: 'whalealert',
  REDDIT_CLIENT_ID: 'reddit',
  REDDIT_CLIENT_SECRET: 'reddit',
  TWITTER_BEARER_TOKEN: 'twitter',
  GMAIL_CLIENT_ID: 'gmail',
  GMAIL_CLIENT_SECRET: 'gmail',
  GMAIL_REFRESH_TOKEN: 'gmail',
  OUTLOOK_CLIENT_ID: 'outlook',
  OUTLOOK_REFRESH_TOKEN: 'outlook',
  FEISHU_APP_ID: 'feishu',
  FEISHU_APP_SECRET: 'feishu',
};

async function testApiKeyFromClient(service: string): Promise<string> {
  try {
    const resp = await fetch(`/api/health?action=test-key&service=${service}`);
    if (!resp.ok) return `HTTP ${resp.status}`;
    const data = await resp.json();
    return data.ok ? '\u2705 Connection OK' : `\u274C ${data.message}`;
  } catch (err: any) {
    return `\u274C ${err.message}`;
  }
}

function renderApiKeysTab(container: HTMLElement): void {
  let html = '';
  for (const group of SECRET_GROUPS) {
    const items = SECRET_REGISTRY.filter(s => s.group === group);
    html += `<div class="settings-group"><div class="settings-group-title">${escapeHtml(group)}</div>`;
    for (const item of items) {
      const val = getSecret(item.key);
      const masked = maskSecret(val);
      const svc = SERVICE_KEY_MAP[item.key];
      if (item.type === 'toggle') {
        html += `
          <div class="settings-row">
            <label class="settings-label">${escapeHtml(item.label)}</label>
            <label class="settings-toggle">
              <input type="checkbox" data-secret="${item.key}" ${val ? 'checked' : ''} />
              <span class="settings-toggle-slider"></span>
            </label>
            ${item.hint ? `<div class="settings-hint">${escapeHtml(item.hint)}</div>` : ''}
          </div>`;
      } else {
        html += `
          <div class="settings-row">
            <label class="settings-label">${escapeHtml(item.label)}${item.required ? ' *' : ''}</label>
            <div class="settings-secret-row">
              <input class="settings-input" type="${item.type === 'password' ? 'password' : 'text'}"
                data-secret="${item.key}"
                placeholder="${escapeHtml(item.placeholder)}"
                value="${val ? escapeHtml(masked) : ''}"
                autocomplete="off" />
              ${svc ? `<button class="trading-btn trading-btn-outline settings-test-btn" data-svc="${svc}" title="Test connection">\u25B6 Test</button>` : ''}
            </div>
            <div class="settings-test-result" data-svc="${svc || ''}" style="font-size:11px;margin-top:4px;"></div>
            ${item.hint ? `<div class="settings-hint">${escapeHtml(item.hint)}</div>` : ''}
          </div>`;
      }
    }
    html += '</div>';
  }
  container.innerHTML = html;

  // Focus clears masked value so user can type fresh
  container.querySelectorAll<HTMLInputElement>('input[data-secret]').forEach(input => {
    if (input.type === 'checkbox') return;
    input.addEventListener('focus', () => {
      if (input.value.includes('\u2022\u2022')) input.value = '';
    });
  });

  // Wire test buttons
  container.querySelectorAll<HTMLButtonElement>('.settings-test-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const svc = btn.dataset.svc!;
      const resultEl = container.querySelector<HTMLElement>(
        `.settings-test-result[data-svc="${svc}"]`
      );
      if (resultEl) {
        resultEl.textContent = 'Testing...';
        resultEl.style.color = 'var(--text-muted)';
      }
      const result = await testApiKeyFromClient(svc);
      if (resultEl) {
        resultEl.textContent = result;
        resultEl.style.color = result.includes('\u2705') ? 'var(--green)' : 'var(--red)';
      }
    });
  });
}

// ========================================
// Panel Visibility section
// ========================================
const TAB_PANEL_DEFS: Record<string, { id: string; label: string }[]> = {
  Dashboard: [
    { id: 'vix-gauge', label: 'VIX Gauge' },
    { id: 'map', label: 'Global Map' },
    { id: 'insights', label: 'AI Summary' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'weather', label: 'Weather' },
    { id: 'email', label: 'Email' },
    { id: 'social', label: 'Tech Community' },
    { id: 'world-clock', label: 'World Clock' },
    { id: 'quick-links', label: 'Quick Links' },
  ],
  Macro: [
    { id: 'macro-calendar', label: 'Macro Calendar' },
    { id: 'economic-indicators', label: 'Economic Indicators' },
    { id: 'central-bank-tracker', label: 'Central Bank Tracker' },
    { id: 'yield-curve', label: 'Yield Curve' },
  ],
  News: [
    { id: 'financial-news', label: 'Financial News' },
    { id: 'live-news', label: 'Live News' },
    { id: 'social-sentiment', label: 'Social Sentiment' },
    { id: 'social-monitor', label: 'Social Monitor' },
    { id: 'reddit-pulse', label: 'Reddit Pulse' },
    { id: 'truth-watch', label: 'Truth Watch' },
    { id: 'x-watch', label: 'X Watch' },
  ],
  Trading: [
    { id: 'trading', label: 'Trading Chart & Orders' },
    { id: 'stocks', label: 'Markets' },
    { id: 'finance', label: 'Portfolio' },
    { id: 'options-flow', label: 'Unusual Options Activity' },
    { id: 'onchain', label: 'Whale Transactions' },
    { id: 'volatility-index', label: 'Volatility Index' },
  ],
  Strategy: [
    { id: 'strategy-journal', label: 'Strategy Journal' },
    { id: 'trade-review', label: 'Trade Review' },
    { id: 'playbook-manager', label: 'Playbook Manager' },
    { id: 'backtest-log', label: 'Backtest Log' },
  ],
  Personal: [
    { id: 'habit-tracker', label: 'Habit Tracker' },
    { id: 'health-metrics', label: 'Health Metrics' },
    { id: 'routine-scheduler', label: 'Routine Scheduler' },
    { id: 'mental-checkin', label: 'Mental Check-In' },
  ],
  DevOps: [
    { id: 'devops', label: 'Process Monitor' },
    { id: 'code-status', label: 'Coding Hub' },
    { id: 'feishu', label: 'Feishu' },
    { id: 'system-monitor', label: 'System Monitor' },
  ],
};

/** Get the effective panel layout (user overrides merged with defaults) */
function getEffectiveLayout(
  customLayout: Record<string, string[]>
): Record<string, { id: string; label: string }[]> {
  // Build a lookup of all panel defs
  const allPanels = new Map<string, { id: string; label: string }>();
  for (const panels of Object.values(TAB_PANEL_DEFS)) {
    for (const p of panels) allPanels.set(p.id, p);
  }

  if (Object.keys(customLayout).length === 0) return { ...TAB_PANEL_DEFS };

  const result: Record<string, { id: string; label: string }[]> = {};
  const placed = new Set<string>();

  for (const tab of Object.keys(TAB_PANEL_DEFS)) {
    const ids = customLayout[tab] || TAB_PANEL_DEFS[tab].map(p => p.id);
    result[tab] = ids.map(id => allPanels.get(id)).filter(Boolean) as {
      id: string;
      label: string;
    }[];
    for (const id of ids) placed.add(id);
  }

  // Any panels not placed go to Dashboard
  for (const [id, def] of allPanels) {
    if (!placed.has(id)) result['Dashboard'].push(def);
  }
  return result;
}

function renderPanelLayoutSection(
  hiddenPanels: string[],
  customLayout: Record<string, string[]>
): string {
  const layout = getEffectiveLayout(customLayout);
  let html = '';
  for (const [tab, panels] of Object.entries(layout)) {
    html += `<div class="settings-panel-vis-group" data-layout-tab="${escapeHtml(tab)}">
      <div class="settings-panel-vis-tab">${escapeHtml(tab)}</div>
      <div class="panel-drop-zone" data-drop-tab="${escapeHtml(tab)}">`;
    for (const p of panels) {
      const isHidden = hiddenPanels.includes(p.id);
      html += `
        <div class="settings-panel-vis-row panel-drag-item" draggable="true" data-panel-id="${p.id}">
          <span class="panel-drag-handle">⠿</span>
          <label class="settings-label">${escapeHtml(p.label)}</label>
          <label class="settings-toggle">
            <input type="checkbox" data-panel-vis="${p.id}" ${!isHidden ? 'checked' : ''} />
            <span class="settings-toggle-slider"></span>
          </label>
        </div>`;
    }
    if (panels.length === 0) {
      html += '<div class="panel-drop-empty">Drop panels here</div>';
    }
    html += '</div></div>';
  }
  return html;
}

function wirePanelDragDrop(container: HTMLElement): void {
  const editor = container.querySelector('#panelLayoutEditor');
  if (!editor) return;

  let draggedEl: HTMLElement | null = null;

  editor.addEventListener('dragstart', (e: Event) => {
    const ev = e as DragEvent;
    const item = (ev.target as HTMLElement).closest('.panel-drag-item') as HTMLElement | null;
    if (!item) return;
    draggedEl = item;
    item.classList.add('dragging');
    ev.dataTransfer!.effectAllowed = 'move';
    ev.dataTransfer!.setData('text/plain', item.dataset.panelId || '');
  });

  editor.addEventListener('dragend', (e: Event) => {
    const item = (e.target as HTMLElement).closest('.panel-drag-item') as HTMLElement | null;
    if (item) item.classList.remove('dragging');
    editor.querySelectorAll('.panel-drop-zone').forEach(z => z.classList.remove('drop-active'));
    draggedEl = null;
  });

  editor.querySelectorAll('.panel-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e: Event) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'move';
      zone.classList.add('drop-active');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drop-active');
    });
    zone.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      zone.classList.remove('drop-active');
      if (!draggedEl) return;

      // Remove empty placeholder if present
      const empty = zone.querySelector('.panel-drop-empty');
      if (empty) empty.remove();

      // Move the dragged element to this zone
      zone.appendChild(draggedEl);
      draggedEl.classList.remove('dragging');

      // Add empty placeholder to source zone if it's now empty
      editor.querySelectorAll('.panel-drop-zone').forEach(z => {
        if (
          z.querySelectorAll('.panel-drag-item').length === 0 &&
          !z.querySelector('.panel-drop-empty')
        ) {
          const ph = document.createElement('div');
          ph.className = 'panel-drop-empty';
          ph.textContent = 'Drop panels here';
          z.appendChild(ph);
        }
      });

      draggedEl = null;
    });
  });
}

// ========================================
// Save functions
// ========================================
function saveSecrets(container: HTMLElement): void {
  const secrets = getAllSecrets();
  container.querySelectorAll<HTMLInputElement>('input[data-secret]').forEach(input => {
    const key = input.dataset.secret as SecretKey;
    if (input.type === 'checkbox') {
      if (input.checked) secrets[key] = '1';
      else delete secrets[key];
    } else {
      const val = input.value.trim();
      if (val && !val.includes('••')) secrets[key] = val;
    }
  });
  setAllSecrets(secrets);
}

function savePrefs(generalContainer: HTMLElement, dataSourcesContainer: HTMLElement): void {
  const prefs: Record<string, unknown> = {};

  // Collect from Data Sources pane
  for (const container of [generalContainer, dataSourcesContainer]) {
    container.querySelectorAll<HTMLInputElement>('input[data-pref]').forEach(input => {
      const key = input.dataset.pref!;
      const val = input.value.trim();
      if (key === 'newsCategories' || key === 'newsKeywords' || key === 'socialKeywords') {
        prefs[key] = val
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      } else {
        prefs[key] = val;
      }
    });

    container.querySelectorAll<HTMLTextAreaElement>('textarea[data-pref]').forEach(ta => {
      const key = ta.dataset.pref!;
      prefs[key] = ta.value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    });

    // Save watchlist to DataLayer (not preferences)
    container.querySelectorAll<HTMLTextAreaElement>('textarea[data-dl-watchlist]').forEach(ta => {
      const entries = ta.value
        .split('\n')
        .map(line => {
          const [sym, ...rest] = line.trim().split('|');
          const symbol = sym?.trim();
          if (!symbol) return null;
          const name = rest.join('|').trim() || undefined;
          return { symbol, name };
        })
        .filter(Boolean) as { symbol: string; name?: string }[];
      setWatchlist(entries);
    });

    container.querySelectorAll<HTMLInputElement>('input[data-pref-toggle]').forEach(input => {
      const key = input.dataset.prefToggle!;
      prefs[key] = input.checked;
    });
  }

  // Panel visibility from General pane
  const hiddenPanels: string[] = [];
  generalContainer.querySelectorAll<HTMLInputElement>('input[data-panel-vis]').forEach(input => {
    if (!input.checked) hiddenPanels.push(input.dataset.panelVis!);
  });
  prefs['hiddenPanels'] = hiddenPanels;

  // Panel layout from drag-and-drop
  const panelLayout: Record<string, string[]> = {};
  generalContainer.querySelectorAll<HTMLElement>('.panel-drop-zone').forEach(zone => {
    const tab = zone.dataset.dropTab;
    if (!tab) return;
    const ids: string[] = [];
    zone.querySelectorAll<HTMLElement>('.panel-drag-item').forEach(item => {
      if (item.dataset.panelId) ids.push(item.dataset.panelId);
    });
    panelLayout[tab] = ids;
  });
  prefs['panelLayout'] = panelLayout;

  setPreferences(prefs as any);
}

// ========================================
// Tab 6: Import/Export
// ========================================
function renderImportExportTab(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-group-title">Export Settings</div>
      <div class="settings-hint" style="margin-bottom:8px">Download all settings as a JSON file for backup or migration.</div>
      <button class="trading-btn" id="exportSettingsBtn" style="background:hsl(var(--primary));color:hsl(0 0% 5%);width:100%;">Export All Settings</button>
    </div>
    <div class="settings-group">
      <div class="settings-group-title">Import Settings</div>
      <div class="settings-hint" style="margin-bottom:8px">Upload a previously exported settings JSON file. This will overwrite all current settings.</div>
      <input type="file" id="importSettingsFile" accept=".json" style="display:none" />
      <button class="trading-btn trading-btn-outline" id="importSettingsBtn" style="width:100%;">Choose File & Import</button>
      <div id="importSettingsResult" style="margin-top:8px;font-size:11px;"></div>
    </div>
  `;

  // Export
  container.querySelector('#exportSettingsBtn')?.addEventListener('click', () => {
    const data = exportAllSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-monitor-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  container.querySelector('#importSettingsBtn')?.addEventListener('click', () => {
    const fileInput = container.querySelector('#importSettingsFile') as HTMLInputElement;
    fileInput.click();
  });

  container.querySelector('#importSettingsFile')?.addEventListener('change', (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const resultEl = container.querySelector('#importSettingsResult') as HTMLElement;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const { imported, failed } = importSettings(parsed);
        if (failed > 0) {
          resultEl.innerHTML = `<span style="color:var(--yellow)">Imported ${imported} keys, ${failed} failed.</span>`;
        } else {
          resultEl.innerHTML = `<span style="color:var(--green)">Successfully imported ${imported} settings.</span>`;
        }
        resultEl.innerHTML +=
          ' <button class="trading-btn" id="reloadAfterImport" style="margin-top:8px;font-size:11px;padding:4px 12px;background:hsl(var(--primary));color:hsl(0 0% 5%);">Reload Page to Apply</button>';
        resultEl.querySelector('#reloadAfterImport')?.addEventListener('click', () => {
          window.location.reload();
        });
      } catch (err: any) {
        resultEl.innerHTML = `<span style="color:var(--red)">Invalid file: ${err.message}</span>`;
      }
    };
    reader.readAsText(file);
    input.value = '';
  });
}

function saveAlertPrefs(container: HTMLElement): void {
  // Global mute
  const muteInput = container.querySelector('#alertMuteAll') as HTMLInputElement | null;
  if (muteInput) setGlobalMute(muteInput.checked);

  // Per-level settings
  const prefs = getAlertSoundPrefs();
  container.querySelectorAll<HTMLElement>('.alert-level-row').forEach(row => {
    const level = row.dataset.level as AlertLevel;
    if (!level) return;
    const enabled =
      (row.querySelector('.alert-level-enabled') as HTMLInputElement)?.checked ?? true;
    const tone =
      (row.querySelector('.alert-level-tone') as HTMLSelectElement)?.value || prefs[level].tone;
    const volume = parseInt(
      (row.querySelector('.alert-level-volume') as HTMLInputElement)?.value || '50'
    );
    prefs[level] = { enabled, tone, volume };
  });
  setAlertSoundPrefs(prefs);
}
