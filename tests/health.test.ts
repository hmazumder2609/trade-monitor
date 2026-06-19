/**
 * Health route tests — system metrics and URL probes.
 */
import { describe, it, expect } from 'vitest';
import { handleHealthRequest } from '../server/routes/health';

describe('handleHealthRequest', () => {
  it('returns cpu as a number between 0 and 100', async () => {
    const result = await handleHealthRequest({}, '', {});
    expect(result.cpu).toBeGreaterThanOrEqual(0);
    expect(result.cpu).toBeLessThanOrEqual(100);
  });

  it('returns memoryUsedPercent between 0 and 100', async () => {
    const result = await handleHealthRequest({}, '', {});
    expect(result.memoryUsedPercent).toBeGreaterThanOrEqual(0);
    expect(result.memoryUsedPercent).toBeLessThanOrEqual(100);
  });

  it('returns positive uptime', async () => {
    const result = await handleHealthRequest({}, '', {});
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('runs default probes when no probes param provided', async () => {
    const result = await handleHealthRequest({}, '', {});
    expect(Array.isArray(result.probes)).toBe(true);
    expect(result.probes.length).toBeGreaterThan(0);
  });

  it('probes contain required fields', async () => {
    const result = await handleHealthRequest({ probes: 'https://httpbin.org/status/200' }, '', {});
    const probe = result.probes[0];
    expect(probe).toHaveProperty('url');
    expect(probe).toHaveProperty('ok');
    expect(probe).toHaveProperty('latencyMs');
    expect(typeof probe.latencyMs).toBe('number');
  });

  it('handles unreachable URLs gracefully', async () => {
    const result = await handleHealthRequest({ probes: 'http://localhost:9' }, '', {});
    expect(result.probes[0].ok).toBe(false);
    expect(result.probes[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('handles empty probes string by using defaults', async () => {
    const result = await handleHealthRequest({ probes: '' }, '', {});
    expect(Array.isArray(result.probes)).toBe(true);
  });

  it('handles multiple comma-separated probes', async () => {
    const result = await handleHealthRequest(
      { probes: 'https://www.google.com,https://github.com' },
      '',
      {}
    );
    expect(result.probes.length).toBe(2);
  });
}, 20_000);
