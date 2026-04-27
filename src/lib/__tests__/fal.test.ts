/**
 * Unit tests for src/lib/fal.ts
 * 
 * Tests image and video generation with the Fal.ai client.
 * Mocks: @fal-ai/client, FalRegistry, MediaStore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockSubscribe, mockGetPricing, mockMediaSave } = vi.hoisted(() => ({
    mockSubscribe: vi.fn(),
    mockGetPricing: vi.fn(),
    mockMediaSave: vi.fn(),
}));

vi.mock('@fal-ai/client', () => ({
    fal: {
        subscribe: mockSubscribe,
    },
}));

vi.mock('../fal-registry', () => ({
    FalRegistry: {
        getPricing: mockGetPricing,
    },
}));

vi.mock('../media-store', () => ({
    MediaStore: {
        save: mockMediaSave,
    },
}));

import { generateImage, generateVideo } from '../fal';

describe('fal.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPricing.mockResolvedValue([]);
        mockMediaSave.mockReturnValue({ id: 'saved-id' });
    });

    describe('generateImage()', () => {
        it('calls fal.subscribe with the default model', async () => {
            mockSubscribe.mockResolvedValueOnce({
                images: [{ url: 'https://cdn.fal.ai/img.png' }],
            });

            await generateImage('A sunset over mountains');

            expect(mockSubscribe).toHaveBeenCalledOnce();
            const [modelId, options] = mockSubscribe.mock.calls[0];
            expect(modelId).toBe('fal-ai/hunyuan-image/v3/instruct/text-to-image');
            expect(options.input.prompt).toBe('A sunset over mountains');
        });

        it('uses a custom model when specified', async () => {
            mockSubscribe.mockResolvedValueOnce({
                images: [{ url: 'https://cdn.fal.ai/img.png' }],
            });

            await generateImage('A sunset', 'fal-ai/flux-pro');

            const [modelId] = mockSubscribe.mock.calls[0];
            expect(modelId).toBe('fal-ai/flux-pro');
        });

        it('extracts URL from result.images format', async () => {
            mockSubscribe.mockResolvedValueOnce({
                images: [{ url: 'https://cdn.fal.ai/direct.png' }],
            });

            const result = await generateImage('test');
            expect(result.url).toBe('https://cdn.fal.ai/direct.png');
        });

        it('extracts URL from result.data.images format', async () => {
            mockSubscribe.mockResolvedValueOnce({
                data: { images: [{ url: 'https://cdn.fal.ai/nested.png' }] },
            });

            const result = await generateImage('test');
            expect(result.url).toBe('https://cdn.fal.ai/nested.png');
        });

        it('persists generated image to MediaStore', async () => {
            mockSubscribe.mockResolvedValueOnce({
                images: [{ url: 'https://cdn.fal.ai/img.png' }],
            });

            await generateImage('A hero shot');

            expect(mockMediaSave).toHaveBeenCalledOnce();
            const saved = mockMediaSave.mock.calls[0][0];
            expect(saved.type).toBe('image');
            expect(saved.url).toBe('https://cdn.fal.ai/img.png');
            expect(saved.prompt).toBe('A hero shot');
        });

        it('includes cost from FalRegistry pricing', async () => {
            mockSubscribe.mockResolvedValueOnce({
                images: [{ url: 'https://cdn.fal.ai/img.png' }],
            });
            mockGetPricing.mockResolvedValueOnce([
                { endpoint_id: 'fal-ai/hunyuan', unit_price: 0.03, unit: 'image', currency: 'USD' },
            ]);

            const result = await generateImage('test');
            expect(result.cost).toBe(0.03);
        });

        it('throws when no image URL is returned', async () => {
            mockSubscribe.mockResolvedValueOnce({});

            await expect(generateImage('test')).rejects.toThrow('Error generating image');
        });
    });

    describe('generateVideo()', () => {
        it('calls fal.subscribe with the default video model', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/vid.mp4' },
            });

            await generateVideo('A flying car');

            const [modelId, options] = mockSubscribe.mock.calls[0];
            expect(modelId).toBe('fal-ai/bytedance/seedance/v1.5/pro/text-to-video');
            expect(options.input.prompt).toBe('A flying car');
        });

        it('extracts URL from result.video format', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/direct.mp4' },
            });

            const result = await generateVideo('test');
            expect(result.url).toBe('https://cdn.fal.ai/direct.mp4');
        });

        it('extracts URL from result.data.video format', async () => {
            mockSubscribe.mockResolvedValueOnce({
                data: { video: { url: 'https://cdn.fal.ai/nested.mp4' } },
            });

            const result = await generateVideo('test');
            expect(result.url).toBe('https://cdn.fal.ai/nested.mp4');
        });

        it('persists generated video to MediaStore', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/vid.mp4' },
            });

            await generateVideo('Action scene');

            expect(mockMediaSave).toHaveBeenCalledOnce();
            const saved = mockMediaSave.mock.calls[0][0];
            expect(saved.type).toBe('video');
            expect(saved.url).toBe('https://cdn.fal.ai/vid.mp4');
            expect(saved.prompt).toBe('Action scene');
        });

        it('uses image input only for image-to-video models', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/i2v.mp4' },
            });

            const result = await generateVideo({
                prompt: 'Animated cover frame',
                imageUrl: 'https://cdn.fal.ai/cover.png',
                modelId: 'fal-ai/kling/image-to-video',
                aspectRatio: '1:1',
                durationSeconds: 61,
                platform: 'youtube',
                sourceJobId: 'job-123',
            });

            const [, options] = mockSubscribe.mock.calls[0];
            expect(options.input).toMatchObject({
                image_url: 'https://cdn.fal.ai/cover.png',
                aspect_ratio: '1:1',
                duration: 60,
            });
            expect(result.metadata).toMatchObject({
                startImageUsed: true,
                targetDurationSeconds: 60,
                renderDurationSeconds: 60,
                sourceJobId: 'job-123',
            });
        });

        it('ignores start images for text-only models and clamps low durations', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/text-only.mp4' },
            });

            const result = await generateVideo({
                prompt: 'Text-only render',
                imageUrl: 'https://cdn.fal.ai/cover.png',
                modelId: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
                durationSeconds: 4,
                platform: 'linkedin',
            });

            const [, options] = mockSubscribe.mock.calls[0];
            expect(options.input.image_url).toBeUndefined();
            expect(options.input.duration).toBe('12');
            expect(result.metadata).toMatchObject({
                startImageUsed: false,
                targetDurationSeconds: 30,
                renderDurationSeconds: 12,
            });
            expect(mockMediaSave.mock.calls[0][0].metadata.ignoredImageUrl).toBe(true);
        });

        it('keeps successful video results when pricing and persistence fail', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/no-cost.mp4' },
            });
            mockGetPricing.mockRejectedValueOnce(new Error('pricing unavailable'));
            mockMediaSave.mockImplementationOnce(() => {
                throw new Error('database unavailable');
            });

            const result = await generateVideo('Still return the render');

            expect(result.url).toBe('https://cdn.fal.ai/no-cost.mp4');
            expect(result.cost).toBe(0);
        });

        it('calculates cost per second when unit is "second"', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/vid.mp4' },
            });
            mockGetPricing.mockResolvedValueOnce([
                { endpoint_id: 'fal-ai/seedance', unit_price: 0.01, unit: 'second', currency: 'USD' },
            ]);

            const result = await generateVideo('test');
            // Seedance renders a 12-second clip for the 30-second target.
            expect(result.cost).toBe(0.12);
        });

        it('throws when no video URL is returned', async () => {
            mockSubscribe.mockResolvedValueOnce({});

            await expect(generateVideo('test')).rejects.toThrow('Error generating video');
        });
    });
});
