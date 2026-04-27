import crypto from 'crypto';
import { getDatabase } from '../lib/database';
import { generateVideo, VideoAspectRatio, VideoPlatform } from '../lib/fal';
import { BlotatoPlatform, BlotatoPostResult } from '../lib/blotato';
import { generateCaptions, CaptionResult } from './captionGenerator';
import { generateThumbnail, ThumbnailConfig } from './thumbnailGenerator';
import { predictPerformance, EngagementPrediction } from './videoPredictor';
import { publishContentViaBlotato } from './blotatoPublisher';

export type VideoRenderStatus = 'queued' | 'rendering' | 'rendered' | 'failed';
export type PublishingStatus = 'pending_approval' | 'approved' | 'rejected' | 'published' | 'scheduled' | 'failed';
export type ShortFormPlatform = Extract<BlotatoPlatform, 'youtube' | 'tiktok'>;

export interface VideoAsset {
    videoUrl?: string;
    thumbnailUrl?: string;
    captions?: CaptionResult;
}

export interface PublishingDraft {
    title: string;
    caption: string;
    hashtags: string[];
    scheduledAt?: string;
}

export interface VideoRenderJob {
    id: string;
    status: VideoRenderStatus;
    publishingStatus: PublishingStatus;
    persona?: string;
    channel?: string;
    theme: string;
    script?: string;
    prompt: string;
    platformTargets: ShortFormPlatform[];
    aspectRatio: VideoAspectRatio;
    durationSeconds: number;
    videoUrl?: string;
    thumbnailUrl?: string;
    captions?: CaptionResult;
    score?: EngagementPrediction;
    blotatoResult?: BlotatoPostResult;
    error?: string;
    scheduledAt?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, any>;
}

export interface CreateShortFormVideoJobInput {
    persona?: string;
    channel?: string;
    theme: string;
    script?: string;
    prompt?: string;
    title?: string;
    caption?: string;
    hashtags?: string[];
    platformTargets?: ShortFormPlatform[];
    durationSeconds?: number;
    aspectRatio?: VideoAspectRatio;
    coverImageUrl?: string;
    imageUrl?: string;
    modelId?: string;
    scheduledAt?: string;
}

export interface PublishVideoJobInput {
    scheduledAt?: string;
    title?: string;
    caption?: string;
    hashtags?: string[];
}

function nowIso(): string {
    return new Date().toISOString();
}

function clampShortDuration(seconds?: number): number {
    if (!seconds || Number.isNaN(seconds)) return 30;
    return Math.max(30, Math.min(60, Math.round(seconds)));
}

function normalizePlatforms(platforms?: ShortFormPlatform[]): ShortFormPlatform[] {
    const normalized = (platforms && platforms.length > 0 ? platforms : ['youtube', 'tiktok'])
        .filter((p): p is ShortFormPlatform => p === 'youtube' || p === 'tiktok');
    return [...new Set(normalized)];
}

function stringifyJson(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined): T | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

function rowToJob(row: any): VideoRenderJob {
    return {
        id: row.id,
        status: row.status,
        publishingStatus: row.publishing_status,
        persona: row.persona || undefined,
        channel: row.channel || undefined,
        theme: row.theme,
        script: row.script || undefined,
        prompt: row.prompt,
        platformTargets: parseJson<ShortFormPlatform[]>(row.platform_targets) || [],
        aspectRatio: row.aspect_ratio,
        durationSeconds: row.duration_seconds,
        videoUrl: row.video_url || undefined,
        thumbnailUrl: row.thumbnail_url || undefined,
        captions: parseJson<CaptionResult>(row.captions_json),
        score: parseJson<EngagementPrediction>(row.score_json),
        blotatoResult: parseJson<BlotatoPostResult>(row.blotato_result_json),
        error: row.error || undefined,
        scheduledAt: row.scheduled_at || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: parseJson<Record<string, any>>(row.metadata),
    };
}

function getPrimaryPlatform(platformTargets: ShortFormPlatform[]): VideoPlatform {
    return platformTargets.includes('tiktok') ? 'tiktok' : 'youtube';
}

function buildPrompt(input: CreateShortFormVideoJobInput): string {
    if (input.prompt?.trim()) return input.prompt.trim();
    const script = input.script?.trim();
    if (script) {
        return `Create a vertical short-form virtual influencer video for ${input.theme}. Script: ${script}`;
    }
    return `Create a vertical short-form virtual influencer video about ${input.theme}.`;
}

function buildCaption(input: CreateShortFormVideoJobInput): string {
    const base = input.caption?.trim() || input.script?.trim() || input.theme;
    const hashtags = (input.hashtags || []).map(h => h.startsWith('#') ? h : `#${h}`);
    return [base, hashtags.join(' ')].filter(Boolean).join('\n\n');
}

function insertJob(input: CreateShortFormVideoJobInput, prompt: string, platformTargets: ShortFormPlatform[]): VideoRenderJob {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const durationSeconds = clampShortDuration(input.durationSeconds);
    const aspectRatio = input.aspectRatio || '9:16';
    const metadata = {
        title: input.title || input.theme,
        caption: input.caption,
        hashtags: input.hashtags || [],
        coverImageUrl: input.coverImageUrl,
        sourceImageUrl: input.imageUrl,
        modelId: input.modelId,
    };

    db.prepare(`
        INSERT INTO video_render_jobs (
            id, status, publishing_status, persona, channel, theme, script, prompt,
            platform_targets, aspect_ratio, duration_seconds, scheduled_at,
            created_at, updated_at, metadata
        )
        VALUES (?, 'queued', 'pending_approval', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.persona || null,
        input.channel || null,
        input.theme,
        input.script || null,
        prompt,
        JSON.stringify(platformTargets),
        aspectRatio,
        durationSeconds,
        input.scheduledAt || null,
        timestamp,
        timestamp,
        stringifyJson(metadata)
    );

    return getVideoJob(id)!;
}

function updateJob(id: string, patch: Partial<VideoRenderJob>): VideoRenderJob {
    const current = getVideoJob(id);
    if (!current) throw new Error(`Video render job not found: ${id}`);

    const next = { ...current, ...patch, updatedAt: nowIso() };
    getDatabase().prepare(`
        UPDATE video_render_jobs
        SET status = ?, publishing_status = ?, video_url = ?, thumbnail_url = ?,
            captions_json = ?, score_json = ?, blotato_result_json = ?, error = ?,
            scheduled_at = ?, updated_at = ?, metadata = ?
        WHERE id = ?
    `).run(
        next.status,
        next.publishingStatus,
        next.videoUrl || null,
        next.thumbnailUrl || null,
        stringifyJson(next.captions),
        stringifyJson(next.score),
        stringifyJson(next.blotatoResult),
        next.error || null,
        next.scheduledAt || null,
        next.updatedAt,
        stringifyJson(next.metadata),
        id
    );

    return getVideoJob(id)!;
}

export function createVideoJob(input: CreateShortFormVideoJobInput): VideoRenderJob {
    if (!input.theme?.trim()) {
        throw new Error('theme is required');
    }
    const platformTargets = normalizePlatforms(input.platformTargets);
    if (platformTargets.length === 0) {
        throw new Error('platformTargets must include youtube or tiktok');
    }
    return insertJob(input, buildPrompt(input), platformTargets);
}

export function getVideoJob(id: string): VideoRenderJob | undefined {
    const row = getDatabase().prepare('SELECT * FROM video_render_jobs WHERE id = ?').get(id);
    return row ? rowToJob(row) : undefined;
}

export function listVideoJobs(status?: VideoRenderStatus, publishingStatus?: PublishingStatus): VideoRenderJob[] {
    const filters: string[] = [];
    const params: string[] = [];
    if (status) {
        filters.push('status = ?');
        params.push(status);
    }
    if (publishingStatus) {
        filters.push('publishing_status = ?');
        params.push(publishingStatus);
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = getDatabase().prepare(`SELECT * FROM video_render_jobs ${where} ORDER BY created_at DESC`).all(...params);
    return (rows as any[]).map(rowToJob);
}

export async function renderShortFormVideo(input: CreateShortFormVideoJobInput): Promise<VideoRenderJob> {
    let job = createVideoJob(input);
    job = updateJob(job.id, { status: 'rendering', error: undefined });

    try {
        const scriptText = input.script || input.prompt || input.theme;
        const captions = generateCaptions(scriptText, { format: 'srt' });
        const thumbnail: ThumbnailConfig | undefined = input.coverImageUrl || input.imageUrl
            ? generateThumbnail(input.coverImageUrl || input.imageUrl!, input.title || input.theme, input.persona, 'bold')
            : undefined;

        const video = await generateVideo({
            prompt: job.prompt,
            imageUrl: input.imageUrl || input.coverImageUrl,
            platform: getPrimaryPlatform(job.platformTargets),
            aspectRatio: job.aspectRatio,
            durationSeconds: job.durationSeconds,
            modelId: input.modelId,
            sourceJobId: job.id,
        });

        const score = predictPerformance({
            title: input.title || input.theme,
            description: buildCaption(input),
            duration: job.durationSeconds,
            topic: input.theme,
            thumbnailQuality: thumbnail ? 85 : 60,
            hasSubtitles: true,
            platform: getPrimaryPlatform(job.platformTargets),
        });

        return updateJob(job.id, {
            status: 'rendered',
            publishingStatus: 'pending_approval',
            videoUrl: video.url,
            thumbnailUrl: input.coverImageUrl || input.imageUrl,
            captions,
            score,
            metadata: {
                ...job.metadata,
                thumbnail,
                render: video.metadata,
                captionText: buildCaption(input),
            },
        });
    } catch (error: any) {
        return updateJob(job.id, {
            status: 'failed',
            publishingStatus: 'failed',
            error: error.message || String(error),
        });
    }
}

export function approveVideoJob(id: string): VideoRenderJob {
    const job = getVideoJob(id);
    if (!job) throw new Error(`Video render job not found: ${id}`);
    if (job.status !== 'rendered') {
        throw new Error(`Video render job ${id} is ${job.status}, cannot approve`);
    }
    return updateJob(id, { publishingStatus: 'approved', error: undefined });
}

export function rejectVideoJob(id: string, reason?: string): VideoRenderJob {
    const job = getVideoJob(id);
    if (!job) throw new Error(`Video render job not found: ${id}`);
    if (job.publishingStatus === 'published' || job.publishingStatus === 'scheduled') {
        throw new Error(`Video render job ${id} is ${job.publishingStatus}, cannot reject`);
    }
    return updateJob(id, { publishingStatus: 'rejected', error: reason });
}

export async function publishApprovedVideoJob(id: string, input: PublishVideoJobInput = {}): Promise<VideoRenderJob> {
    const job = getVideoJob(id);
    if (!job) throw new Error(`Video render job not found: ${id}`);
    if (job.status !== 'rendered') {
        throw new Error(`Video render job ${id} is ${job.status}, cannot publish`);
    }
    if (job.publishingStatus !== 'approved') {
        throw new Error(`Video render job ${id} must be approved before publishing`);
    }
    if (!job.videoUrl) {
        throw new Error(`Video render job ${id} has no rendered video URL`);
    }

    const hashtags = input.hashtags || job.metadata?.hashtags || [];
    const caption = input.caption || job.metadata?.captionText || job.metadata?.caption || job.script || job.theme;
    const title = input.title || job.metadata?.title || job.theme;
    const content = [caption, hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')].filter(Boolean).join('\n\n');
    const scheduledAt = input.scheduledAt || job.scheduledAt;

    try {
        const result = await publishContentViaBlotato(content, job.platformTargets, scheduledAt, [job.videoUrl], {
            title,
            thumbnailUrl: job.thumbnailUrl,
            hashtags,
        });
        return updateJob(id, {
            publishingStatus: scheduledAt ? 'scheduled' : 'published',
            scheduledAt,
            blotatoResult: result,
            error: undefined,
        });
    } catch (error: any) {
        return updateJob(id, {
            publishingStatus: 'failed',
            error: error.message || String(error),
        });
    }
}

export async function publishApprovedVideoJobs(): Promise<VideoRenderJob[]> {
    const approvedJobs = listVideoJobs('rendered', 'approved');
    const results: VideoRenderJob[] = [];
    for (const job of approvedJobs) {
        results.push(await publishApprovedVideoJob(job.id));
    }
    return results;
}
