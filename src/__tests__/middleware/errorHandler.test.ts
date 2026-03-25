/**
 * Tests: Global Error Handler middleware
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { globalErrorHandler } from '../../middleware/errorHandler';

// Mock errorReporter to avoid real Sentry calls
vi.mock('../../lib/errorReporter', () => ({
  captureException: vi.fn().mockResolvedValue('mock-event-id'),
}));

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test',
    query: {},
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

const next: NextFunction = vi.fn();

describe('globalErrorHandler middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.clearAllMocks();
  });

  it('responds with 500 for generic errors', async () => {
    const err = new Error('Something broke');
    const { res, status, json } = makeRes();
    globalErrorHandler(err, makeReq(), res, next);
    // Wait a tick for async captureException
    await new Promise(r => setImmediate(r));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('uses err.status if present', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    const { res, status } = makeRes();
    globalErrorHandler(err, makeReq(), res, next);
    await new Promise(r => setImmediate(r));
    expect(status).toHaveBeenCalledWith(404);
  });

  it('shows full message in development', async () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Dev error details');
    const { res, json } = makeRes();
    globalErrorHandler(err, makeReq(), res, next);
    await new Promise(r => setImmediate(r));
    expect(json).toHaveBeenCalledWith({ error: 'Dev error details' });
  });

  it('hides message in production', async () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Sensitive internal details');
    const { res, json } = makeRes();
    globalErrorHandler(err, makeReq(), res, next);
    await new Promise(r => setImmediate(r));
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('calls captureException', async () => {
    const { captureException } = await import('../../lib/errorReporter');
    const err = new Error('Captured error');
    const { res } = makeRes();
    globalErrorHandler(err, makeReq(), res, next);
    await new Promise(r => setImmediate(r));
    expect(captureException).toHaveBeenCalledWith(err, expect.any(Object));
  });
});
