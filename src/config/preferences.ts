/** User preferences — stored in localStorage, editable via SettingsModal. */

export interface UserPreferences {
  // News preferences
  newsCategories: string[];
  newsKeywords: string[];
  // GitHub repos to monitor
  githubRepos: string[]; // "owner/repo" format
  // Feishu chat IDs to monitor
  feishuChatIds: string[];
  // Social preferences
  twitterListId: string;
  socialKeywords: string[];
  // Google Calendar
  calendarIds: string[];
  // Email filter labels
  emailLabels: string[];
  // General
  refreshIntervalMs: number;
  aiSummaryEnabled: boolean;
  // Panel visibility per tab (panel id → visible)
  hiddenPanels: string[];
  // Panel layout — which panels go in which tab (overrides defaults)
  panelLayout: Record<string, string[]>;
  // Macro preferences
  macroRegions: string[];
  trackedIndicators: string[];
  // Strategy preferences
  strategyTags: string[];
  playbooks: string[];
  // Habit preferences
  habitCategories: string[];
  // Social sentiment
  sentimentWatchlist: string[];
  // Active tab
  activeTab: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  newsCategories: ['tech', 'finance', 'world'],
  newsKeywords: ['AI', 'startup', 'OpenAI', 'Anthropic'],
  githubRepos: [],
  feishuChatIds: [],
  twitterListId: '',
  socialKeywords: [
    '$AAPL',
    '$MSFT',
    '$GOOGL',
    '$AMZN',
    '$TSLA',
    '$NVDA',
    '$META',
    'trading',
    'stock market',
    'earnings',
    'dividend',
    'IPO',
    'SEC',
  ],
  calendarIds: ['primary'],
  emailLabels: ['INBOX'],
  refreshIntervalMs: 60_000,
  aiSummaryEnabled: true,
  hiddenPanels: [],
  panelLayout: {},
  macroRegions: ['US', 'EU', 'JP', 'CN'],
  trackedIndicators: ['GDP', 'CPI', 'UNRATE', 'FEDFUNDS', 'PCE'],
  strategyTags: [],
  playbooks: [],
  habitCategories: [],
  sentimentWatchlist: [
    '$AAPL',
    '$MSFT',
    '$GOOGL',
    '$AMZN',
    '$TSLA',
    '$NVDA',
    '$META',
    '$SPY',
    '$QQQ',
    '$PLTR',
    '$COIN',
  ],
  activeTab: 'dashboard',
};
