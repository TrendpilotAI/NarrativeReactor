import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureException, captureMessage, isConfigured } from '../../lib/errorReporter';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('errorReporter', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('returns false without SENTRY_DSN', () => {
      delete process.env.SENTRY_DSN;
      // Force re-parse by reimporting (module caches DSN)
      expect(isConfigured()).toBe(false);
    });
  });

  describe('captureException', () => {
    it('does nothing when SENTRY_DSN not set', async () => {
      delete process.env.SENTRY_DSN;
      const eventId = await captureException(new Error('test'));
      expect(eventId).toMatch(/^[a-f0-9]{32}$/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends envelope to Sentry when DSN is set', async () => {
      process.env.SENTRY_DSN = 'https://abc123@o0.ingest.sentry.io/12345';
      mockFetch.mockResolvedValue({ ok: true });

      const eventId = await captureException(new Error('boom'), { extra: 'data' });
      expect(eventId).toMatch(/^[a-f0-9]{32}$/);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://o0.ingest.sentry.io/api/12345/envelope/');
      expect(options.method).toBe('POST');
      expect(options.headers['X-Sentry-Auth']).toContain('sentry_key=abc123');
    });

    it('silently handles fetch failure', async () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/1';
      mockFetch.mockRejectedValue(new Error('network down'));

      // Should not throw
      const eventId = await captureException(new Error('test'));
      expect(eventId).toBeTruthy();
    });
  });

  describe('captureMessage', () => {
    it('sends message event when DSN configured', async () => {
      process.env.SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';
      mockFetch.mockResolvedValue({ ok: true });

      await captureMessage('something happened', 'warning');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('something happened');
      expect(body).toContain('"level":"warning"');
    });
  });

  describe('sensitive data scrubbing', () => {
    it('redacts secret env vars in extra data', async () => {
      process.env.SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';
      mockFetch.mockResolvedValue({ ok: true });

      await captureException(new Error('leak'), {
        API_KEY: 'secret-key',
        ANTHROPIC_API_KEY: 'sk-ant-xxx',
        safe_data: 'this is fine',
      });

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('[REDACTED]');
      expect(body).not.toContain('secret-key');
      expect(body).not.toContain('sk-ant-xxx');
      expect(body).toContain('this is fine');
    });
  });
});
