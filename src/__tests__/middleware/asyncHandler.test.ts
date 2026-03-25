/**
 * Tests: asyncHandler middleware
 */
import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';

const mockReq = {} as Request;
const mockRes = {} as Response;

describe('asyncHandler', () => {
  it('calls next with error when async handler throws', async () => {
    const error = new Error('Async error');
    const next = vi.fn();
    const handler = asyncHandler(async () => { throw error; });

    handler(mockReq, mockRes, next);

    // Wait a tick for the promise to resolve
    await new Promise(r => setImmediate(r));
    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next when handler resolves normally', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async (_req, res) => {
      // Simulate a handler that completes normally (no error)
    });

    handler(mockReq, mockRes, next);
    await new Promise(r => setImmediate(r));
    expect(next).not.toHaveBeenCalled();
  });

  it('wraps handler and passes req, res, next', async () => {
    const innerFn = vi.fn().mockResolvedValue(undefined);
    const next = vi.fn();
    const handler = asyncHandler(innerFn);

    handler(mockReq, mockRes, next);
    await new Promise(r => setImmediate(r));
    expect(innerFn).toHaveBeenCalledWith(mockReq, mockRes, next);
  });

  it('forwards synchronous errors via Promise.resolve', async () => {
    const error = new Error('Sync-like error in async');
    const next = vi.fn();
    const handler = asyncHandler(async () => { throw error; });

    handler(mockReq, mockRes, next);
    await new Promise(r => setImmediate(r));
    expect(next).toHaveBeenCalledWith(error);
  });
});
