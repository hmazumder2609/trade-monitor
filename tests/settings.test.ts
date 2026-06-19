/**
 * Settings route tests — .env read/write/init behaviour.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { handleSettingsRequest } from '../server/routes/settings';

const ENV_PATH = resolve(process.cwd(), '.env');

describe('handleSettingsRequest', () => {
  let originalEnvContent: string | null = null;

  beforeEach(() => {
    // Snapshot the current .env so we can restore it
    originalEnvContent = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf-8') : null;
  });

  afterEach(() => {
    // Restore .env to original state
    if (originalEnvContent !== null) {
      writeFileSync(ENV_PATH, originalEnvContent, 'utf-8');
    } else if (existsSync(ENV_PATH)) {
      unlinkSync(ENV_PATH);
    }
  });

  it('get action returns secrets object', async () => {
    const result = (await handleSettingsRequest({ action: 'get' }, '', {})) as any;
    expect(result).toHaveProperty('secrets');
    expect(typeof result.secrets).toBe('object');
  });

  it('init action returns ok:true', async () => {
    const result = (await handleSettingsRequest({ action: 'init' }, '', {})) as any;
    expect(result.ok).toBe(true);
    expect(typeof result.added).toBe('number');
  });

  it('set action saves key and returns saved list', async () => {
    const result = (await handleSettingsRequest(
      { action: 'set' },
      JSON.stringify({ TEST_KEY_CI: 'test-value' }),
      {}
    )) as any;
    expect(result.ok).toBe(true);
    expect(result.saved).toContain('TEST_KEY_CI');
  });

  it('set action rejects invalid JSON body', async () => {
    await expect(handleSettingsRequest({ action: 'set' }, 'not-json', {})).rejects.toThrow(
      'Invalid JSON body'
    );
  });

  it('throws for unknown action', async () => {
    await expect(handleSettingsRequest({ action: 'unknown' }, '', {})).rejects.toThrow(
      'Unknown settings action: unknown'
    );
  });

  it('defaults to get when no action provided', async () => {
    const result = (await handleSettingsRequest({}, '', {})) as any;
    expect(result).toHaveProperty('secrets');
  });
});
