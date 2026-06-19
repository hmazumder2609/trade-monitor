/** All configurable secret keys for external API integrations. */
export type SecretKey =
  | 'FINNHUB_API_KEY'
  | 'NEWSAPI_KEY'
  | 'GITHUB_PAT'
  | 'GMAIL_CLIENT_ID'
  | 'GMAIL_CLIENT_SECRET'
  | 'GMAIL_REFRESH_TOKEN'
  | 'GOOGLE_CALENDAR_ENABLED'
  | 'OUTLOOK_CLIENT_ID'
  | 'OUTLOOK_REFRESH_TOKEN'
  | 'FEISHU_APP_ID'
  | 'FEISHU_APP_SECRET'
  | 'TWITTER_BEARER_TOKEN'
  | 'OPENROUTER_API_KEY'
  | 'OPENROUTER_MODEL'
  | 'SNAPTRADE_CLIENT_ID'
  | 'SNAPTRADE_CONSUMER_KEY'
  | 'SNAPTRADE_USER_ID'
  | 'SNAPTRADE_USER_SECRET'
  | 'FRED_API_KEY'
  | 'CBOE_API_KEY'
  | 'GLASSNODE_API_KEY'
  | 'WHALE_ALERT_API_KEY'
  | 'REDDIT_CLIENT_ID'
  | 'REDDIT_CLIENT_SECRET';

export interface SecretMeta {
  key: SecretKey;
  label: string;
  placeholder: string;
  group: string;
  required?: boolean;
  type?: 'text' | 'password' | 'toggle';
  hint?: string;
}

export const SECRET_REGISTRY: SecretMeta[] = [
  // Stock
  {
    key: 'FINNHUB_API_KEY',
    label: 'Finnhub API Key',
    placeholder: 'c1234...',
    group: 'Stocks',
    required: true,
    hint: 'Free at finnhub.io',
  },
  // News
  {
    key: 'NEWSAPI_KEY',
    label: 'NewsAPI Key (optional)',
    placeholder: '',
    group: 'News',
    hint: 'Optional — RSS feeds work without it',
  },
  // GitHub
  {
    key: 'GITHUB_PAT',
    label: 'GitHub Personal Access Token',
    placeholder: 'ghp_...',
    group: 'Code',
    required: true,
    hint: 'Needs repo + actions:read scope',
  },
  // Gmail
  {
    key: 'GMAIL_CLIENT_ID',
    label: 'Gmail OAuth Client ID',
    placeholder: '...apps.googleusercontent.com',
    group: 'Email',
  },
  {
    key: 'GMAIL_CLIENT_SECRET',
    label: 'Gmail OAuth Client Secret',
    placeholder: 'GOCSPX-...',
    group: 'Email',
    type: 'password',
  },
  {
    key: 'GMAIL_REFRESH_TOKEN',
    label: 'Gmail Refresh Token',
    placeholder: '1//0...',
    group: 'Email',
    type: 'password',
  },
  {
    key: 'GOOGLE_CALENDAR_ENABLED',
    label: 'Enable Google Calendar',
    placeholder: '',
    group: 'Schedule',
    type: 'toggle',
    hint: 'Uses same Gmail OAuth credentials',
  },
  // Outlook
  {
    key: 'OUTLOOK_CLIENT_ID',
    label: 'Outlook Client ID',
    placeholder: '',
    group: 'Email',
    hint: 'Microsoft Graph API',
  },
  {
    key: 'OUTLOOK_REFRESH_TOKEN',
    label: 'Outlook Refresh Token',
    placeholder: '',
    group: 'Email',
    type: 'password',
  },
  // Feishu
  {
    key: 'FEISHU_APP_ID',
    label: 'Feishu App ID',
    placeholder: 'cli_...',
    group: 'Feishu',
    required: true,
  },
  {
    key: 'FEISHU_APP_SECRET',
    label: 'Feishu App Secret',
    placeholder: '',
    group: 'Feishu',
    type: 'password',
  },
  // Twitter
  {
    key: 'TWITTER_BEARER_TOKEN',
    label: 'Twitter Bearer Token',
    placeholder: 'AAAA...',
    group: 'Social',
    type: 'password',
  },
  // AI
  {
    key: 'OPENROUTER_API_KEY',
    label: 'OpenRouter API Key',
    placeholder: 'sk-or-...',
    group: 'AI',
    type: 'password',
    hint: 'For AI summaries',
  },
  {
    key: 'OPENROUTER_MODEL',
    label: 'AI Model',
    placeholder: 'anthropic/claude-opus-4.6-free',
    group: 'AI',
    hint: 'OpenRouter model ID',
  },
  // Trading
  {
    key: 'SNAPTRADE_CLIENT_ID',
    label: 'SnapTrade Client ID',
    placeholder: 'your-client-id',
    group: 'Trading',
    required: true,
    hint: 'From dashboard.snaptrade.com',
  },
  {
    key: 'SNAPTRADE_CONSUMER_KEY',
    label: 'SnapTrade Consumer Key',
    placeholder: 'your-consumer-key',
    group: 'Trading',
    type: 'password',
    hint: 'Keep this secret — used to sign API requests',
  },
  {
    key: 'SNAPTRADE_USER_ID',
    label: 'SnapTrade User ID',
    placeholder: 'auto-filled after registration',
    group: 'Trading',
    hint: 'Personal keys allow only one user — this is persisted after first registration',
  },
  {
    key: 'SNAPTRADE_USER_SECRET',
    label: 'SnapTrade User Secret',
    placeholder: 'auto-filled after registration',
    group: 'Trading',
    type: 'password',
    hint: 'Returned once at registration; paste here if you already registered elsewhere',
  },
  // Macro
  {
    key: 'FRED_API_KEY',
    label: 'FRED API Key',
    placeholder: '',
    group: 'Macro',
    required: true,
    hint: 'Free at fred.stlouisfed.org — economic data',
  },
  // Options
  {
    key: 'CBOE_API_KEY',
    label: 'CBOE API Key (optional)',
    placeholder: '',
    group: 'Options',
    hint: 'Free tier for basic options data',
  },
  // On-chain
  {
    key: 'GLASSNODE_API_KEY',
    label: 'Glassnode API Key (optional)',
    placeholder: '',
    group: 'Crypto',
    hint: 'Paid — on-chain analytics',
  },
  {
    key: 'WHALE_ALERT_API_KEY',
    label: 'Whale Alert API Key (optional)',
    placeholder: '',
    group: 'Crypto',
    hint: 'Free tier available — large transaction alerts',
  },
  // Social
  {
    key: 'REDDIT_CLIENT_ID',
    label: 'Reddit Client ID',
    placeholder: '',
    group: 'Social',
    hint: 'Free at reddit.com/prefs/apps',
  },
  {
    key: 'REDDIT_CLIENT_SECRET',
    label: 'Reddit Client Secret',
    placeholder: '',
    group: 'Social',
    type: 'password',
  },
];

export const SECRET_GROUPS = [...new Set(SECRET_REGISTRY.map(s => s.group))];
