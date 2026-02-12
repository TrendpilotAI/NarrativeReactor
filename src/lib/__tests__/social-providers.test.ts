/**
 * Unit tests for src/lib/social-providers.ts
 * 
 * Tests the XProvider, StubProvider, and file-based integration storage.
 * Twitter API and filesystem are fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockGenerateAuthLink, mockLogin, mockMe, mockTweet, mockUserTimeline, mockUserMentionTimeline } = vi.hoisted(() => ({
    mockGenerateAuthLink: vi.fn(),
    mockLogin: vi.fn(),
    mockMe: vi.fn(),
    mockTweet: vi.fn(),
    mockUserTimeline: vi.fn(),
    mockUserMentionTimeline: vi.fn(),
}));

vi.mock('twitter-api-v2', () => ({
    TwitterApi: vi.fn().mockImplementation(() => ({
        generateAuthLink: mockGenerateAuthLink,
        login: mockLogin,
        v2: {
            me: mockMe,
            tweet: mockTweet,
            userTimeline: mockUserTimeline,
            userMentionTimeline: mockUserMentionTimeline,
        },
    })),
}));

// Mock fs/promises for integration storage
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args: any[]) => mockReadFile(...args),
        writeFile: (...args: any[]) => mockWriteFile(...args),
        mkdir: (...args: any[]) => mockMkdir(...args),
    },
    readFile: (...args: any[]) => mockReadFile(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
    mkdir: (...args: any[]) => mockMkdir(...args),
}));

import { XProvider, providers, saveIntegration, loadIntegrations } from '../social-providers';

describe('social-providers.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('providers registry', () => {
        it('registers all 5 providers', () => {
            expect(Object.keys(providers)).toHaveLength(5);
            expect(providers.x).toBeDefined();
            expect(providers.linkedin).toBeDefined();
            expect(providers.instagram).toBeDefined();
            expect(providers.threads).toBeDefined();
            expect(providers.facebook).toBeDefined();
        });

        it('providers have correct identifiers', () => {
            expect(providers.x.identifier).toBe('x');
            expect(providers.linkedin.identifier).toBe('linkedin');
            expect(providers.threads.identifier).toBe('threads');
        });
    });

    describe('XProvider', () => {
        const xProvider = new XProvider();

        describe('generateAuthUrl()', () => {
            it('generates an auth URL with correct callback', async () => {
                mockGenerateAuthLink.mockResolvedValueOnce({
                    url: 'https://api.twitter.com/oauth/authenticate?oauth_token=abc',
                    oauth_token: 'oauth_abc',
                    oauth_token_secret: 'secret_xyz',
                });

                const result = await xProvider.generateAuthUrl();
                expect(result.url).toContain('twitter.com');
                expect(result.codeVerifier).toBe('oauth_abc:secret_xyz');
                expect(result.state).toBe('oauth_abc');
            });
        });

        describe('post()', () => {
            it('posts a tweet and returns post info', async () => {
                mockTweet.mockResolvedValueOnce({
                    data: { id: 'tweet-123' },
                });
                mockMe.mockResolvedValueOnce({
                    data: { username: 'testuser' },
                });

                const result = await xProvider.post('token:secret', 'Hello from NarrativeReactor!');
                expect(result.postId).toBe('tweet-123');
                expect(result.releaseURL).toContain('testuser/status/tweet-123');
                expect(result.status).toBe('posted');
            });
        });
    });

    describe('StubProviders', () => {
        it('stub providers throw on generateAuthUrl', async () => {
            await expect(providers.linkedin.generateAuthUrl()).rejects.toThrow('OAuth not configured');
        });

        it('stub providers throw on authenticate', async () => {
            await expect(providers.instagram.authenticate({ code: 'test', codeVerifier: 'test' }))
                .rejects.toThrow('not implemented');
        });

        it('stub providers return empty analytics', async () => {
            const analytics = await providers.facebook.getAnalytics('token', 7);
            expect(analytics).toEqual([
                { label: 'Followers', value: 0, change: '+0%' },
                { label: 'Engagement', value: 0, change: '+0%' },
            ]);
        });

        it('stub providers return empty mentions', async () => {
            const mentions = await providers.threads.getMentions('token');
            expect(mentions).toEqual([]);
        });
    });

    describe('Integration Storage', () => {
        it('loadIntegrations returns empty object when file missing', async () => {
            mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
            const result = await loadIntegrations();
            expect(result).toEqual({});
        });

        it('loadIntegrations parses existing JSON', async () => {
            mockReadFile.mockResolvedValueOnce(JSON.stringify({
                x: { id: '123', username: 'testuser', accessToken: 'abc' },
            }));

            const result = await loadIntegrations();
            expect(result.x.username).toBe('testuser');
        });

        it('saveIntegration creates directory and writes JSON', async () => {
            mockReadFile.mockResolvedValueOnce('{}');
            mockMkdir.mockResolvedValueOnce(undefined);
            mockWriteFile.mockResolvedValueOnce(undefined);

            await saveIntegration('x', {
                id: '123',
                name: 'Test User',
                username: 'testuser',
                accessToken: 'abc-token',
            });

            expect(mockMkdir).toHaveBeenCalledOnce();
            expect(mockWriteFile).toHaveBeenCalledOnce();
            const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(writtenData.x.username).toBe('testuser');
        });
    });
});
