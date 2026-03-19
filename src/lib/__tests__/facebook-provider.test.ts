import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { providers } from '../social-providers';

const mockFetch = vi.fn();

describe('FacebookProvider', () => {
    const provider = providers.facebook;

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        process.env.FACEBOOK_CLIENT_ID = 'test-fb-id';
        process.env.FACEBOOK_CLIENT_SECRET = 'test-fb-secret';
        process.env.FRONTEND_URL = 'http://localhost:3010';
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('has correct identifier and name', () => {
        expect(provider.identifier).toBe('facebook');
        expect(provider.name).toBe('Facebook');
    });

    describe('generateAuthUrl', () => {
        it('generates a valid Facebook OAuth URL', async () => {
            const { url, codeVerifier, state } = await provider.generateAuthUrl();
            expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
            expect(url).toContain('client_id=test-fb-id');
            expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3010%2Fintegrations%2Fcallback%2Ffacebook');
            expect(url).toContain('scope=pages_manage_posts%2Cpages_read_engagement%2Cpages_show_list');
            expect(typeof codeVerifier).toBe('string');
            expect(url).toContain(`state=${state}`);
        });
    });

    describe('authenticate', () => {
        it('exchanges code for user token and returns page info', async () => {
            // 1. Token exchange
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'fb-user-token',
                    expires_in: 5184000,
                }),
            });

            // 2. Fetch pages the user can manage
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: 'page-123',
                            name: 'Test Setup Page',
                            access_token: 'fb-page-token',
                        }
                    ]
                }),
            });

            // 3. Fetch page profile picture
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    picture: {
                        data: {
                            url: 'https://example.com/fb-page.jpg',
                        },
                    },
                }),
            });

            const result = await provider.authenticate({ code: 'test-code', codeVerifier: 'dummy' });

            expect(mockFetch).toHaveBeenCalledTimes(3);

            expect(result).toEqual({
                id: 'page-123',
                name: 'Test Setup Page',
                username: 'page-123', // Facebook pages don't reliably return a global nice username in basic queries, ID is safe
                accessToken: 'fb-page-token',
                expiresIn: 5184000,
                picture: 'https://example.com/fb-page.jpg',
            });
        });

        it('throws an error if user manages no pages', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'fb-user-token' }),
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] }), // empty pages list
            });

            await expect(provider.authenticate({ code: 'test-code', codeVerifier: '' }))
                .rejects.toThrow('No Facebook Pages found for this user.');
        });
    });

    describe('post', () => {
        it('publishes a message to the page feed', async () => {
            // We'll assume the system sets accessToken to `pageId:pageToken` to avoid extra queries,
            // or we just use pageToken and fetch /me to get the page ID.
            // Let's assume we do the `pageId:pageToken` composite pattern here too for simplicity.

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'post-999' }),
            });

            const result = await provider.post('page-123:fb-page-token', 'Hello Facebook!');

            expect(mockFetch).toHaveBeenCalledTimes(1);

            const call = mockFetch.mock.calls[0];
            expect(call[0]).toBe('https://graph.facebook.com/v18.0/page-123/feed');
            expect(call[1].method).toBe('POST');

            const reqBody = new URLSearchParams(call[1].body);
            expect(reqBody.get('message')).toBe('Hello Facebook!');
            expect(reqBody.get('access_token')).toBe('fb-page-token');

            expect(result).toEqual({
                postId: 'post-999',
                releaseURL: 'https://facebook.com/post-999', // Approximation
                status: 'posted',
            });
        });
    });

    describe('getAnalytics', () => {
        it('returns placeholder metrics', async () => {
            const result = await provider.getAnalytics('test-access-token', 7);
            expect(result).toEqual([
                { label: 'Followers', value: 0, change: '+0%' },
                { label: 'Engagement', value: 0, change: '+0%' },
                { label: 'Reach', value: 0, change: '+0%' },
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
