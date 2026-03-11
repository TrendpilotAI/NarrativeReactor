/**
 * Tests for lib/productionGuard.ts
 */
import { describe, it, expect, afterEach } from 'vitest';
import { guardDestructive, isProduction, ProductionGuardError } from '../../lib/productionGuard';

afterEach(() => {
  delete process.env.NODE_ENV;
});

describe('guardDestructive', () => {
  it('throws ProductionGuardError in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => guardDestructive('delete all data')).toThrow(ProductionGuardError);
    expect(() => guardDestructive('delete all data')).toThrow('delete all data');
    expect(() => guardDestructive('delete all data')).toThrow('NODE_ENV=production');
  });

  it('does not throw in development', () => {
    process.env.NODE_ENV = 'development';
    expect(() => guardDestructive('wipe db')).not.toThrow();
  });

  it('does not throw in test environment', () => {
    process.env.NODE_ENV = 'test';
    expect(() => guardDestructive('reset state')).not.toThrow();
  });

  it('does not throw when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    expect(() => guardDestructive('some op')).not.toThrow();
  });
});

describe('ProductionGuardError', () => {
  it('has correct name', () => {
    const err = new ProductionGuardError('my-op');
    expect(err.name).toBe('ProductionGuardError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ProductionGuardError);
  });

  it('includes operation name in message', () => {
    const err = new ProductionGuardError('nuke database');
    expect(err.message).toContain('nuke database');
  });
});

describe('isProduction', () => {
  it('returns true in production', () => {
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
  });

  it('returns false in development', () => {
    process.env.NODE_ENV = 'development';
    expect(isProduction()).toBe(false);
  });

  it('returns false when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    expect(isProduction()).toBe(false);
  });
});
