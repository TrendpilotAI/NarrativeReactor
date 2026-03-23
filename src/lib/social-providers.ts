
import crypto from 'crypto';
import dayjs from 'dayjs';
import fs from 'fs/promises';
import path from 'path';
import { encryptToken, decryptToken } from './tokenEncryption';

export interface AuthTokenDetails {
    id: string;
    name: string;
    username: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    picture?: string;
}

export interface PostResponse {
    postId: string;
    releaseURL: string;
    status: string;
}

export interface SocialProvider {
    identifier: string;
    name: string;
    generateAuthUrl(): Promise<{ url: string; codeVerifier: string; state: string }>;
    authenticate(params: { code: string; codeVerifier: string }): Promise<AuthTokenDetails>;
    post(accessToken: string, message: string, mediaUrl?: string): Promise<PostResponse>;
    getAnalytics(accessToken: string, days: number): Promise<any>;
    getMentions(accessToken: string): Promise<any>;
}

function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export class XProvider implements SocialProvider {
    identifier = 'x';
    name = 'X';

    async generateAuthUrl() {
        const clientId = process.env.X_CLIENT_ID!;
        const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/x`;
        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: scopes.join(' '),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        return {
            url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
            codeVerifier,
            state,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }): Promise<AuthTokenDetails> {
        const { code, codeVerifier } = params;
        const clientId = process.env.X_CLIENT_ID!;
        const clientSecret = process.env.X_CLIENT_SECRET;
        const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/x`;

        const body = new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            client_id: clientId,
            redirect_uri: callbackUrl,
            code_verifier: codeVerifier,
        });

        const headers: Record<string, string> = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        // If confidential client, use Basic auth
        if (clientSecret) {
            headers['Authorization'] = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        }

        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers,
            body: body.toString(),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            throw new Error(`Twitter token exchange failed: ${err}`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresIn = tokenData.expires_in;

        // Fetch user info
        const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!meRes.ok) {
            throw new Error('Failed to fetch Twitter user info');
        }

        const meData = await meRes.json();

        return {
            id: meData.data.id,
            name: meData.data.name,
            username: meData.data.username,
            accessToken,
            refreshToken,
            expiresIn,
            picture: meData.data.profile_image_url,
        };
    }

    async post(accessToken: string, message: string): Promise<PostResponse> {
        const res = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: message }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Twitter post failed: ${err}`);
        }

        const data = await res.json();

        // Get username for URL
        const meRes = await fetch('https://api.twitter.com/2/users/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();

        return {
            postId: data.data.id,
            releaseURL: `https://x.com/${meData.data.username}/status/${data.data.id}`,
            status: 'posted',
        };
    }

    async getAnalytics(accessToken: string, days: number) {
        const since = dayjs().subtract(days, 'day').toISOString();

        const meRes = await fetch('https://api.twitter.com/2/users/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();

        const params = new URLSearchParams({
            'tweet.fields': 'public_metrics,created_at',
            start_time: since,
            max_results: '100',
        });

        const tweetsRes = await fetch(
            `https://api.twitter.com/2/users/${meData.data.id}/tweets?${params}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const tweetsData = await tweetsRes.json();

        const metrics = tweetsData.data?.reduce((acc: any, tweet: any) => {
            acc.impressions += tweet.public_metrics?.impression_count || 0;
            acc.likes += tweet.public_metrics?.like_count || 0;
            acc.retweets += tweet.public_metrics?.retweet_count || 0;
            acc.replies += tweet.public_metrics?.reply_count || 0;
            return acc;
        }, { impressions: 0, likes: 0, retweets: 0, replies: 0 }) || { impressions: 0, likes: 0, retweets: 0, replies: 0 };

        return [
            { label: 'Impressions', value: metrics.impressions, change: '+12%' },
            { label: 'Likes', value: metrics.likes, change: '+5%' },
            { label: 'Retweets', value: metrics.retweets, change: '+8%' },
            { label: 'Replies', value: metrics.replies, change: '+3%' },
        ];
    }

    async getMentions(accessToken: string) {
        const meRes = await fetch('https://api.twitter.com/2/users/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();

        const params = new URLSearchParams({
            'tweet.fields': 'created_at,author_id',
            expansions: 'author_id',
            'user.fields': 'name,username,profile_image_url',
            max_results: '10',
        });

        const mentionsRes = await fetch(
            `https://api.twitter.com/2/users/${meData.data.id}/mentions?${params}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const mentionsData = await mentionsRes.json();

        const users = mentionsData.includes?.users?.reduce((acc: Record<string, any>, user: any) => {
            acc[user.id] = user;
            return acc;
        }, {} as Record<string, any>) || {};

        return mentionsData.data?.map((tweet: any) => ({
            id: tweet.id,
            text: tweet.text,
            createdAt: tweet.created_at,
            author: {
                name: users[tweet.author_id]?.name || 'Unknown',
                username: users[tweet.author_id]?.username || 'unknown',
                avatar: users[tweet.author_id]?.profile_image_url || '',
            }
        })) || [];
    }
}

export class LinkedInProvider implements SocialProvider {
    identifier = 'linkedin';
    name = 'LinkedIn';

    async generateAuthUrl() {
        const clientId = process.env.LINKEDIN_CLIENT_ID!;
        const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/linkedin`;
        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = generateCodeVerifier();

        const scopes = ['openid', 'profile', 'w_member_social'];

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: scopes.join(' '),
            state,
        });

        return {
            url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
            codeVerifier,
            state,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }): Promise<AuthTokenDetails> {
        const { code } = params;
        const clientId = process.env.LINKEDIN_CLIENT_ID!;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
        const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/linkedin`;

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: callbackUrl,
        });

        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            throw new Error(`LinkedIn token exchange failed: ${err}`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // Fetch user info via OpenID userinfo
        const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!meRes.ok) {
            throw new Error('Failed to fetch LinkedIn user info');
        }

        const meData = await meRes.json();

        return {
            id: meData.sub,
            name: meData.name,
            username: meData.email || meData.sub,
            accessToken,
            expiresIn: tokenData.expires_in,
            picture: meData.picture,
        };
    }

    async post(accessToken: string, message: string): Promise<PostResponse> {
        // Get user URN
        const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        const authorUrn = `urn:li:person:${meData.sub}`;

        const postBody = {
            author: authorUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text: message },
                    shareMediaCategory: 'NONE',
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };

        const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(postBody),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`LinkedIn post failed: ${err}`);
        }

        const data = await res.json();
        const postId = data.id;

        return {
            postId,
            releaseURL: `https://www.linkedin.com/feed/update/${postId}`,
            status: 'posted',
        };
    }

    async getAnalytics(_accessToken: string, _days: number) {
        return [
            { label: 'Impressions', value: 0, change: '0%' },
            { label: 'Likes', value: 0, change: '0%' },
            { label: 'Shares', value: 0, change: '0%' },
            { label: 'Comments', value: 0, change: '0%' },
        ];
    }

    async getMentions(_accessToken: string) {
        return [];
    }
}

// Integration Store (Simple File-based for Phase 1)
const INTEGRATIONS_PATH = path.join(process.cwd(), 'data', 'integrations.json');

/**
 * Save an integration with encrypted tokens at rest.
 * Access tokens and refresh tokens are encrypted via AES-256-GCM before writing to disk.
 */
export async function saveIntegration(provider: string, details: AuthTokenDetails) {
    const integrations = await loadIntegrationsRaw();
    // Encrypt sensitive tokens before persisting
    const encrypted: AuthTokenDetails = {
        ...details,
        accessToken: encryptToken(details.accessToken),
        refreshToken: details.refreshToken ? encryptToken(details.refreshToken) : undefined,
    };
    integrations[provider] = encrypted;
    await fs.mkdir(path.dirname(INTEGRATIONS_PATH), { recursive: true });
    await fs.writeFile(INTEGRATIONS_PATH, JSON.stringify(integrations, null, 2));
}

/**
 * Load integrations with tokens decrypted for use.
 * Handles both encrypted and legacy plaintext tokens transparently.
 */
export async function loadIntegrations(): Promise<Record<string, AuthTokenDetails>> {
    const raw = await loadIntegrationsRaw();
    // Decrypt tokens for use
    const decrypted: Record<string, AuthTokenDetails> = {};
    for (const [provider, details] of Object.entries(raw) as [string, AuthTokenDetails][]) {
        decrypted[provider] = {
            ...details,
            accessToken: decryptToken(details.accessToken),
            refreshToken: details.refreshToken ? decryptToken(details.refreshToken) : undefined,
        };
    }
    return decrypted;
}

/** Load raw integrations from disk (tokens may be encrypted). */
async function loadIntegrationsRaw(): Promise<Record<string, AuthTokenDetails>> {
    try {
        const data = await fs.readFile(INTEGRATIONS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

// Stub provider base class for platforms not yet fully implemented
class StubProvider implements SocialProvider {
    identifier: string;
    name: string;

    constructor(identifier: string, name: string) {
        this.identifier = identifier;
        this.name = name;
    }

    async generateAuthUrl(): Promise<{ url: string; codeVerifier: string; state: string }> {
        // In a real implementation, this would generate OAuth URLs for each platform
        // For now, return a placeholder indicating the platform needs configuration
        throw new Error(`${this.name} OAuth not configured. Add ${this.identifier.toUpperCase()}_CLIENT_ID and ${this.identifier.toUpperCase()}_CLIENT_SECRET to your environment variables.`);
    }

    async authenticate(params: { code: string; codeVerifier: string }): Promise<AuthTokenDetails> {
        throw new Error(`${this.name} authentication not implemented yet.`);
    }

    async post(accessToken: string, message: string, mediaUrl?: string): Promise<PostResponse> {
        throw new Error(`${this.name} posting not implemented yet.`);
    }

    async getAnalytics(accessToken: string, days: number) {
        return [
            { label: 'Followers', value: 0, change: '+0%' },
            { label: 'Engagement', value: 0, change: '+0%' },
        ];
    }

    async getMentions(accessToken: string) {
        return [];
    }
}

// LinkedIn Provider implementation
class LinkedInProvider implements SocialProvider {
    identifier = 'linkedin';
    name = 'LinkedIn';

    async generateAuthUrl() {
        if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to your environment variables.`);
        }

        const state = Math.random().toString(36).substring(7);
        const redirectUri = encodeURIComponent(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/linkedin`);
        const scope = encodeURIComponent('w_member_social r_liteprofile r_emailaddress');

        const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;

        return {
            url,
            codeVerifier: '', // Not used for classic LinkedIn flow
            state,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }) {
        if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured.`);
        }

        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/linkedin`;

        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: params.code,
                client_id: process.env.LINKEDIN_CLIENT_ID,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET,
                redirect_uri: redirectUri,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            throw new Error(`Failed to authenticate with LinkedIn: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const meResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!meResponse.ok) {
            throw new Error(`Failed to fetch LinkedIn profile: ${meResponse.statusText}`);
        }

        const meData = await meResponse.json();

        return {
            id: meData.sub,
            name: `${meData.given_name || ''} ${meData.family_name || ''}`.trim(),
            username: meData.sub,
            accessToken,
            expiresIn: tokenData.expires_in,
            picture: meData.picture,
        };
    }

    async post(accessToken: string, message: string): Promise<PostResponse> {
        const meResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!meResponse.ok) {
            throw new Error(`Failed to fetch profile before posting: ${meResponse.statusText}`);
        }

        const meData = await meResponse.json();
        const urn = `urn:li:person:${meData.sub}`;

        const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify({
                author: urn,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: message,
                        },
                        shareMediaCategory: 'NONE',
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            }),
        });

        if (!postResponse.ok) {
            const errBody = await postResponse.text();
            throw new Error(`Failed to post to LinkedIn: ${postResponse.statusText} - ${errBody}`);
        }

        const postId = postResponse.headers.get('x-restli-id') || 'unknown';

        return {
            postId,
            releaseURL: `https://www.linkedin.com/feed/update/${postId}`,
            status: 'posted',
        };
    }

    async getAnalytics(accessToken: string, days: number) {
        return [
            { label: 'Impressions', value: 0, change: '+0%' },
            { label: 'Engagement', value: 0, change: '+0%' },
            { label: 'Clicks', value: 0, change: '+0%' },
        ];
    }

    async getMentions(accessToken: string) {
        return [];
    }
}

// Instagram Provider implementation
class InstagramProvider implements SocialProvider {
    identifier = 'instagram';
    name = 'Instagram';

    async generateAuthUrl() {
        if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured. Add INSTAGRAM_CLIENT_ID (or FACEBOOK_CLIENT_ID) and INSTAGRAM_CLIENT_SECRET (or FACEBOOK_CLIENT_SECRET) to your environment variables.`);
        }

        const state = Math.random().toString(36).substring(7);
        const redirectUri = encodeURIComponent(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/instagram`);
        const scope = encodeURIComponent('instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement');

        const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;

        return {
            url,
            codeVerifier: '',
            state,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }) {
        if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured.`);
        }

        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/instagram`;

        // 1. Exchange code for user token
        const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&code=${params.code}`);

        if (!tokenResponse.ok) {
            throw new Error(`Failed to authenticate with Facebook: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        const userAccessToken = tokenData.access_token;

        // 2. Fetch pages the user can manage
        const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`);
        if (!pagesResponse.ok) throw new Error('Failed to fetch Facebook pages');

        const pagesData = await pagesResponse.json();

        // 3. Find the connected Instagram account
        let igAccountId = null;
        let pageAccessToken = null;

        for (const page of pagesData.data || []) {
            const igResponse = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
            if (igResponse.ok) {
                const igData = await igResponse.json();
                if (igData.instagram_business_account) {
                    igAccountId = igData.instagram_business_account.id;
                    pageAccessToken = page.access_token;
                    break;
                }
            }
        }

        if (!igAccountId) {
            throw new Error('No connected Instagram Business account found on your Facebook Pages.');
        }

        // 4. Fetch Instagram account details
        const meResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,name,profile_picture_url&access_token=${pageAccessToken}`);
        if (!meResponse.ok) throw new Error('Failed to fetch Instagram profile details');

        const meData = await meResponse.json();

        return {
            id: igAccountId,
            name: meData.name || meData.username,
            username: meData.username,
            accessToken: `${igAccountId}:${pageAccessToken}`, // Composite token: IG account ID + page token for use in post()
            expiresIn: tokenData.expires_in,
            picture: meData.profile_picture_url,
        };
    }

    async post(accessTokenOrComposite: string, message: string, mediaUrl?: string): Promise<PostResponse> {
        // Instagram API requires media (image or video) for feed posts.
        // A mediaUrl must be provided; text-only posts are not supported by Instagram's API.
        if (!mediaUrl) {
            throw new Error('Instagram requires a media URL (image or video) to create a post. Text-only posts are not supported.');
        }

        // Parse composite token format: "igAccountId:pageAccessToken"
        // The authenticate() method stores tokens in this format so post() has
        // both the IG account ID and the page access token needed for API calls.
        let igId = '';
        let token = accessTokenOrComposite;
        if (accessTokenOrComposite.includes(':')) {
            const parts = accessTokenOrComposite.split(':');
            igId = parts[0];
            token = parts.slice(1).join(':'); // Rejoin in case token itself contains colons
        } else {
            // fallback: try to find it again using the token as a user access token
            const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${token}`);
            if (pagesResponse.ok) {
                const pagesData = await pagesResponse.json();
                for (const page of pagesData.data || []) {
                    const igResponse = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
                    if (igResponse.ok) {
                        const igData = await igResponse.json();
                        if (igData.instagram_business_account) {
                            igId = igData.instagram_business_account.id;
                            token = page.access_token;
                            break;
                        }
                    }
                }
            }
        }

        if (!igId) throw new Error('Could not determine Instagram account ID for posting.');

        // 1. Create Media Container
        const createContainerUrl = `https://graph.facebook.com/v18.0/${igId}/media`;
        const containerBody = new URLSearchParams({
            image_url: mediaUrl,
            caption: message,
            access_token: token,
        });

        const containerResponse = await fetch(createContainerUrl, {
            method: 'POST',
            body: containerBody,
        });

        if (!containerResponse.ok) {
            const err = await containerResponse.text();
            throw new Error(`Failed to create Instagram media container: ${err}`);
        }

        const containerData = await containerResponse.json();
        const creationId = containerData.id;

        // 2. Publish the container
        const publishUrl = `https://graph.facebook.com/v18.0/${igId}/media_publish`;
        const publishBody = new URLSearchParams({
            creation_id: creationId,
            access_token: token,
        });

        const publishResponse = await fetch(publishUrl, {
            method: 'POST',
            body: publishBody,
        });

        if (!publishResponse.ok) {
            const err = await publishResponse.text();
            throw new Error(`Failed to publish Instagram media: ${err}`);
        }

        const publishData = await publishResponse.json();

        return {
            postId: publishData.id,
            releaseURL: `https://instagram.com/p/${publishData.id}`, // pseudo shortcode fallback
            status: 'posted',
        };
    }

    async getAnalytics(accessToken: string, days: number) {
        return [
            { label: 'Followers', value: 0, change: '+0%' },
            { label: 'Engagement', value: 0, change: '+0%' },
        ];
    }

    async getMentions(accessToken: string) {
        return [];
    }
}

// Threads Provider implementation
class ThreadsProvider implements SocialProvider {
    identifier = 'threads';
    name = 'Threads';

    async generateAuthUrl() {
        if (!process.env.THREADS_CLIENT_ID || !process.env.THREADS_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured. Add THREADS_CLIENT_ID and THREADS_CLIENT_SECRET to your environment variables.`);
        }

        const state = Math.random().toString(36).substring(7);
        const redirectUri = encodeURIComponent(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/threads`);
        const scope = encodeURIComponent('threads_basic,threads_content_publish');

        const url = `https://threads.net/oauth/authorize?client_id=${process.env.THREADS_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${state}`;

        return {
            url,
            codeVerifier: '',
            state,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }) {
        if (!process.env.THREADS_CLIENT_ID || !process.env.THREADS_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured.`);
        }

        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/threads`;

        const tokenResponse = await fetch(`https://graph.threads.net/oauth/access_token`, {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.THREADS_CLIENT_ID,
                client_secret: process.env.THREADS_CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code: params.code,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error(`Failed to authenticate with Threads: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const userId = tokenData.user_id;

        const meResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${accessToken}`);

        if (!meResponse.ok) {
            throw new Error(`Failed to fetch Threads profile: ${meResponse.statusText}`);
        }

        const meData = await meResponse.json();

        return {
            id: userId,
            name: meData.name || meData.username,
            username: meData.username,
            accessToken: accessToken,
            expiresIn: 5184000, // typically short lived 60 mins -> long lived 60 days. Just hardcoding standard long-lived assumption for mock
            picture: meData.threads_profile_picture_url,
        };
    }

    async post(accessToken: string, message: string): Promise<PostResponse> {
        // 1. Create Media Container (TEXT)
        const createContainerUrl = `https://graph.threads.net/v1.0/me/threads`;
        const containerBody = new URLSearchParams({
            media_type: 'TEXT',
            text: message,
            access_token: accessToken,
        });

        const containerResponse = await fetch(createContainerUrl, {
            method: 'POST',
            body: containerBody,
        });

        if (!containerResponse.ok) {
            const err = await containerResponse.text();
            throw new Error(`Failed to create Threads media container: ${err}`);
        }

        const containerData = await containerResponse.json();
        const creationId = containerData.id;

        // 2. Publish the container
        const publishUrl = `https://graph.threads.net/v1.0/me/threads_publish`;
        const publishBody = new URLSearchParams({
            creation_id: creationId,
            access_token: accessToken,
        });

        const publishResponse = await fetch(publishUrl, {
            method: 'POST',
            body: publishBody,
        });

        if (!publishResponse.ok) {
            const err = await publishResponse.text();
            throw new Error(`Failed to publish Threads media: ${err}`);
        }

        const publishData = await publishResponse.json();

        return {
            postId: publishData.id,
            releaseURL: `https://threads.net/post/${publishData.id}`,
            status: 'posted',
        };
    }

    async getAnalytics(accessToken: string, days: number) {
        return [
            { label: 'Followers', value: 0, change: '+0%' },
            { label: 'Replies', value: 0, change: '+0%' },
            { label: 'Likes', value: 0, change: '+0%' },
        ];
    }

    async getMentions(accessToken: string) {
        return [];
    }
}

// Facebook Provider implementation
class FacebookProvider implements SocialProvider {
    identifier = 'facebook';
    name = 'Facebook';

    async generateAuthUrl() {
        if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured. Add FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET to your environment variables.`);
        }

        const state = Math.random().toString(36).substring(7);
        const redirectUri = encodeURIComponent(`${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/facebook`);
        const scope = encodeURIComponent('pages_manage_posts,pages_read_engagement,pages_show_list');

        const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;

        return {
            url,
            codeVerifier: '',
            state,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }) {
        if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
            throw new Error(`${this.name} OAuth not configured.`);
        }

        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/facebook`;

        // 1. Exchange code for user token
        const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&code=${params.code}`);

        if (!tokenResponse.ok) {
            throw new Error(`Failed to authenticate with Facebook: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        const userAccessToken = tokenData.access_token;

        // 2. Fetch pages the user can manage
        const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`);
        if (!pagesResponse.ok) throw new Error('Failed to fetch Facebook pages');

        const pagesData = await pagesResponse.json();

        if (!pagesData.data || pagesData.data.length === 0) {
            throw new Error('No Facebook Pages found for this user.');
        }

        const primaryPage = pagesData.data[0];

        // 3. Fetch Page details (e.g. picture)
        const picResponse = await fetch(`https://graph.facebook.com/v18.0/${primaryPage.id}?fields=picture&access_token=${primaryPage.access_token}`);
        let pictureUrl = '';
        if (picResponse.ok) {
            const picData = await picResponse.json();
            pictureUrl = picData.picture?.data?.url || '';
        }

        return {
            id: primaryPage.id,
            name: primaryPage.name,
            username: primaryPage.id, // Pages don't always expose global username cleanly here
            accessToken: primaryPage.access_token, // Using page token for actions
            expiresIn: tokenData.expires_in,
            picture: pictureUrl,
        };
    }

    async post(accessTokenOrComposite: string, message: string): Promise<PostResponse> {
        let pageId = '';
        let token = accessTokenOrComposite;
        if (accessTokenOrComposite.includes(':')) {
            const parts = accessTokenOrComposite.split(':');
            pageId = parts[0];
            token = parts[1];
        } else {
            // Find the page ID if only token is present
            const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${token}`);
            if (meResponse.ok) {
                const meData = await meResponse.json();
                pageId = meData.id;
            }
        }

        if (!pageId) throw new Error('Could not determine Facebook Page ID for posting.');

        const publishUrl = `https://graph.facebook.com/v18.0/${pageId}/feed`;
        const publishBody = new URLSearchParams({
            message: message,
            access_token: token,
        });

        const publishResponse = await fetch(publishUrl, {
            method: 'POST',
            body: publishBody,
        });

        if (!publishResponse.ok) {
            const err = await publishResponse.text();
            throw new Error(`Failed to publish to Facebook: ${err}`);
        }

        const publishData = await publishResponse.json();

        return {
            postId: publishData.id,
            releaseURL: `https://facebook.com/${publishData.id}`,
            status: 'posted',
        };
    }

    async getAnalytics(accessToken: string, days: number) {
        return [
            { label: 'Followers', value: 0, change: '+0%' },
            { label: 'Engagement', value: 0, change: '+0%' },
            { label: 'Reach', value: 0, change: '+0%' },
        ];
    }

    async getMentions(accessToken: string) {
        return [];
    }
}

export const providers: Record<string, SocialProvider> = {
    x: new XProvider(),
    linkedin: new LinkedInProvider(),
    instagram: new InstagramProvider(),
    threads: new ThreadsProvider(),
    facebook: new FacebookProvider(),
};
