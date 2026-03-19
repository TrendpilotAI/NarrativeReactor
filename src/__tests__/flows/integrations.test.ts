import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDefineFlow = vi.fn((config: any, handler: any) => handler);

vi.mock('../../genkit.config', () => ({
  ai: {
    defineFlow: mockDefineFlow,
  },
}));

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

const mockProviders: Record<string, any> = {};
const mockSaveIntegration = vi.fn();
const mockLoadIntegrations = vi.fn();

vi.mock('../../lib/social-providers', () => ({
  providers: mockProviders,
  saveIntegration: mockSaveIntegration,
  loadIntegrations: mockLoadIntegrations,
}));

const {
  getAuthUrlFlow,
  connectSocialAccountFlow,
  listIntegrationsFlow,
  postToSocialFlow,
  getPerformanceDataFlow,
  getMentionsFlow,
} = await import('../../flows/integrations');

describe('getAuthUrlFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset providers
    Object.keys(mockProviders).forEach(k => delete mockProviders[k]);
  });

  it('should return auth URL from provider', async () => {
    mockProviders['x'] = {
      generateAuthUrl: vi.fn().mockResolvedValue({
        url: 'https://twitter.com/oauth',
        codeVerifier: 'verifier123',
        state: 'state456',
      }),
    };

    const result = await getAuthUrlFlow({ provider: 'x' });

    expect(result.url).toBe('https://twitter.com/oauth');
    expect(result.codeVerifier).toBe('verifier123');
    expect(result.state).toBe('state456');
  });

  it('should throw for unknown provider', async () => {
    await expect(getAuthUrlFlow({ provider: 'fakebook' })).rejects.toThrow(
      'Provider fakebook not found'
    );
  });
});

describe('connectSocialAccountFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockProviders).forEach(k => delete mockProviders[k]);
  });

  it('should authenticate and save integration', async () => {
    mockProviders['x'] = {
      authenticate: vi.fn().mockResolvedValue({
        id: 'user123',
        name: 'Test User',
        username: 'testuser',
        accessToken: 'token',
        picture: 'https://pic.com/avatar.jpg',
      }),
    };

    const result = await connectSocialAccountFlow({
      provider: 'x',
      code: 'auth-code',
      codeVerifier: 'verifier',
    });

    expect(result.success).toBe(true);
    expect(result.account.username).toBe('testuser');
    expect(mockSaveIntegration).toHaveBeenCalledWith('x', expect.objectContaining({ id: 'user123' }));
  });

  it('should throw for unknown provider', async () => {
    await expect(
      connectSocialAccountFlow({ provider: 'unknown', code: 'c', codeVerifier: 'v' })
    ).rejects.toThrow('Provider unknown not found');
  });

  it('should propagate authentication errors', async () => {
    mockProviders['x'] = {
      authenticate: vi.fn().mockRejectedValue(new Error('Invalid code')),
    };

    await expect(
      connectSocialAccountFlow({ provider: 'x', code: 'bad', codeVerifier: 'v' })
    ).rejects.toThrow('Invalid code');
  });
});

describe('listIntegrationsFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockProviders).forEach(k => delete mockProviders[k]);
  });

  it('should list all providers with connection status', async () => {
    mockProviders['x'] = { name: 'X (Twitter)' };
    mockProviders['linkedin'] = { name: 'LinkedIn' };
    mockLoadIntegrations.mockResolvedValueOnce({
      x: { username: 'myuser', picture: 'https://pic.com/me.jpg' },
    });

    const result = await listIntegrationsFlow(undefined);

    expect(result).toHaveLength(2);
    const xResult = result.find((r: any) => r.provider === 'x');
    expect(xResult!.connected).toBe(true);
    expect(xResult!.username).toBe('myuser');

    const liResult = result.find((r: any) => r.provider === 'linkedin');
    expect(liResult!.connected).toBe(false);
    expect(liResult!.username).toBe('');
  });

  it('should return empty list when no providers', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({});

    const result = await listIntegrationsFlow(undefined);
    expect(result).toHaveLength(0);
  });
});

describe('postToSocialFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockProviders).forEach(k => delete mockProviders[k]);
  });

  it('should post content and return result', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({
      x: { accessToken: 'token123' },
    });
    mockProviders['x'] = {
      post: vi.fn().mockResolvedValue({
        postId: 'post-1',
        releaseURL: 'https://x.com/post/1',
        status: 'published',
      }),
    };

    const result = await postToSocialFlow({
      provider: 'x',
      message: 'Hello world!',
    });

    expect(result.success).toBe(true);
    expect(result.postId).toBe('post-1');
    expect(mockProviders['x'].post).toHaveBeenCalledWith('token123', 'Hello world!');
  });

  it('should throw when integration not found', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({});

    await expect(
      postToSocialFlow({ provider: 'x', message: 'test' })
    ).rejects.toThrow('Integration for x not found');
  });

  it('should propagate posting errors', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({
      x: { accessToken: 'token' },
    });
    mockProviders['x'] = {
      post: vi.fn().mockRejectedValue(new Error('Rate limited')),
    };

    await expect(
      postToSocialFlow({ provider: 'x', message: 'test' })
    ).rejects.toThrow('Rate limited');
  });
});

describe('getPerformanceDataFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockProviders).forEach(k => delete mockProviders[k]);
  });

  it('should return analytics data', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({
      x: { accessToken: 'token' },
    });
    mockProviders['x'] = {
      getAnalytics: vi.fn().mockResolvedValue([
        { label: 'Impressions', value: 5000, change: '+10%' },
        { label: 'Engagement', value: 250, change: '+5%' },
      ]),
    };

    const result = await getPerformanceDataFlow({ provider: 'x', days: 7 });

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Impressions');
    expect(mockProviders['x'].getAnalytics).toHaveBeenCalledWith('token', 7);
  });

  it('should throw when integration not found', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({});

    await expect(
      getPerformanceDataFlow({ provider: 'x', days: 7 })
    ).rejects.toThrow('Integration for x not found');
  });
});

describe('getMentionsFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockProviders).forEach(k => delete mockProviders[k]);
  });

  it('should return mentions data', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({
      x: { accessToken: 'token' },
    });
    mockProviders['x'] = {
      getMentions: vi.fn().mockResolvedValue([
        {
          id: 'm1',
          text: 'Love @signalstudio!',
          createdAt: '2026-02-17T00:00:00Z',
          author: { name: 'Fan', username: 'fan1', avatar: 'https://pic.com' },
        },
      ]),
    };

    const result = await getMentionsFlow({ provider: 'x' });

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Love @signalstudio!');
  });

  it('should throw when integration not found', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({});

    await expect(getMentionsFlow({ provider: 'x' })).rejects.toThrow(
      'Integration for x not found'
    );
  });

  it('should propagate getMentions errors', async () => {
    mockLoadIntegrations.mockResolvedValueOnce({
      x: { accessToken: 'token' },
    });
    mockProviders['x'] = {
      getMentions: vi.fn().mockRejectedValue(new Error('API down')),
    };

    await expect(getMentionsFlow({ provider: 'x' })).rejects.toThrow('API down');
  });
});
