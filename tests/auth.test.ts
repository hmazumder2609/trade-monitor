/**
 * Auth middleware tests — validates token gating behaviour.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Helper to create minimal mock Express objects
function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/stocks',
    method: 'GET',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res: Partial<Response> & { _status?: number; _body?: unknown } = {
    _status: undefined,
    _body: undefined,
    status(code: number) {
      this._status = code;
      return this as unknown as Response;
    },
    json(body: unknown) {
      this._body = body;
      return this as unknown as Response;
    },
  };
  return res as typeof res & Response;
}

describe('authMiddleware', () => {
  const originalToken = process.env.API_TOKEN;

  afterEach(() => {
    // Restore env after each test
    if (originalToken === undefined) delete process.env.API_TOKEN;
    else process.env.API_TOKEN = originalToken;
  });

  it('calls next() when no API_TOKEN is set (open dev mode)', async () => {
    delete process.env.API_TOKEN;
    const { authMiddleware } = await import('../server/auth');
    const next = {
      called: false,
      fn: () => {
        next.called = true;
      },
    };
    authMiddleware(makeReq(), makeRes(), next.fn as NextFunction);
    expect(next.called).toBe(true);
  });

  it('calls next() for valid Bearer token', async () => {
    process.env.API_TOKEN = 'test-secret';
    const { authMiddleware } = await import('../server/auth');
    const req = makeReq({ headers: { authorization: 'Bearer test-secret' } } as Partial<Request>);
    const next = {
      called: false,
      fn: () => {
        next.called = true;
      },
    };
    authMiddleware(req, makeRes(), next.fn as NextFunction);
    expect(next.called).toBe(true);
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.API_TOKEN = 'test-secret';
    const { authMiddleware } = await import('../server/auth');
    const res = makeRes();
    authMiddleware(makeReq(), res, (() => {}) as NextFunction);
    expect(res._status).toBe(401);
  });

  it('returns 403 for wrong token', async () => {
    process.env.API_TOKEN = 'test-secret';
    const { authMiddleware } = await import('../server/auth');
    const req = makeReq({ headers: { authorization: 'Bearer wrong-token' } } as Partial<Request>);
    const res = makeRes();
    authMiddleware(req, res, (() => {}) as NextFunction);
    expect(res._status).toBe(403);
  });

  it('allows GET /api/settings without auth even with token set', async () => {
    process.env.API_TOKEN = 'test-secret';
    const { authMiddleware } = await import('../server/auth');
    const req = makeReq({ path: '/api/settings', method: 'GET' } as Partial<Request>);
    const next = {
      called: false,
      fn: () => {
        next.called = true;
      },
    };
    authMiddleware(req, makeRes(), next.fn as NextFunction);
    expect(next.called).toBe(true);
  });

  it('requires auth for POST /api/settings', async () => {
    process.env.API_TOKEN = 'test-secret';
    const { authMiddleware } = await import('../server/auth');
    const req = makeReq({ path: '/api/settings', method: 'POST' } as Partial<Request>);
    const res = makeRes();
    authMiddleware(req, res, (() => {}) as NextFunction);
    expect(res._status).toBe(401);
  });
});
