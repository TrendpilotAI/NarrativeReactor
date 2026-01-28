import { TwitterApi } from 'twitter-api-v2';
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

export class XProvider implements SocialProvider {
    identifier = 'x';
    name = 'X';

    async generateAuthUrl() {
        const client = new TwitterApi({
            appKey: process.env.X_API_KEY!,
            appSecret: process.env.X_API_SECRET!,
        });

        // Use a callback URL that points to our integrations page
        const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3010'}/integrations/callback/x`;

        const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl, {
            authAccessType: 'write',
            linkMode: 'authenticate',
        });

        return {
            url,
            codeVerifier: `${oauth_token}:${oauth_token_secret}`,
            state: oauth_token,
        };
    }

    async authenticate(params: { code: string; codeVerifier: string }) {
        const { code, codeVerifier } = params;
        const [oauth_token, oauth_token_secret] = codeVerifier.split(':');

        const client = new TwitterApi({
            appKey: process.env.X_API_KEY!,
            appSecret: process.env.X_API_SECRET!,
            accessToken: oauth_token,
            accessSecret: oauth_token_secret,
        });

        const { accessToken, accessSecret, screenName, userId } = await client.login(code);

        const authenticatedClient = new TwitterApi({
            appKey: process.env.X_API_KEY!,
            appSecret: process.env.X_API_SECRET!,
            accessToken,
            accessSecret,
        });

        const me = await authenticatedClient.v2.me({
            'user.fields': ['profile_image_url', 'name'],
        });

        return {
            id: userId,
            name: me.data.name,
            username: screenName,
            accessToken: `${accessToken}:${accessSecret}`,
            picture: me.data.profile_image_url,
        };
    }

    async post(accessToken: string, message: string): Promise<PostResponse> {
        const [token, secret] = accessToken.split(':');
        const client = new TwitterApi({
            appKey: process.env.X_API_KEY!,
            appSecret: process.env.X_API_SECRET!,
            accessToken: token,
            accessSecret: secret,
        });

        const { data } = await client.v2.tweet(message);

        const me = await client.v2.me();

        return {
            postId: data.id,
            releaseURL: `https://x.com/${me.data.username}/status/${data.id}`,
            status: 'posted',
        };
    }

    async getAnalytics(accessToken: string, days: number) {
        const [token, secret] = accessToken.split(':');
        const client = new TwitterApi({
            appKey: process.env.X_API_KEY!,
            appSecret: process.env.X_API_SECRET!,
            accessToken: token,
            accessSecret: secret,
        });

        const me = await client.v2.me();
        const since = dayjs().subtract(days, 'day').toISOString();

        // Fetch recent tweets to get their metrics
        const tweets = await client.v2.userTimeline(me.data.id, {
            'tweet.fields': ['public_metrics', 'created_at'],
            start_time: since,
            max_results: 100,
        });

        const metrics = tweets.data.data?.reduce((acc: any, tweet) => {
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
        const [token, secret] = accessToken.split(':');
        const client = new TwitterApi({
            appKey: process.env.X_API_KEY!,
            appSecret: process.env.X_API_SECRET!,
            accessToken: token,
            accessSecret: secret,
        });

        const me = await client.v2.me();
        const mentions = await client.v2.userMentionTimeline(me.data.id, {
            'tweet.fields': ['created_at', 'author_id'],
            expansions: ['author_id'],
            'user.fields': ['name', 'username', 'profile_image_url'],
            max_results: 10,
        });

        const users = mentions.includes?.users?.reduce((acc: Record<string, { name: string; username: string; profile_image_url?: string }>, user: { id: string; name: string; username: string; profile_image_url?: string }) => {
            acc[user.id] = user;
            return acc;
        }, {} as Record<string, { name: string; username: string; profile_image_url?: string }>) || {};

        return mentions.data.data?.map((tweet: { id: string; text: string; created_at?: string; author_id?: string }) => ({
            id: tweet.id,
            text: tweet.text,
            createdAt: tweet.created_at,
            author: {
                name: users[tweet.author_id!]?.name || 'Unknown',
                username: users[tweet.author_id!]?.username || 'unknown',
                avatar: users[tweet.author_id!]?.profile_image_url || '',
            }
        })) || [];
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
};
