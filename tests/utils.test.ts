/**
 * Tests for pure utility functions — format.ts and circuit-breaker.ts.
 * Note: escapeHtml is DOM-only and is excluded from server-side tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatPrice,
  formatChange,
  getChangeClass,
  formatCurrency,
  formatDate,
  formatTime,
} from '../src/utils/format';
// Note: escapeHtml uses document.createElement — DOM-only, excluded from server-side tests
import { CircuitBreaker, createCircuitBreaker } from '../src/utils/circuit-breaker';

// ---- formatPrice ----

describe('formatPrice', () => {
  it('formats small prices with 2 decimal places', () => {
    expect(formatPrice(12.5)).toBe('$12.50');
    expect(formatPrice(0.99)).toBe('$0.99');
    expect(formatPrice(999.99)).toBe('$999.99');
  });

  it('formats large prices (>=1000) without decimals', () => {
    expect(formatPrice(1000)).toBe('$1,000');
    expect(formatPrice(12345.67)).toBe('$12,346');
  });
});

// ---- formatChange ----

describe('formatChange', () => {
  it('returns em-dash for null', () => {
    expect(formatChange(null)).toBe('—');
  });

  it('prefixes positive change with +', () => {
    expect(formatChange(1.5)).toBe('+1.50%');
    expect(formatChange(0)).toBe('+0.00%');
  });

  it('leaves negative change unprefixed', () => {
    expect(formatChange(-2.75)).toBe('-2.75%');
  });
});

// ---- getChangeClass ----

describe('getChangeClass', () => {
  it('returns empty string for null', () => {
    expect(getChangeClass(null)).toBe('');
  });

  it('returns positive for zero or positive values', () => {
    expect(getChangeClass(0)).toBe('positive');
    expect(getChangeClass(5)).toBe('positive');
  });

  it('returns negative for negative values', () => {
    expect(getChangeClass(-1)).toBe('negative');
  });
});

// ---- formatCurrency ----

describe('formatCurrency', () => {
  it('formats CNY by default', () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain('1,234');
  });

  it('formats other currencies', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100');
  });
});

// ---- formatDate ----

describe('formatDate', () => {
  it('returns a non-empty string for a valid date', () => {
    const result = formatDate(new Date('2024-01-15'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---- formatTime ----

describe('formatTime', () => {
  it('returns a relative time string for a recent date', () => {
    const recent = new Date(Date.now() - 30_000); // 30 seconds ago
    const result = formatTime(recent);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const result = formatTime(fiveMinAgo);
    expect(result).toMatch(/minute|min|m/i);
  });

  it('handles hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    const result = formatTime(twoHoursAgo);
    expect(result).toMatch(/hour|hr|h/i);
  });

  it('handles days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000);
    const result = formatTime(threeDaysAgo);
    expect(result).toMatch(/day|d/i);
  });
});

// ---- CircuitBreaker ----

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker<string>;

  beforeEach(() => {
    cb = new CircuitBreaker({ name: 'test', maxFailures: 2, cooldownMs: 1000, cacheTtlMs: 500 });
  });

  it('starts not on cooldown', () => {
    expect(cb.isOnCooldown()).toBe(false);
  });

  it('trips after maxFailures', () => {
    cb.recordFailure();
    expect(cb.isOnCooldown()).toBe(false);
    cb.recordFailure();
    expect(cb.isOnCooldown()).toBe(true);
  });

  it('getCooldownRemaining returns 0 when not on cooldown', () => {
    expect(cb.getCooldownRemaining()).toBe(0);
  });

  it('getCooldownRemaining returns positive value on cooldown', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getCooldownRemaining()).toBeGreaterThan(0);
  });

  it('records success and resets state', () => {
    cb.recordFailure();
    cb.recordSuccess('data');
    expect(cb.isOnCooldown()).toBe(false);
    expect(cb.getCached()).toBe('data');
  });

  it('getCached returns null when cache is expired', async () => {
    const shortCb = new CircuitBreaker<string>({ name: 'short', cacheTtlMs: 1 });
    shortCb.recordSuccess('stale');
    await new Promise(r => setTimeout(r, 10));
    expect(shortCb.getCached()).toBeNull();
  });

  it('getCachedOrDefault returns cache when available', () => {
    cb.recordSuccess('cached');
    expect(cb.getCachedOrDefault('default')).toBe('cached');
  });

  it('getCachedOrDefault returns default when no cache', () => {
    expect(cb.getCachedOrDefault('default')).toBe('default');
  });

  it('execute returns fn result on success', async () => {
    const result = await cb.execute(() => Promise.resolve('ok'), 'fallback');
    expect(result).toBe('ok');
    expect(cb.getCached()).toBe('ok');
  });

  it('execute returns default on failure', async () => {
    const result = await cb.execute(() => Promise.reject(new Error('fail')), 'fallback');
    expect(result).toBe('fallback');
  });

  it('execute returns cached result on second call', async () => {
    await cb.execute(() => Promise.resolve('first'), 'fallback');
    const fn = vi.fn(() => Promise.resolve('second'));
    const result = await cb.execute(fn, 'fallback');
    expect(result).toBe('first'); // served from cache
    expect(fn).not.toHaveBeenCalled();
  });

  it('execute returns cached when on cooldown', async () => {
    cb.recordSuccess('last-good');
    cb.recordFailure();
    cb.recordFailure(); // trips
    const result = await cb.execute(() => Promise.resolve('new'), 'fallback');
    expect(result).toBe('last-good');
  });
});

describe('createCircuitBreaker', () => {
  it('returns a CircuitBreaker instance', () => {
    const cb = createCircuitBreaker({ name: 'factory-test' });
    expect(cb).toBeInstanceOf(CircuitBreaker);
  });
});
