/**
 * Integration tests for the integrations flow (social media connections).
 * 
 * Tests getAuthUrl, connectSocialAccount, listIntegrations, postToSocial,
 * getPerformanceData, and getMentions flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockGenerateAuthUrl, mockAuthenticate, mockPost, mockGetAnalytics, mockGetMentions, mockSaveIntegration, mockLoadIntegrations } = vi.hoisted(() => ({
    mockGenerateAuthUrl: vi.fn(),
    mockAuthenticate: vi.fn(),
    mockPost: vi.fn(),
    mockGetAnalytics: vi.fn(),
    mockGetMentions: vi.fn(),
    mockSaveIntegration: vi.fn(),
    mockLoadIntegrations: vi.fn(),
}));

vi.mock('../../genkit.config', () => ({
    ai: {
        defineFlow: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            const flow = async (...args: any[]) => handler(...args);
            flow._config = _config;
            return flow;
        }),
    },
}));

vi.mock('../../lib/social-providers', () => ({
    providers: {
        x: {
            identifier: 'x',
            name: 'X',
            generateAuthUrl: mockGenerateAuthUrl,
            authenticate: mockAuthenticate,
            post: mockPost,
            getAnalytics: mockGetAnalytics,
            getMentions: mockGetMentions,
        },
        linkedin: {
            identifier: 'linkedin',
            name: 'LinkedIn',
            generateAuthUrl: vi.fn().mockRejectedValue(new Error('Not implemented')),
            authenticate: vi.fn(),
            post: vi.fn(),
            getAnalytics: vi.fn().mockResolvedValue([]),
            getMentions: vi.fn().mockResolvedValue([]),
        },
    },
    saveIntegration: mockSaveIntegration,
    loadIntegrations: mockLoadIntegrations,
}));

import {
    getAuthUrlFlow,
    connectSocialAccountFlow,
    listIntegrationsFlow,
    postToSocialFlow,
    getPerformanceDataFlow,
    getMentionsFlow,
} from '../integrations';

describe('Integrations Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAuthUrlFlow', () => {
        it('returns auth URL for a valid provider', async () => {
            mockGenerateAuthUrl.mockResolvedValueOnce({
                url: 'https://api.twitter.com/oauth/authenticate?token=abc',
                codeVerifier: 'oauth_abc:secret_xyz',
                state: 'oauth_abc',
            });

            const result = await getAuthUrlFlow({ provider: 'x' });
            expect(result.url).toContain('twitter.com');
            expect(result.codeVerifier).toBeDefined();
        });

        it('throws for unknown provider', async () => {
            await expect(getAuthUrlFlow({ provider: 'tiktok' })).rejects.toThrow('not found');
        });
    });

    describe('connectSocialAccountFlow', () => {
        it('authenticates and saves integration', async () => {
            mockAuthenticate.mockResolvedValueOnce({
                id: 'user-123',
                name: 'Test User',
                username: 'testuser',
                accessToken: 'token:secret',
                picture: 'https://img.com/avatar.jpg',
            });
            mockSaveIntegration.mockResolvedValueOnce(undefined);

            const result = await connectSocialAccountFlow({
                provider: 'x',
                code: 'oauth_code',
                codeVerifier: 'oauth_abc:secret_xyz',
            });

            expect(result.success).toBe(true);
            expect(result.account.username).toBe('testuser');
            expect(mockSaveIntegration).toHaveBeenCalledWith('x', expect.objectContaining({ id: 'user-123' }));
        });
    });

    describe('listIntegrationsFlow', () => {
        it('lists all providers with connection status', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({
                x: { username: 'testuser', picture: 'https://img.com/avatar.jpg' },
            });

            const result = await listIntegrationsFlow(undefined);

            expect(result).toHaveLength(2); // x and linkedin in our mock
            const xInt = result.find((i: any) => i.provider === 'x');
            expect(xInt!.connected).toBe(true);
            expect(xInt!.username).toBe('testuser');

            const liInt = result.find((i: any) => i.provider === 'linkedin');
            expect(liInt!.connected).toBe(false);
        });
    });

    describe('postToSocialFlow', () => {
        it('posts via the correct provider', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({
                x: { accessToken: 'token:secret' },
            });
            mockPost.mockResolvedValueOnce({
                postId: 'tweet-456',
                releaseURL: 'https://x.com/testuser/status/tweet-456',
                status: 'posted',
            });

            const result = await postToSocialFlow({ provider: 'x', message: 'Hello world!' });
            expect(result.success).toBe(true);
            expect(result.postId).toBe('tweet-456');
            expect(mockPost).toHaveBeenCalledWith('token:secret', 'Hello world!');
        });

        it('throws when integration not found', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({});
            await expect(postToSocialFlow({ provider: 'x', message: 'test' })).rejects.toThrow('not found');
        });
    });

    describe('getPerformanceDataFlow', () => {
        it('returns analytics data', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({
                x: { accessToken: 'token:secret' },
            });
            mockGetAnalytics.mockResolvedValueOnce([
                { label: 'Impressions', value: 5000, change: '+15%' },
                { label: 'Likes', value: 200, change: '+8%' },
            ]);

            const result = await getPerformanceDataFlow({ provider: 'x', days: 7 });
            expect(result).toHaveLength(2);
            expect(result[0].label).toBe('Impressions');
        });
    });

    describe('getMentionsFlow', () => {
        it('returns mentions list', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({
                x: { accessToken: 'token:secret' },
            });
            mockGetMentions.mockResolvedValueOnce([
                { id: 'm1', text: '@user mentioned you', createdAt: '2026-01-15', author: { name: 'Fan', username: 'fan1', avatar: '' } },
            ]);

            const result = await getMentionsFlow({ provider: 'x' });
            expect(result).toHaveLength(1);
            expect(result[0].text).toContain('mentioned');
        });
    });
});
