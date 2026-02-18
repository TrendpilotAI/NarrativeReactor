import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  blotatoPublish,
  blotatoGetQueue,
  blotatoGetPost,
  blotatoCancelPost,
  blotatoListAccounts,
} from '../../lib/blotato';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Blotato API Client', () => {
  describe('blotatoPublish', () => {
    it('should publish content to specified platforms', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'post-123',
          status: 'queued',
          platforms: [
            { platform: 'x', status: 'pending' },
            { platform: 'linkedin', status: 'pending' },
          ],
        }),
      });

      const result = await blotatoPublish({
        platforms: ['x', 'linkedin'],
        content: 'Test post content',
      });

      expect(result.id).toBe('post-123');
      expect(result.status).toBe('queued');
      expect(result.platforms).toHaveLength(2);

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/posts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
          }),
        }),
      );
    });

    it('should handle scheduled posts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'post-456',
          status: 'scheduled',
          scheduledAt: '2026-03-01T10:00:00Z',
          platforms: [{ platform: 'x', status: 'pending' }],
        }),
      });

      const result = await blotatoPublish({
        platforms: ['x'],
        content: 'Scheduled post',
        scheduledAt: '2026-03-01T10:00:00Z',
      });

      expect(result.status).toBe('scheduled');
      expect(result.scheduledAt).toBe('2026-03-01T10:00:00Z');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(blotatoPublish({
        platforms: ['x'],
        content: 'Test',
      })).rejects.toThrow('Blotato API error (401)');
    });
  });

  describe('blotatoGetQueue', () => {
    it('should return the queue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { id: 'q1', content: 'Post 1', platforms: ['x'], scheduledAt: '2026-03-01T10:00:00Z', status: 'queued', createdAt: '2026-02-18T05:00:00Z' },
        ]),
      });

      const queue = await blotatoGetQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('q1');
    });
  });

  describe('blotatoGetPost', () => {
    it('should return post status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'post-123',
          status: 'published',
          platforms: [{ platform: 'x', status: 'success', postUrl: 'https://x.com/...' }],
        }),
      });

      const result = await blotatoGetPost('post-123');
      expect(result.status).toBe('published');
    });
  });

  describe('blotatoCancelPost', () => {
    it('should cancel a scheduled post', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await blotatoCancelPost('post-123');
      expect(result.success).toBe(true);
    });
  });

  describe('blotatoListAccounts', () => {
    it('should list connected accounts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { platform: 'x', username: '@test', connected: true },
          { platform: 'linkedin', username: 'Test User', connected: true },
        ]),
      });

      const accounts = await blotatoListAccounts();
      expect(accounts).toHaveLength(2);
      expect(accounts[0].platform).toBe('x');
    });
  });
});
