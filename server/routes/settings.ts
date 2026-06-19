/**
 * Settings API route — reads/writes secrets from the .env file
 * so configuration persists across sessions and is available server-side.
 *
 * GET  /api/settings?action=get  → returns all key-value pairs from .env
 * POST /api/settings?action=set  → merges provided key-value pairs into .env
 * GET  /api/settings?action=init → ensures all known keys exist in .env (scaffolds missing ones)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');

/** All keys the app knows about — grouped for readable .env output */
const KEY_GROUPS: Record<string, string[]> = {
  Stocks: ['FINNHUB_API_KEY'],
  News: ['NEWSAPI_KEY'],
  Code: ['GITHUB_PAT'],
  Email: [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GOOGLE_CALENDAR_ENABLED',
    'OUTLOOK_CLIENT_ID',
    'OUTLOOK_REFRESH_TOKEN',
  ],
  Feishu: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'],
  Social: ['TWITTER_BEARER_TOKEN'],
  AI: ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL'],
  Trading: [
    'SNAPTRADE_CLIENT_ID',
    'SNAPTRADE_CONSUMER_KEY',
    'SNAPTRADE_USER_ID',
    'SNAPTRADE_USER_SECRET',
  ],
  Server: ['API_TOKEN', 'PORT'],
};
const ALL_KEYS = Object.values(KEY_GROUPS).flat();

/** Read a single key from .env (with fallback to process.env). Exported for other routes. */
export function readEnvKey(key: string): string {
  const fromFile = parseEnvFile()[key];
  if (fromFile) return fromFile;
  return process.env[key] || '';
}

/** Merge-write one or more keys into .env. Exported for other routes. */
export function writeEnvKeys(updates: Record<string, string>): void {
  const current = parseEnvFile();
  for (const [key, value] of Object.entries(updates)) {
    current[key] = value;
  }
  writeEnvFile(current);
}

function parseEnvFile(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const content = readFileSync(ENV_PATH, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function writeEnvFile(data: Record<string, string>): void {
  const lines: string[] = [];

  // Write grouped keys in a readable format
  for (const [group, keys] of Object.entries(KEY_GROUPS)) {
    lines.push(`# ${group}`);
    for (const key of keys) {
      const value = data[key] || '';
      const needsQuote = value && /[\s#]/.test(value);
      lines.push(`${key}=${needsQuote ? `"${value}"` : value}`);
    }
    lines.push('');
  }

  // Write any extra keys not in our registry (user-added)
  for (const [key, value] of Object.entries(data)) {
    if (!ALL_KEYS.includes(key)) {
      const needsQuote = value && /[\s#]/.test(value);
      lines.push(`${key}=${needsQuote ? `"${value}"` : value}`);
    }
  }

  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');

  // Update process.env so server routes pick up changes immediately
  for (const [key, value] of Object.entries(data)) {
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
}

export async function handleSettingsRequest(
  query: Record<string, string>,
  body: string,
  _headers: Record<string, string | string[] | undefined>
): Promise<unknown> {
  const action = query.action || 'get';

  if (action === 'get') {
    const secrets = parseEnvFile();
    return { secrets };
  }

  if (action === 'init') {
    // Scaffold: ensure all known keys exist in .env, preserving existing values
    const current = parseEnvFile();
    let added = 0;
    for (const key of ALL_KEYS) {
      if (!(key in current)) {
        current[key] = '';
        added++;
      }
    }
    if (added > 0) writeEnvFile(current);
    return { ok: true, added };
  }

  if (action === 'set') {
    let incoming: Record<string, string> = {};
    if (body) {
      try {
        incoming = JSON.parse(body);
      } catch {
        throw new Error('Invalid JSON body');
      }
    }
    const current = parseEnvFile();
    for (const [key, value] of Object.entries(incoming)) {
      current[key] = value; // keep empty keys so .env stays complete
    }
    writeEnvFile(current);
    return { ok: true, saved: Object.keys(incoming) };
  }

  throw new Error(`Unknown settings action: ${action}`);
}
