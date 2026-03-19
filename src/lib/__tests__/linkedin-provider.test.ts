import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { providers } from '../social-providers';

const mockFetch = vi.fn();

describe('LinkedInProvider', () => {
    const provider = providers.linkedin;

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
        process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
        process.env.FRONTEND_URL = 'http://localhost:3010';
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('has correct identifier and name', () => {
        expect(provider.identifier).toBe('linkedin');
        expect(provider.name).toBe('LinkedIn');
    });

    describe('generateAuthUrl', () => {
        it('generates a valid OAuth 2 authorization URL', async () => {
            const { url, codeVerifier, state } = await provider.generateAuthUrl();
            expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization');
            expect(url).toContain('client_id=test-client-id');
            expect(url).toContain('response_type=code');
            expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3010%2Fintegrations%2Fcallback%2Flinkedin');
            expect(url).toContain('scope=w_member_social%20r_liteprofile%20r_emailaddress');
            // State should be generated
            expect(url).toContain(`state=${state}`);
            // codeVerifier isn't strictly used for LinkedIn classic OAuth, but should be empty or a dummy string
            expect(typeof codeVerifier).toBe('string');
        });
    });

    describe('authenticate', () => {
        it('exchanges code for access token and fetches user profile', async () => {
            // Mock access token response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'test-access-token',
                    expires_in: 5184000,
                }),
            });

            // Mock user info response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    sub: 'urn:li:person:12345',
                    name: 'Test Setup User',
                    given_name: 'Test',
                    family_name: 'User',
                    picture: 'https://example.com/pic.jpg',
                }),
            });

            const result = await provider.authenticate({ code: 'test-code', codeVerifier: 'dummy' });

            expect(mockFetch).toHaveBeenCalledTimes(2);

            // Should call access token endpoint with correct params
            const tokenCall = mockFetch.mock.calls[0];
            expect(tokenCall[0]).toBe('https://www.linkedin.com/oauth/v2/accessToken');
            expect(tokenCall[1].method).toBe('POST');
            expect(tokenCall[1].body.toString()).toContain('grant_type=authorization_code');
            expect(tokenCall[1].body.toString()).toContain('code=test-code');

            // Should call user info endpoint
            const meCall = mockFetch.mock.calls[1];
            expect(meCall[0]).toBe('https://api.linkedin.com/v2/userinfo');
            expect(meCall[1].headers.Authorization).toBe('Bearer test-access-token');

            expect(result).toEqual({
                id: 'urn:li:person:12345',
                name: 'Test User',
                username: 'urn:li:person:12345', // LinkedIn doesn't have usernames in the same way, we use URN or vanityname if available
                accessToken: 'test-access-token',
                expiresIn: 5184000,
                picture: 'https://example.com/pic.jpg',
            });
        });

        it('throws an error if token exchange fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Bad Request',
                json: async () => ({ error: 'invalid_request' })
            });

            await expect(provider.authenticate({ code: 'test-code', codeVerifier: '' }))
                .rejects.toThrow('Failed to authenticate with LinkedIn: Bad Request');
        });
    });

    describe('post', () => {
        it('posts a text message successfully', async () => {
            // we will need the user URN to post if we don't store it, or if accessToken encodes it. 
            // In our system, we might need to fetch the profile again or assume we have the ID to post
            // The ugcPosts endpoint requires author: 'urn:li:person:12345'
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ sub: 'urn:li:person:12345' }) // mock me response for the author URN
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers({
                    'x-restli-id': 'urn:li:share:987654321', // Returned in header
                }),
                json: async () => ({})
            });

            const result = await provider.post('test-access-token', 'Hello LinkedIn!');

            expect(mockFetch).toHaveBeenCalledTimes(2); // 1 for me, 1 for post

            const postCall = mockFetch.mock.calls[1];
            expect(postCall[0]).toBe('https://api.linkedin.com/v2/ugcPosts');
            expect(postCall[1].method).toBe('POST');
            expect(postCall[1].headers.Authorization).toBe('Bearer test-access-token');
            const body = JSON.parse(postCall[1].body);
            expect(body.author).toBe('urn:li:person:12345');
            expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe('Hello LinkedIn!');

            expect(result).toEqual({
                postId: 'urn:li:share:987654321',
                releaseURL: 'https://www.linkedin.com/feed/update/urn:li:share:987654321',
                status: 'posted',
            });
        });
    });

    describe('getAnalytics', () => {
        it('returns placeholder metrics as full analytics reqs permissions', async () => {
            const result = await provider.getAnalytics('test-access-token', 7);
            expect(result).toEqual([
                { label: 'Impressions', value: 0, change: '+0%' },
                { label: 'Engagement', value: 0, change: '+0%' },
                { label: 'Clicks', value: 0, change: '+0%' },
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
