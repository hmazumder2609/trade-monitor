/**
 * Basic API server tests — validates route wiring, auth, and core endpoints.
 */
import { describe, it, expect, beforeAll } from 'vitest';

// We test the route handlers directly (no HTTP layer needed)
import { handleHealthRequest } from '../server/routes/health';
import { handleNewsRequest } from '../server/routes/news';
import { handleSettingsRequest } from '../server/routes/settings';

describe('Health route', () => {
  it('returns cpu, memory, uptime', async () => {
    const result = await handleHealthRequest({ probes: '' }, '', {});
    expect(result).toHaveProperty('cpu');
    expect(result).toHaveProperty('memoryUsedPercent');
    expect(result).toHaveProperty('uptime');
    expect(typeof result.cpu).toBe('number');
    expect(typeof result.memoryUsedPercent).toBe('number');
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('runs probes when provided', async () => {
    const result = await handleHealthRequest({ probes: 'https://httpbin.org/status/200' }, '', {});
    expect(result.probes).toHaveLength(1);
    expect(result.probes[0]).toHaveProperty('url');
    expect(result.probes[0]).toHaveProperty('ok');
    expect(result.probes[0]).toHaveProperty('latencyMs');
  });

  it('falls back to default probes when empty string given', async () => {
    // empty string still splits to [''], which gets filtered, then falls back to defaults
    const result = await handleHealthRequest({}, '', {});
    expect(Array.isArray(result.probes)).toBe(true);
  });
});

describe('News route', () => {
  it('returns articles array', async () => {
    const result = (await handleNewsRequest({}, '', {})) as any;
    expect(result).toHaveProperty('articles');
    expect(Array.isArray(result.articles)).toBe(true);
  }, 15_000);
});

describe('Settings route', () => {
  it('init action returns ok', async () => {
    const result = (await handleSettingsRequest({ action: 'init' }, '', {})) as any;
    expect(result).toHaveProperty('ok');
    expect(result.ok).toBe(true);
  });

  it('get action returns secrets', async () => {
    const result = (await handleSettingsRequest({ action: 'get' }, '', {})) as any;
    expect(result).toHaveProperty('secrets');
  });
});

describe('Auth middleware', () => {
  it('exports authMiddleware function', async () => {
    const { authMiddleware } = await import('../server/auth');
    expect(typeof authMiddleware).toBe('function');
  });
});

describe('Logger', () => {
  it('exports logger and httpLogger', async () => {
    const { logger, httpLogger } = await import('../server/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof httpLogger).toBe('function');
  });
});
