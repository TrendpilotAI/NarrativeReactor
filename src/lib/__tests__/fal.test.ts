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

        it('calculates cost per second when unit is "second"', async () => {
            mockSubscribe.mockResolvedValueOnce({
                video: { url: 'https://cdn.fal.ai/vid.mp4' },
            });
            mockGetPricing.mockResolvedValueOnce([
                { endpoint_id: 'fal-ai/seedance', unit_price: 0.01, unit: 'second', currency: 'USD' },
            ]);

            const result = await generateVideo('test');
            // 5 seconds * $0.01/second = $0.05
            expect(result.cost).toBe(0.05);
        });

        it('throws when no video URL is returned', async () => {
            mockSubscribe.mockResolvedValueOnce({});

            await expect(generateVideo('test')).rejects.toThrow('Error generating video');
        });
    });
});
