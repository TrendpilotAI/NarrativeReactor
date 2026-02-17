import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';
import dayjs from 'dayjs';
import fs from 'fs/promises';
import path from 'path';

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
    post(accessToken: string, message: string): Promise<PostResponse>;
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

export async function saveIntegration(provider: string, details: AuthTokenDetails) {
    const integrations = await loadIntegrations();
    integrations[provider] = details;
    await fs.mkdir(path.dirname(INTEGRATIONS_PATH), { recursive: true });
    await fs.writeFile(INTEGRATIONS_PATH, JSON.stringify(integrations, null, 2));
}

export async function loadIntegrations() {
    try {
        const data = await fs.readFile(INTEGRATIONS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export const providers: Record<string, SocialProvider> = {
    x: new XProvider(),
    linkedin: new LinkedInProvider(),
};
