import { fal } from '@fal-ai/client';
import { FalRegistry } from './fal-registry';
import { MediaStore } from './media-store';

export interface GenerationResult {
    url: string;
    modelId: string;
    cost?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin';
export type VideoAspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export interface VideoGenerationOptions {
    prompt: string;
    imageUrl?: string;
    platform?: VideoPlatform;
    aspectRatio?: VideoAspectRatio;
    durationSeconds?: number;
    modelId?: string;
    sourceJobId?: string;
}

interface FalVideoModelConfig {
    modelId: string;
    resolution: string;
    aspectRatio: VideoAspectRatio;
    targetDurationSeconds: number;
    renderDurationSeconds: number;
    durationInput: string | number;
    generateAudio: boolean;
    supportsImageInput: boolean;
}

const DEFAULT_SHORTS_MODEL = process.env.FAL_VIDEO_MODEL || 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video';

const SHORTS_PRESETS: Record<'youtube' | 'tiktok', Pick<FalVideoModelConfig, 'aspectRatio' | 'targetDurationSeconds' | 'resolution' | 'generateAudio'>> = {
    youtube: { aspectRatio: '9:16', targetDurationSeconds: 30, resolution: '720p', generateAudio: true },
    tiktok: { aspectRatio: '9:16', targetDurationSeconds: 30, resolution: '720p', generateAudio: true },
};

function clampDuration(seconds: number | undefined): number {
    if (!seconds || Number.isNaN(seconds)) return 30;
    return Math.max(30, Math.min(60, Math.round(seconds)));
}

function modelSupportsImageInput(modelId: string): boolean {
    return /image-to-video|i2v|kling|luma|runway|hailuo/i.test(modelId);
}

function resolveRenderDuration(modelId: string, targetDurationSeconds: number): { renderDurationSeconds: number; durationInput: string | number } {
    if (/seedance/i.test(modelId)) {
        const allowed = Math.max(4, Math.min(12, Math.round(targetDurationSeconds)));
        return { renderDurationSeconds: allowed, durationInput: String(allowed) };
    }

    return { renderDurationSeconds: targetDurationSeconds, durationInput: targetDurationSeconds };
}

function resolveVideoConfig(options: VideoGenerationOptions): FalVideoModelConfig {
    const platformPreset = options.platform === 'youtube' || options.platform === 'tiktok'
        ? SHORTS_PRESETS[options.platform]
        : SHORTS_PRESETS.tiktok;

    const modelId = options.modelId || DEFAULT_SHORTS_MODEL;
    const targetDurationSeconds = clampDuration(options.durationSeconds || platformPreset.targetDurationSeconds);
    const { renderDurationSeconds, durationInput } = resolveRenderDuration(modelId, targetDurationSeconds);

    return {
        modelId,
        resolution: platformPreset.resolution,
        aspectRatio: options.aspectRatio || platformPreset.aspectRatio,
        targetDurationSeconds,
        renderDurationSeconds,
        durationInput,
        generateAudio: platformPreset.generateAudio,
        supportsImageInput: modelSupportsImageInput(modelId),
    };
}

export async function generateImage(prompt: string, modelId: string = process.env.FAL_IMAGE_MODEL || 'fal-ai/hunyuan-image/v3/instruct/text-to-image'): Promise<GenerationResult> {
    const start = Date.now();
    try {
        const result: any = await fal.subscribe(modelId, {
            input: {
                prompt: prompt,
                image_size: 'landscape_16_9',
                num_inference_steps: 28,
                guidance_scale: 3.5,
                num_images: 1,
                enable_safety_checker: true
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log(`[Fal.ai Image] ${update.logs.map((l) => l.message).join('\n')}`);
                }
            },
        });

        console.log('[Fal.ai Debug] Image Result:', JSON.stringify(result, null, 2));

        let url = '';
        if (result.data && result.data.images && result.data.images.length > 0) {
            url = result.data.images[0].url;
        } else if (result.images && result.images.length > 0) {
            url = result.images[0].url;
        } else {
            throw new Error('No image URL returned from Fal.ai');
        }

        const duration = (Date.now() - start) / 1000;

        // Estimate cost if possible (simple lookup)
        let cost = 0;
        try {
            const pricing = await FalRegistry.getPricing([modelId]);
            if (pricing.length > 0) {
                // Simple unit cost based on 1 image
                cost = pricing[0].unit_price;
            }
        } catch (e) {
            console.warn('Failed to fetch pricing for image cost estimation', e);
        }

        // Persist to database (non-fatal — don't discard a successful generation)
        try {
            MediaStore.save({
                type: 'image',
                url,
                prompt,
                modelId,
                cost,
                duration
            });
        } catch (saveError) {
            console.error('Failed to persist image to MediaStore:', saveError);
        }

        return { url, modelId, cost, duration };

    } catch (error: any) {
        console.error('Error generating image with Fal.ai:', error);
        throw new Error(`Error generating image: ${error.message}`);
    }
}

export async function generateVideo(
    optionsOrPrompt: VideoGenerationOptions | string,
    legacyImageUrl?: string,
    legacyModelId?: string
): Promise<GenerationResult> {
    const options: VideoGenerationOptions = typeof optionsOrPrompt === 'string'
        ? { prompt: optionsOrPrompt, imageUrl: legacyImageUrl, modelId: legacyModelId }
        : optionsOrPrompt;
    const start = Date.now();
    try {
        const config = resolveVideoConfig(options);
        const endpoint = config.modelId;
        const input: any = {
            prompt: options.prompt,
            resolution: config.resolution,
            aspect_ratio: config.aspectRatio,
            duration: config.durationInput,
            generate_audio: config.generateAudio
        };

        if (options.imageUrl && config.supportsImageInput) {
            input.image_url = options.imageUrl;
        }

        const result: any = await fal.subscribe(endpoint, {
            input,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log(`[Fal.ai Video] ${update.logs.map((l) => l.message).join('\n')}`);
                }
            },
        });

        let url = '';
        if (result.data && result.data.video && result.data.video.url) {
            url = result.data.video.url;
        } else if (result.video && result.video.url) {
            url = result.video.url;
        } else {
            throw new Error('No video URL returned from Fal.ai');
        }

        const duration = (Date.now() - start) / 1000;

        // Estimate cost
        let cost = 0;
        try {
            const pricing = await FalRegistry.getPricing([config.modelId]);
            if (pricing.length > 0) {
                const p = pricing[0];
                if (p.unit === 'second') {
                    cost = p.unit_price * config.renderDurationSeconds;
                } else {
                    cost = p.unit_price;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch pricing for video cost estimation', e);
        }

        // Persist to database (non-fatal — don't discard a successful generation)
        try {
            MediaStore.save({
                type: 'video',
                url,
                prompt: options.prompt,
                modelId: config.modelId,
                cost,
                duration,
                metadata: {
                    platform: options.platform,
                    aspectRatio: config.aspectRatio,
                    targetDurationSeconds: config.targetDurationSeconds,
                    renderDurationSeconds: config.renderDurationSeconds,
                    sourceJobId: options.sourceJobId,
                    startImageUsed: Boolean(options.imageUrl && config.supportsImageInput),
                    ignoredImageUrl: Boolean(options.imageUrl && !config.supportsImageInput)
                }
            });
        } catch (saveError) {
            console.error('Failed to persist video to MediaStore:', saveError);
        }

        return {
            url,
            modelId: config.modelId,
            cost,
            duration,
            metadata: {
                platform: options.platform,
                aspectRatio: config.aspectRatio,
                targetDurationSeconds: config.targetDurationSeconds,
                renderDurationSeconds: config.renderDurationSeconds,
                sourceJobId: options.sourceJobId,
                startImageUsed: Boolean(options.imageUrl && config.supportsImageInput),
            }
        };

    } catch (error: any) {
        console.error('Error generating video with Fal.ai:', error);
        throw new Error(`Error generating video: ${error.message}`);
    }
}
