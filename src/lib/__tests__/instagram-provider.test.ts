import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { providers } from '../social-providers';

const mockFetch = vi.fn();

describe('InstagramProvider', () => {
    const provider = providers.instagram;

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
        expect(provider.identifier).toBe('instagram');
        expect(provider.name).toBe('Instagram');
    });

    describe('generateAuthUrl', () => {
        it('generates a valid Facebook OAuth URL for Instagram scopes', async () => {
            const { url, codeVerifier, state } = await provider.generateAuthUrl();
            expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
            expect(url).toContain('client_id=test-fb-id');
            expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3010%2Fintegrations%2Fcallback%2Finstagram');
            expect(url).toContain('scope=instagram_basic%2Cinstagram_content_publish%2Cpages_show_list%2Cpages_read_engagement');
            expect(typeof codeVerifier).toBe('string');
            expect(url).toContain(`state=${state}`);
        });
    });

    describe('authenticate', () => {
        it('exchanges code for FB token and finds connected IG account', async () => {
            // 1. Token exchange mock
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'fb-user-token',
                    expires_in: 5184000,
                }),
            });

            // 2. Mock 'me/accounts' to get Facebook Pages
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: 'page-123',
                            name: 'Test Page',
                            access_token: 'fb-page-token',
                        }
                    ]
                }),
            });

            // 3. Mock page info to get instagram_business_account
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'page-123',
                    instagram_business_account: {
                        id: 'ig-account-456'
                    }
                }),
            });

            // 4. Mock IG account info
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'ig-account-456',
                    username: 'test_ig_user',
                    name: 'Test IG User',
                    profile_picture_url: 'https://example.com/ig-pic.jpg',
                }),
            });

            const result = await provider.authenticate({ code: 'test-code', codeVerifier: 'dummy' });

            expect(mockFetch).toHaveBeenCalledTimes(4);

            expect(result).toEqual({
                id: 'ig-account-456', // use the IG account ID as the principal ID
                name: 'Test IG User',
                username: 'test_ig_user',
                accessToken: 'ig-account-456:fb-page-token', // composite token: IG account ID + page token
                expiresIn: 5184000,
                picture: 'https://example.com/ig-pic.jpg',
            });
        });

        it('throws an error if no IG business account is connected', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token' }),
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [{ id: 'page-123', access_token: 'page-token' }] }),
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'page-123' }), // no instagram_business_account
            });

            await expect(provider.authenticate({ code: 'test-code', codeVerifier: '' }))
                .rejects.toThrow('No connected Instagram Business account found');
        });
    });

    describe('post', () => {
        it('throws an error when no mediaUrl is provided (Instagram requires media)', async () => {
            const compositeToken = 'ig-account-456:fb-page-token';

            await expect(provider.post(compositeToken, 'Hello Instagram!'))
                .rejects.toThrow('Instagram requires a media URL (image or video) to create a post. Text-only posts are not supported.');
        });

        it('creates a media container and publishes it with a provided mediaUrl', async () => {
            // 1. Create container
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'container-789' }),
            });

            // 2. Publish container
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'media-000' }),
            });

            const compositeToken = 'ig-account-456:fb-page-token';
            const mediaUrl = 'https://cdn.example.com/my-photo.jpg';

            const result = await provider.post(compositeToken, 'Hello Instagram!', mediaUrl);

            expect(mockFetch).toHaveBeenCalledTimes(2);

            // Container call
            const containerCall = mockFetch.mock.calls[0];
            expect(containerCall[0]).toContain('https://graph.facebook.com/v18.0/ig-account-456/media');
            expect(containerCall[1].method).toBe('POST');
            // Check body has caption & the real image_url (not a placeholder)
            const bodyStr = containerCall[1].body.toString();
            expect(bodyStr).toContain('caption=Hello+Instagram');
            expect(bodyStr).toContain('image_url=' + encodeURIComponent(mediaUrl));

            // Publish call
            const publishCall = mockFetch.mock.calls[1];
            expect(publishCall[0]).toContain('https://graph.facebook.com/v18.0/ig-account-456/media_publish');
            expect(publishCall[1].method).toBe('POST');
            expect(publishCall[1].body.toString()).toContain('creation_id=container-789');

            expect(result).toEqual({
                postId: 'media-000',
                releaseURL: 'https://instagram.com/p/media-000',
                status: 'posted',
            });
        });
    });

    describe('getAnalytics', () => {
        it('returns placeholder metrics as full analytics reqs permissions', async () => {
            const result = await provider.getAnalytics('test-access-token', 7);
            expect(result).toEqual([
                { label: 'Followers', value: 0, change: '+0%' },
                { label: 'Engagement', value: 0, change: '+0%' },
            ]);
        });
    });

    describe('getMentions', () => {
        it('returns empty array as mentions api reqs special access', async () => {
            const result = await provider.getMentions('test-access-token');
            expect(result).toEqual([]);
        });
    });
});
