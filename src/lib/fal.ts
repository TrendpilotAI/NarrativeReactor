import { fal } from '@fal-ai/client';
import { FalRegistry } from './fal-registry';
import { MediaStore } from './media-store';

export interface GenerationResult {
    url: string;
    modelId: string;
    cost?: number;
    duration?: number;
}

export async function generateImage(prompt: string, modelId: string = 'fal-ai/hunyuan-image/v3/instruct/text-to-image'): Promise<GenerationResult> {
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

        // Persist to database
        MediaStore.save({
            type: 'image',
            url,
            prompt,
            modelId,
            cost,
            duration
        });

        return { url, modelId, cost, duration };

    } catch (error: any) {
        console.error('Error generating image with Fal.ai:', error);
        throw new Error(`Error generating image: ${error.message}`);
    }
}

export async function generateVideo(prompt: string, imageUrl?: string, modelId: string = 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'): Promise<GenerationResult> {
    const start = Date.now();
    try {
        const endpoint = modelId;
        const input: any = {
            prompt: prompt,
            resolution: "720p",
            aspect_ratio: "16:9",
            duration: 5, // Integer 4-12
            generate_audio: true // Supported by Seedance
        };

        if (imageUrl) {
            // Hunyuan is text-to-video primarily; ignore imageUrl for now or find specific I2V endpoint
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
            const pricing = await FalRegistry.getPricing([modelId]);
            if (pricing.length > 0) {
                // Seedance pricing might be per second or per video
                // Simplistic estimation: unit_price * duration if unit is seconds, or just unit_price if unit is video
                const p = pricing[0];
                if (p.unit === 'second') {
                    cost = p.unit_price * 5; // 5 seconds duration
                } else {
                    cost = p.unit_price;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch pricing for video cost estimation', e);
        }

        // Persist to database
        MediaStore.save({
            type: 'video',
            url,
            prompt,
            modelId,
            cost,
            duration
        });

        return { url, modelId, cost, duration };

    } catch (error: any) {
        console.error('Error generating video with Fal.ai:', error);
        throw new Error(`Error generating video: ${error.message}`);
    }
}
