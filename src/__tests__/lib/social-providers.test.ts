import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

const mockReadFile = vi.fn();
const mockAccess = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    access: mockAccess,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('social-providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.X_CLIENT_ID = 'test-client-id';
    process.env.X_CLIENT_SECRET = 'test-client-secret';
  });

  describe('XProvider.post', () => {
    it('happy path', async () => {
      // POST tweet
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: '123' } }),
      });
      // GET /users/me
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { username: 'testuser' } }),
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.post('bearer-token', 'Hello world');
      expect(result.postId).toBe('123');
      expect(result.releaseURL).toBe('https://x.com/testuser/status/123');
      expect(result.status).toBe('posted');
    });

    it('API error — throws', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Rate limited',
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      await expect(provider.post('bearer-token', 'Hello')).rejects.toThrow('Twitter post failed');
    });
  });

  describe('XProvider.getAnalytics', () => {
    it('aggregates metrics correctly', async () => {
      // GET /users/me
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'user1' } }),
      });
      // GET /users/:id/tweets
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { public_metrics: { impression_count: 100, like_count: 10, retweet_count: 5, reply_count: 2 } },
            { public_metrics: { impression_count: 200, like_count: 20, retweet_count: 3, reply_count: 1 } },
          ],
        }),
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.getAnalytics('bearer-token', 7);
      expect(result).toEqual([
        { label: 'Impressions', value: 300, change: '+12%' },
        { label: 'Likes', value: 30, change: '+5%' },
        { label: 'Retweets', value: 8, change: '+8%' },
        { label: 'Replies', value: 3, change: '+3%' },
      ]);
    });

    it('no tweets — returns zeros', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'user1' } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: undefined }),
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.getAnalytics('bearer-token', 7);
      expect(result).toEqual([
        { label: 'Impressions', value: 0, change: '+12%' },
        { label: 'Likes', value: 0, change: '+5%' },
        { label: 'Retweets', value: 0, change: '+8%' },
        { label: 'Replies', value: 0, change: '+3%' },
      ]);
    });
  });

  describe('XProvider.getMentions', () => {
    it('returns formatted mentions', async () => {
      // GET /users/me
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'user1' } }),
      });
      // GET /users/:id/mentions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 't1', text: 'hey @me', created_at: '2024-01-01', author_id: 'a1' },
          ],
          includes: {
            users: [
              { id: 'a1', name: 'Alice', username: 'alice', profile_image_url: 'https://img.com/alice.jpg' },
            ],
          },
        }),
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.getMentions('bearer-token');
      expect(result).toEqual([
        {
          id: 't1',
          text: 'hey @me',
          createdAt: '2024-01-01',
          author: { name: 'Alice', username: 'alice', avatar: 'https://img.com/alice.jpg' },
        },
      ]);
    });
  });

  describe('saveIntegration', () => {
    it('writes JSON file', async () => {
      mockReadFile.mockRejectedValue(new Error('not found'));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      const { saveIntegration } = await import('../../lib/social-providers');
      const details = { id: '1', name: 'Test', username: 'test', accessToken: 'tok' };
      await saveIntegration('x', details);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
      expect(written.x).toEqual(details);
    });
  });

  describe('loadIntegrations', () => {
    it('reads existing file', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ x: { id: '1' } }));
      const { loadIntegrations } = await import('../../lib/social-providers');
      const result = await loadIntegrations();
      expect(result).toEqual({ x: { id: '1' } });
    });

    it('file not found — returns {}', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      const { loadIntegrations } = await import('../../lib/social-providers');
      const result = await loadIntegrations();
      expect(result).toEqual({});
    });
  });
});
