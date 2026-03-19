import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { providers } from '../social-providers';

const mockFetch = vi.fn();

describe('ThreadsProvider', () => {
    const provider = providers.threads;

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        process.env.THREADS_CLIENT_ID = 'test-threads-id';
        process.env.THREADS_CLIENT_SECRET = 'test-threads-secret';
        process.env.FRONTEND_URL = 'http://localhost:3010';
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('has correct identifier and name', () => {
        expect(provider.identifier).toBe('threads');
        expect(provider.name).toBe('Threads');
    });

    describe('generateAuthUrl', () => {
        it('generates a valid Threads OAuth URL', async () => {
            const { url, codeVerifier, state } = await provider.generateAuthUrl();
            expect(url).toContain('https://threads.net/oauth/authorize');
            expect(url).toContain('client_id=test-threads-id');
            expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3010%2Fintegrations%2Fcallback%2Fthreads');
            expect(url).toContain('scope=threads_basic%2Cthreads_content_publish');
            expect(typeof codeVerifier).toBe('string');
            expect(url).toContain(`state=${state}`);
        });
    });

    describe('authenticate', () => {
        it('exchanges code for user token and fetches profile', async () => {
            // 1. Token exchange
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'threads-token',
                    user_id: 'thread-user-123',
                }),
            });

            // 2. Fetch User Profile
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'thread-user-123',
                    username: 'test_thread_user',
                    name: 'Test Setup Thread',
                    threads_profile_picture_url: 'https://example.com/threads-pic.jpg',
                }),
            });

            const result = await provider.authenticate({ code: 'test-code', codeVerifier: 'dummy' });

            expect(mockFetch).toHaveBeenCalledTimes(2);

            expect(result).toEqual({
                id: 'thread-user-123',
                name: 'Test Setup Thread',
                username: 'test_thread_user',
                accessToken: 'threads-token',
                expiresIn: 5184000, // Standard 60 days short-lived assumption, or whatever we set if not returned
                picture: 'https://example.com/threads-pic.jpg',
            });
        });

        it('throws an error if token exchange fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Bad Request'
            });

            await expect(provider.authenticate({ code: 'test-code', codeVerifier: '' }))
                .rejects.toThrow('Failed to authenticate with Threads: Bad Request');
        });
    });

    describe('post', () => {
        it('creates a media container and publishes it', async () => {
            // 1. Create Text Container
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'container-111' }),
            });

            // 2. Publish Container
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'post-222' }),
            });

            const result = await provider.post('threads-token', 'Hello Threads!');

            expect(mockFetch).toHaveBeenCalledTimes(2);

            const containerCall = mockFetch.mock.calls[0];
            expect(containerCall[0]).toContain('https://graph.threads.net/v1.0/me/threads');
            expect(containerCall[1].method).toBe('POST');

            const reqBody = new URLSearchParams(containerCall[1].body);
            expect(reqBody.get('media_type')).toBe('TEXT');
            expect(reqBody.get('text')).toBe('Hello Threads!');
            expect(reqBody.get('access_token')).toBe('threads-token');

            const publishCall = mockFetch.mock.calls[1];
            expect(publishCall[0]).toContain('https://graph.threads.net/v1.0/me/threads_publish');
            expect(publishCall[1].method).toBe('POST');
            const pubBody = new URLSearchParams(publishCall[1].body);
            expect(pubBody.get('creation_id')).toBe('container-111');
            expect(pubBody.get('access_token')).toBe('threads-token');

            expect(result).toEqual({
                postId: 'post-222',
                releaseURL: 'https://threads.net/post/post-222', // Approximation
                status: 'posted',
            });
        });
    });

    describe('getAnalytics', () => {
        it('returns placeholder metrics', async () => {
            const result = await provider.getAnalytics('test-access-token', 7);
            expect(result).toEqual([
                { label: 'Followers', value: 0, change: '+0%' },
                { label: 'Replies', value: 0, change: '+0%' },
                { label: 'Likes', value: 0, change: '+0%' },
            ]);
        });
    });

    describe('getMentions', () => {
        it('returns empty array', async () => {
            const result = await provider.getMentions('test-access-token');
            expect(result).toEqual([]);
        });
    });
});
