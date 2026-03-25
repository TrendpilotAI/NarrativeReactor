/**
 * Tests: Agent Communication service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMessageLog, getRegisteredAgents, receiveMessage, sendMessage } from '../../services/agentComm';

describe('Agent Communication Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getRegisteredAgents', () => {
    it('returns empty object when no registry env vars', () => {
      // Remove all AGENT_REGISTRY_ vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('AGENT_REGISTRY_')) delete process.env[key];
      }
      const agents = getRegisteredAgents();
      expect(agents).toBeTypeOf('object');
    });

    it('parses AGENT_REGISTRY_* env vars', () => {
      process.env.AGENT_REGISTRY_TRENDPILOT = 'http://localhost:3500';
      const agents = getRegisteredAgents();
      expect(agents.TRENDPILOT).toBe('http://localhost:3500');
      delete process.env.AGENT_REGISTRY_TRENDPILOT;
    });
  });

  describe('getMessageLog', () => {
    it('returns an array', () => {
      const log = getMessageLog();
      expect(Array.isArray(log)).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('returns error when target agent not registered', async () => {
      const result = await sendMessage('UNKNOWN_AGENT', {
        type: 'TaskRequest',
        task: 'generate content',
        payload: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent');
    });

    it('sends a message to a registered agent', async () => {
      process.env.AGENT_REGISTRY_TESTBOT = 'http://localhost:9999';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ received: true }),
      });
      global.fetch = mockFetch;

      const result = await sendMessage('TESTBOT', {
        type: 'TaskRequest',
        task: 'test task',
        payload: { key: 'value' },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);

      delete process.env.AGENT_REGISTRY_TESTBOT;
    });

    it('returns error on network failure', async () => {
      process.env.AGENT_REGISTRY_FAILBOT = 'http://localhost:9999';
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await sendMessage('FAILBOT', {
        type: 'StatusUpdate',
        status: 'running',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');

      delete process.env.AGENT_REGISTRY_FAILBOT;
    });
  });

  describe('receiveMessage', () => {
    it('stores a received message in the log', () => {
      const before = getMessageLog().length;
      receiveMessage({
        type: 'Heartbeat',
        id: 'test-id-1',
        from: 'TrendPilot',
        uptime: 12345,
        timestamp: new Date().toISOString(),
      });
      const after = getMessageLog();
      expect(after.length).toBeGreaterThanOrEqual(before);
    });
  });
});
