/**
 * Settings store — manages API keys (secrets) and user preferences.
 *
 * Secrets live in localStorage during the session — no .env writes on every change.
 * .env is synced only on explicit save (Settings modal) and page unload,
 * so Vite doesn't restart while the user is editing settings.
 *
 * On startup, secrets are loaded from .env and merged into localStorage.
 * Preferences remain localStorage-only (they're UI prefs, not secrets).
 */

import type { SecretKey } from '@/config/settings-keys';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/config/preferences';

const SECRETS_STORAGE_KEY = 'mdm-secrets-v1';
const PREFS_STORAGE_KEY = 'mdm-preferences-v1';

// ---- Events ----
export const SETTINGS_CHANGED_EVENT = 'mdm-settings-changed';
export const PREFS_CHANGED_EVENT = 'mdm-prefs-changed';

// ---- .env sync state ----
let envSynced = false;
let syncPromise: Promise<void> | null = null;

/**
 * Load secrets from the server .env file and merge into localStorage.
 * Server values win over localStorage (server is source of truth on startup).
 */
async function syncFromEnv(): Promise<void> {
  if (envSynced) return;
  try {
    await fetch('/api/settings?action=init');

    const resp = await fetch('/api/settings?action=get');
    if (!resp.ok) return;
    const data = await resp.json();
    const envSecrets: Record<string, string> = data.secrets || {};
    const local = loadSecretsRaw();

    // Merge: env values override localStorage, but keep any localStorage-only keys
    let changed = false;
    for (const [key, value] of Object.entries(envSecrets)) {
      if (value && local[key] !== value) {
        local[key] = value;
        changed = true;
      }
    }

    // Push any localStorage-only secrets to .env (first-time migration)
    const toSync: Record<string, string> = {};
    for (const [key, value] of Object.entries(local)) {
      if (value && !envSecrets[key]) {
        toSync[key] = value;
      }
    }
    if (Object.keys(toSync).length > 0) {
      await fetch('/api/settings?action=set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSync),
      });
    }

    if (changed) {
      localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(local));
    }
    envSynced = true;
  } catch {
    // Server unavailable — fall back to localStorage only
  }
}

/** Push all current secrets to the server .env file. Called on explicit save only. */
export async function persistToEnv(): Promise<void> {
  try {
    const secrets = loadSecretsRaw();
    await fetch('/api/settings?action=set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secrets),
    });
  } catch {
    // Server unavailable — localStorage still has the data
  }
}

/** Kick off initial sync. Called once at module load. */
function ensureSync(): Promise<void> {
  if (!syncPromise) {
    syncPromise = syncFromEnv();
  }
  return syncPromise;
}

// Start sync immediately on import
ensureSync();

// ---- Raw localStorage helpers ----

function loadSecretsRaw(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSecretsRaw(secrets: Record<string, string>): void {
  localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(secrets));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
}

// ---- Public Secrets API ----

export function getSecret(key: SecretKey): string {
  return loadSecretsRaw()[key] || '';
}

/** Write a secret to localStorage only — no .env write, no server restart. */
export function setSecret(key: SecretKey, value: string): void {
  const s = loadSecretsRaw();
  if (value) s[key] = value.trim();
  else delete s[key];
  saveSecretsRaw(s);
}

export function hasSecret(key: SecretKey): boolean {
  return !!loadSecretsRaw()[key];
}

export function getAllSecrets(): Record<string, string> {
  return loadSecretsRaw();
}

/** Write all secrets to localStorage only. */
export function setAllSecrets(secrets: Record<string, string>): void {
  saveSecretsRaw(secrets);
}

export function clearAllSecrets(): void {
  localStorage.removeItem(SECRETS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••' + value.slice(-4);
}

/**
 * Wait for initial .env sync to complete.
 * Call this before first use if you need guaranteed up-to-date secrets.
 */
export async function waitForSync(): Promise<void> {
  return ensureSync();
}

// ---- Preferences (localStorage only) ----

function loadPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePrefs(prefs: UserPreferences): void {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
}

export function getPreferences(): UserPreferences {
  return loadPrefs();
}

export function setPreferences(partial: Partial<UserPreferences>): void {
  const current = loadPrefs();
  savePrefs({ ...current, ...partial });
}

export function resetPreferences(): void {
  savePrefs({ ...DEFAULT_PREFERENCES });
}

// ---- Convenience ----

export function getGithubRepos(): string[] {
  return getPreferences().githubRepos;
}

export function subscribeSettingsChange(cb: () => void): () => void {
  const h1 = () => cb();
  const h2 = () => cb();
  window.addEventListener(SETTINGS_CHANGED_EVENT, h1);
  window.addEventListener(PREFS_CHANGED_EVENT, h2);
  return () => {
    window.removeEventListener(SETTINGS_CHANGED_EVENT, h1);
    window.removeEventListener(PREFS_CHANGED_EVENT, h2);
  };
}
