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

  describe('XProvider.generateAuthUrl', () => {
    it('generates auth URL with PKCE params', async () => {
      process.env.X_CLIENT_ID = 'my-client-id';
      process.env.FRONTEND_URL = 'https://myapp.com';
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.generateAuthUrl();
      expect(result.url).toContain('twitter.com/i/oauth2/authorize');
      expect(result.url).toContain('my-client-id');
      expect(result.url).toContain('https%3A%2F%2Fmyapp.com');
      expect(result.codeVerifier).toBeTruthy();
      expect(result.state).toMatch(/^[0-9a-f]+$/);
    });

    it('uses default localhost when FRONTEND_URL is unset', async () => {
      process.env.X_CLIENT_ID = 'my-client-id';
      delete process.env.FRONTEND_URL;
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.generateAuthUrl();
      expect(result.url).toContain('localhost%3A3010');
    });
  });

  describe('XProvider.authenticate', () => {
    it('authenticates with client secret (Basic auth)', async () => {
      process.env.X_CLIENT_ID = 'cid';
      process.env.X_CLIENT_SECRET = 'csecret';
      // Token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'atk', refresh_token: 'rtk', expires_in: 3600 }),
      });
      // User info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'u1', name: 'Alice', username: 'alice', profile_image_url: 'img.jpg' } }),
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.authenticate({ code: 'auth-code', codeVerifier: 'verifier' });
      expect(result.accessToken).toBe('atk');
      expect(result.refreshToken).toBe('rtk');
      expect(result.name).toBe('Alice');
      // Should have used Basic auth header
      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders['Authorization']).toContain('Basic ');
    });

    it('authenticates without client secret (public client)', async () => {
      process.env.X_CLIENT_ID = 'cid';
      delete process.env.X_CLIENT_SECRET;
      // Token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'atk' }),
      });
      // User info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'u1', name: 'Bob', username: 'bob' } }),
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      const result = await provider.authenticate({ code: 'code', codeVerifier: 'v' });
      expect(result.name).toBe('Bob');
      // No Authorization header (public client)
      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders['Authorization']).toBeUndefined();
    });

    it('throws on token exchange failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Bad credentials',
      });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      await expect(provider.authenticate({ code: 'bad', codeVerifier: 'v' })).rejects.toThrow('Twitter token exchange failed');
    });

    it('throws when user info fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'atk' }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false });
      const { XProvider } = await import('../../lib/social-providers');
      const provider = new XProvider();
      await expect(provider.authenticate({ code: 'c', codeVerifier: 'v' })).rejects.toThrow('Failed to fetch Twitter user info');
    });
  });

  describe('LinkedInProvider.generateAuthUrl', () => {
    it('generates auth URL', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'li-client';
      process.env.FRONTEND_URL = 'https://myapp.com';
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      const result = await provider.generateAuthUrl();
      expect(result.url).toContain('linkedin.com/oauth/v2/authorization');
      expect(result.url).toContain('li-client');
      expect(result.state).toBeTruthy();
    });
  });

  describe('LinkedInProvider.authenticate', () => {
    it('authenticates successfully', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'li-cid';
      process.env.LINKEDIN_CLIENT_SECRET = 'li-csecret';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'li-atk', expires_in: 5183944 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'li-u1', name: 'Carol', email: 'carol@example.com', picture: 'pic.jpg' }),
      });
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      const result = await provider.authenticate({ code: 'licode', codeVerifier: '' });
      expect(result.accessToken).toBe('li-atk');
      expect(result.name).toBe('Carol');
    });

    it('throws on token exchange failure', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'li-cid';
      process.env.LINKEDIN_CLIENT_SECRET = 'li-csecret';
      mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Unauthorized' });
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      await expect(provider.authenticate({ code: 'bad', codeVerifier: '' })).rejects.toThrow('LinkedIn token exchange failed');
    });

    it('throws when user info fetch fails', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'li-cid';
      process.env.LINKEDIN_CLIENT_SECRET = 'li-csecret';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'li-atk' }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false });
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      await expect(provider.authenticate({ code: 'c', codeVerifier: '' })).rejects.toThrow('Failed to fetch LinkedIn user info');
    });
  });

  describe('LinkedInProvider.post', () => {
    it('posts successfully', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'li-cid';
      // Get user URN
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'li-sub-123' }),
      });
      // Post
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'urn:li:ugcPost:123' }),
      });
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      const result = await provider.post('li-atk', 'Hello LinkedIn!');
      expect(result.status).toBe('posted');
      expect(result.postId).toBe('urn:li:ugcPost:123');
      expect(result.releaseURL).toContain('linkedin.com');
    });

    it('throws when post fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'li-sub-123' }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Forbidden' });
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      await expect(provider.post('li-atk', 'test')).rejects.toThrow('LinkedIn post failed');
    });
  });

  describe('LinkedInProvider.getAnalytics and getMentions', () => {
    it('getAnalytics returns placeholder data', async () => {
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      const result = await provider.getAnalytics('tok', 7);
      expect(result).toHaveLength(4);
      expect(result[0].label).toBe('Impressions');
    });

    it('getMentions returns empty array', async () => {
      const { LinkedInProvider } = await import('../../lib/social-providers');
      const provider = new LinkedInProvider();
      const result = await provider.getMentions('tok');
      expect(result).toEqual([]);
    });
  });

  describe('saveIntegration', () => {
    it('writes JSON file with encrypted tokens', async () => {
      // Use a test encryption key
      process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
      mockReadFile.mockRejectedValue(new Error('not found'));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      const { saveIntegration } = await import('../../lib/social-providers');
      const details = { id: '1', name: 'Test', username: 'test', accessToken: 'tok', refreshToken: 'rtok' };
      await saveIntegration('x', details);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
      // Tokens should be encrypted (not plaintext)
      expect(written.x.accessToken).toMatch(/^enc:v1:/);
      expect(written.x.refreshToken).toMatch(/^enc:v1:/);
      // Non-sensitive fields preserved
      expect(written.x.id).toBe('1');
      expect(written.x.name).toBe('Test');
      delete process.env.TOKEN_ENCRYPTION_KEY;
    });
  });

  describe('loadIntegrations', () => {
    it('reads existing file and decrypts tokens', async () => {
      // Store with plaintext tokens (legacy format) — should pass through
      mockReadFile.mockResolvedValue(JSON.stringify({
        x: { id: '1', name: 'Test', username: 'test', accessToken: 'plaintext-tok' }
      }));
      process.env.NODE_ENV = 'development';
      const { loadIntegrations } = await import('../../lib/social-providers');
      const result = await loadIntegrations();
      expect(result.x.id).toBe('1');
      expect(result.x.accessToken).toBe('plaintext-tok');
    });

    it('file not found — returns {}', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      const { loadIntegrations } = await import('../../lib/social-providers');
      const result = await loadIntegrations();
      expect(result).toEqual({});
    });
  });
});
