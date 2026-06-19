/**
 * System Health API — CPU, memory, uptime, and configurable URL probes.
 * Uses Node.js os module for system metrics and fetch for health checks.
 */
import os from 'node:os';
import type { IncomingHttpHeaders } from 'node:http';

interface ProbeResult {
  url: string;
  ok: boolean;
  latencyMs: number;
}

interface HealthResponse {
  cpu: number;
  memoryUsedPercent: number;
  uptime: number;
  probes: ProbeResult[];
}

// Default probe URLs if none provided
const DEFAULT_PROBES = ['https://www.google.com', 'https://github.com', 'https://api.github.com'];

/**
 * Ping a URL with timeout and measure latency
 */
async function probeUrl(url: string, timeoutMs = 3000): Promise<ProbeResult> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'SystemHealthMonitor/1.0' },
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    return {
      url,
      ok: response.ok,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      url,
      ok: false,
      latencyMs,
    };
  }
}

/**
 * Calculate CPU load average as percentage (0-100)
 * Uses 1-minute load average normalized by CPU count
 */
function getCpuLoad(): number {
  const loadAvg = os.loadavg()[0]; // 1-minute average
  const cpuCount = os.cpus().length;
  const loadPercent = (loadAvg / cpuCount) * 100;
  return Math.min(Math.round(loadPercent), 100);
}

/**
 * Calculate memory usage percentage
 */
function getMemoryUsage(): number {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedPercent = (used / total) * 100;
  return Math.round(usedPercent);
}

/**
 * Get system uptime in seconds
 */
function getSystemUptime(): number {
  return Math.round(os.uptime());
}

const TEST_SERVICE_ENDPOINTS: Record<string, string> = {
  finnhub: 'https://finnhub.io/api/v1/stock/symbol?exchange=US',
  newsapi: 'https://newsapi.org/v2/top-headlines?country=us&pageSize=1',
  github: 'https://api.github.com/user',
  openrouter: 'https://openrouter.ai/api/v1/auth/key',
  snaptrade: 'https://api.snaptrade.com/api/v1/snapTrade/accountInformation',
  fred: 'https://api.stlouisfed.org/fred/series/observations?series_id=GDP&limit=1',
  cboe: 'https://www.cboe.com/us/options/market_statistics/summary',
  glassnode: 'https://api.glassnode.com/v1/metrics/indicators/sopr',
  whalealert: 'https://api.whale-alert.io/v1/status',
  reddit: 'https://oauth.reddit.com/api/v1/me',
  twitter: 'https://api.twitter.com/2/tweets?ids=1',
  gmail: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
  outlook: 'https://graph.microsoft.com/v1.0/me',
  feishu: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
};

async function testApiKey(
  service: string,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const endpoint = TEST_SERVICE_ENDPOINTS[service];
  if (!endpoint) return { ok: false, message: `Unknown service: ${service}` };
  if (!apiKey) return { ok: false, message: 'No API key configured' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    if (service === 'feishu') {
      const appId = process.env.FEISHU_APP_ID || '';
      const appSecret = process.env.FEISHU_APP_SECRET || '';
      if (!appId || !appSecret)
        return { ok: false, message: 'FEISHU_APP_ID and FEISHU_APP_SECRET required' };
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'MyDailyMonitor/1.0' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const body: any = await resp.json().catch(() => ({}));
      return {
        ok: body?.code === 0,
        message: body?.code === 0 ? 'Token acquired' : `API error: ${body?.msg || resp.status}`,
      };
    }

    const headers: Record<string, string> = { 'User-Agent': 'MyDailyMonitor/1.0' };
    if (service === 'finnhub') headers['X-Finnhub-Key'] = apiKey;
    else if (['github', 'openrouter', 'snaptrade', 'reddit', 'gmail', 'outlook'].includes(service))
      headers['Authorization'] = `Bearer ${apiKey}`;

    let url = endpoint;
    if (service === 'finnhub') url += `&token=${apiKey}`;
    else if (service === 'newsapi') url += `&apiKey=${apiKey}`;
    else if (service === 'fred') url += `&api_key=${apiKey}`;
    else if (service === 'glassnode') url += `&api_key=${apiKey}`;
    else if (service === 'whalealert') url += `&api_key=${apiKey}`;

    const resp = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    return { ok: resp.ok, message: `HTTP ${resp.status}${resp.ok ? ' - OK' : ''}` };
  } catch (err: any) {
    return { ok: false, message: err.name === 'AbortError' ? 'Timeout (5s)' : err.message };
  }
}

export async function handleHealthRequest(
  query: Record<string, string>,
  _body: string,
  _headers: IncomingHttpHeaders
): Promise<unknown> {
  if (query.action === 'test-key') {
    const service = (query.service || '').toLowerCase().trim();

    const ENV_KEY_OVERRIDES: Record<string, string[]> = {
      gmail: ['GMAIL_REFRESH_TOKEN', 'GMAIL_CLIENT_ID'],
      outlook: ['OUTLOOK_REFRESH_TOKEN', 'OUTLOOK_CLIENT_ID'],
      feishu: ['FEISHU_APP_ID'],
      snaptrade: ['SNAPTRADE_CLIENT_ID', 'SNAPTRADE_CONSUMER_KEY'],
      reddit: ['REDDIT_CLIENT_ID'],
    };

    const candidates = ENV_KEY_OVERRIDES[service] || [
      `${service.toUpperCase()}_API_KEY`,
      `${service.toUpperCase()}_KEY`,
      `${service.toUpperCase()}_BEARER_TOKEN`,
      `${service.toUpperCase()}_PAT`,
    ];

    let apiKey = '';
    for (const name of candidates) {
      apiKey = process.env[name] || '';
      if (apiKey) break;
    }

    return testApiKey(service, apiKey);
  }

  // Parse probe URLs from query params (comma-separated)
  const probeUrlsRaw = query.probes || DEFAULT_PROBES.join(',');
  const probeUrls = probeUrlsRaw
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  // Collect system metrics
  const cpu = getCpuLoad();
  const memoryUsedPercent = getMemoryUsage();
  const uptime = getSystemUptime();

  // Run all probes in parallel
  const probeResults = await Promise.all(probeUrls.map(url => probeUrl(url, 3000)));

  return {
    cpu,
    memoryUsedPercent,
    uptime,
    probes: probeResults,
  };
}
