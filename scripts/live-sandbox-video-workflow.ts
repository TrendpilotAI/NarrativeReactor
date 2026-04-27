import 'dotenv/config';
import http from 'http';
import path from 'path';
import { createApp } from '../src/app';

interface JsonResponse<T> {
    status: number;
    body: T;
}

interface VideoJobResponse {
    id: string;
    status: string;
    publishingStatus: string;
    videoUrl?: string;
    platformTargets?: string[];
}

function futureIso(daysFromNow: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    date.setUTCHours(15, 0, 0, 0);
    return date.toISOString();
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

async function postJson<T>(baseUrl: string, pathName: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<JsonResponse<T>> {
    const response = await fetch(`${baseUrl}${pathName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(body),
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    return { status: response.status, body: parsed as T };
}

async function main(): Promise<void> {
    process.env.NODE_ENV ||= 'development';
    process.env.API_KEY ||= `sandbox-api-key-${Date.now()}`;
    process.env.WEBHOOK_SECRET ||= `sandbox-webhook-secret-${Date.now()}`;
    process.env.DATABASE_PATH ||= path.join(process.cwd(), 'data', 'live-sandbox-video.db');

    if (!process.env.FAL_KEY && !process.env.FAL_API_KEY) {
        throw new Error('FAL_KEY or FAL_API_KEY is required for a live Fal sandbox render');
    }

    const apiKey = requireEnv('API_KEY');
    const webhookSecret = requireEnv('WEBHOOK_SECRET');
    const scheduledAt = process.env.LIVE_VIDEO_SCHEDULED_AT || futureIso(7);
    const platforms = (process.env.LIVE_VIDEO_PLATFORM_TARGETS || 'youtube,tiktok')
        .split(',')
        .map(platform => platform.trim())
        .filter(Boolean);

    const app = createApp({ rateLimitMax: 1000 });
    const server = await new Promise<http.Server>((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });

    try {
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Failed to bind sandbox server');
        }
        const baseUrl = `http://127.0.0.1:${address.port}`;

        const renderPayload = {
            persona: process.env.LIVE_VIDEO_PERSONA || 'FlipMyEra virtual influencer',
            channel: process.env.LIVE_VIDEO_CHANNEL || 'FlipMyEra Shorts',
            theme: process.env.LIVE_VIDEO_THEME || 'FlipMyEra alternate-era identity reveal',
            script: process.env.LIVE_VIDEO_SCRIPT || 'What if your style, story, and status could belong to a completely different era? FlipMyEra makes that version visible.',
            title: process.env.LIVE_VIDEO_TITLE || 'FlipMyEra alternate-era reveal',
            caption: process.env.LIVE_VIDEO_CAPTION || 'A new virtual influencer test from FlipMyEra.',
            hashtags: (process.env.LIVE_VIDEO_HASHTAGS || 'FlipMyEra,VirtualInfluencer,AIShorts')
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean),
            platformTargets: platforms,
            durationSeconds: Number(process.env.LIVE_VIDEO_DURATION_SECONDS || 30),
            imageUrl: process.env.LIVE_VIDEO_IMAGE_URL,
            coverImageUrl: process.env.LIVE_VIDEO_COVER_IMAGE_URL,
            modelId: process.env.FAL_VIDEO_MODEL,
            scheduledAt,
        };

        console.log(`[sandbox] API listening at ${baseUrl}`);
        console.log(`[sandbox] Rendering live Fal video with model ${process.env.FAL_VIDEO_MODEL || 'default configured model'}`);

        const rendered = await postJson<{ success: boolean; data: VideoJobResponse }>(
            baseUrl,
            '/webhooks/n8n/video',
            renderPayload,
            { 'X-Webhook-Secret': webhookSecret }
        );
        if (rendered.status >= 400) {
            throw new Error(`Render webhook failed (${rendered.status}): ${JSON.stringify(rendered.body)}`);
        }

        const job = rendered.body.data;
        console.log(`[sandbox] Render job ${job.id}: ${job.status}, publishing=${job.publishingStatus}`);
        console.log(`[sandbox] Video URL: ${job.videoUrl || 'not returned'}`);
        if (job.status !== 'rendered') {
            throw new Error(`Render did not complete successfully; job status is ${job.status}`);
        }

        const approved = await postJson<VideoJobResponse>(
            baseUrl,
            `/api/video/jobs/${job.id}/approve`,
            {},
            { 'X-API-Key': apiKey }
        );
        if (approved.status >= 400) {
            throw new Error(`Approval failed (${approved.status}): ${JSON.stringify(approved.body)}`);
        }
        console.log(`[sandbox] Approved job ${approved.body.id}`);

        const dryRun = await postJson<{ success: boolean; dryRun: true; publishable: number; data: VideoJobResponse[] }>(
            baseUrl,
            '/webhooks/n8n/video/publish-approved',
            { dryRun: true },
            { 'X-Webhook-Secret': webhookSecret }
        );
        if (dryRun.status >= 400) {
            throw new Error(`Publish-approved dry-run failed (${dryRun.status}): ${JSON.stringify(dryRun.body)}`);
        }
        console.log(`[sandbox] publish-approved dry-run found ${dryRun.body.publishable} approved job(s)`);

        if (process.env.LIVE_BLOTATO_CONFIRM === '1') {
            requireEnv('BLOTATO_API_KEY');
            const published = await postJson<VideoJobResponse>(
                baseUrl,
                `/api/video/jobs/${job.id}/publish`,
                { scheduledAt },
                { 'X-API-Key': apiKey }
            );
            if (published.status >= 400) {
                throw new Error(`Blotato scheduled publish failed (${published.status}): ${JSON.stringify(published.body)}`);
            }
            console.log(`[sandbox] Blotato scheduled publish: ${published.body.publishingStatus} at ${scheduledAt}`);
        } else {
            console.log('[sandbox] Blotato live scheduled post skipped. Set LIVE_BLOTATO_CONFIRM=1 to create the scheduled post.');
        }
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

main().catch((error: Error) => {
    console.error(`[sandbox] ${error.message}`);
    process.exitCode = 1;
});
