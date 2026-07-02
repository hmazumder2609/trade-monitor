/**
 * Central registry of all known localStorage keys used by panels and the app.
 * Single source of truth for import/export and key discovery.
 */

export const SETTINGS_KEYS = {
  /** Global preferences (UserPreferences interface) */
  preferences: 'mdm-preferences-v1',
  /** API keys / secrets (encrypted at rest by browser) */
  secrets: 'mdm-secrets-v1',
  /** Panel row height overrides */
  panelSpans: 'mdm-panel-spans',
  /** Panel column width overrides */
  panelColSpans: 'mdm-panel-col-spans',
  /** Panel order within each grid */
  panelOrder: 'mdm-panel-order',
  /** Custom iframe/API panels */
  customPanels: 'mdm-custom-panels',
  /** Last active tab */
  activeTab: 'mdm-active-tab',
  /** Per-panel refresh interval overrides (panelId -> ms) */
  refreshOverrides: 'mdm-refresh-overrides',
  /** FinancialNewsPlugin: RSS source list */
  financialNewsSources: 'mdm-financial-news-sources',
  /** FinancialNewsPlugin: filter state */
  financialNewsFilters: 'mdm-financial-news-filters',
  /** SocialSentimentPlugin: tracked accounts */
  socialSentimentAccounts: 'mdm-social-sentiment-accounts',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export const ALL_SETTINGS_KEYS: string[] = Object.values(SETTINGS_KEYS);

/** Export format version - bump on breaking schema changes */
export const EXPORT_FORMAT_VERSION = 1;

export interface SettingsExport {
  version: number;
  exportedAt: string;
  data: Record<string, string | null>;
}

/** Collect all known settings from localStorage into an export payload. */
export function exportAllSettings(): SettingsExport {
  const data: Record<string, string | null> = {};
  for (const key of ALL_SETTINGS_KEYS) {
    try {
      data[key] = localStorage.getItem(key);
    } catch {
      data[key] = null;
    }
  }
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Import settings from an export payload into localStorage. Returns count of imported/failed keys. */
export function importSettings(exportData: SettingsExport): { imported: number; failed: number } {
  let imported = 0;
  let failed = 0;
  if (!exportData || typeof exportData !== 'object' || !exportData.data) {
    return { imported: 0, failed: 0 };
  }
  for (const [key, value] of Object.entries(exportData.data)) {
    if (!ALL_SETTINGS_KEYS.includes(key)) continue;
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
      imported++;
    } catch {
      failed++;
    }
  }
  return { imported, failed };
}
