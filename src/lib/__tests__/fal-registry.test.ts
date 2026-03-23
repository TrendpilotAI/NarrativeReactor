/**
 * Unit tests for src/lib/fal-registry.ts
 * 
 * Tests the Fal.ai platform registry — model listing, pricing, and categorization.
 * Global `fetch` is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FalRegistry } from '../fal-registry';

const mockFetch = vi.fn();

describe('FalRegistry', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        process.env.FAL_KEY = 'test-fal-key';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('listModels()', () => {
        it('fetches models from /v1/models with auth header', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    models: [
                        { endpoint_id: 'fal-ai/flux', owner: 'fal-ai', metadata: { tags: ['image'], category: 'text-to-image' } },
                    ],
                }),
            });

            const models = await FalRegistry.listModels();

            expect(mockFetch).toHaveBeenCalledOnce();
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/models');
            expect(options.headers.Authorization).toBe('Key test-fal-key');
            expect(models).toHaveLength(1);
            expect(models[0].id).toBe('fal-ai/flux');
        });

        it('maps model fields correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    models: [
                        { endpoint_id: 'fal-ai/seedance', metadata: { tags: ['video', 'gen'], category: 'text-to-video' } },
                    ],
                }),
            });

            const models = await FalRegistry.listModels();
            expect(models[0].id).toBe('fal-ai/seedance');
            expect(models[0].owner).toBe('fal-ai');
            expect(models[0].capabilities).toEqual(['video', 'gen']);
            expect(models[0].category).toBe('text-to-video');
        });

        it('returns empty array on API error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            const models = await FalRegistry.listModels();
            expect(models).toEqual([]);
        });

        it('handles alternate response format (results instead of models)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    results: [
                        { endpoint_id: 'fal-ai/hunyuan', metadata: {} },
                    ],
                }),
            });

            const models = await FalRegistry.listModels();
            expect(models).toHaveLength(1);
            expect(models[0].id).toBe('fal-ai/hunyuan');
        });
    });

    describe('getPricing()', () => {
        it('returns empty array for empty modelIds', async () => {
            const pricing = await FalRegistry.getPricing([]);
            expect(pricing).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('fetches pricing with correct query params', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    prices: [
                        { endpoint_id: 'fal-ai/flux', unit_price: 0.01, unit: 'image', currency: 'USD' },
                    ],
                }),
            });

            const pricing = await FalRegistry.getPricing(['fal-ai/flux']);

            expect(mockFetch).toHaveBeenCalledOnce();
            const url = mockFetch.mock.calls[0][0];
            expect(url).toContain('endpoint_id=fal-ai%2Fflux');
            expect(pricing).toHaveLength(1);
            expect(pricing[0].unit_price).toBe(0.01);
        });

        it('returns empty array on API error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                text: async () => 'Forbidden',
            });

            const pricing = await FalRegistry.getPricing(['fal-ai/flux']);
            expect(pricing).toEqual([]);
        });
    });

    describe('getModelCategory()', () => {
        it('categorizes video models correctly', () => {
            expect(FalRegistry.getModelCategory('fal-ai/text-to-video/v3')).toBe('video');
            expect(FalRegistry.getModelCategory('fal-ai/image-to-video')).toBe('video');
            expect(FalRegistry.getModelCategory('fal-ai/seedance/video')).toBe('video');
        });

        it('categorizes image models correctly', () => {
            expect(FalRegistry.getModelCategory('fal-ai/text-to-image/v2')).toBe('image');
            expect(FalRegistry.getModelCategory('fal-ai/flux-pro')).toBe('image');
            expect(FalRegistry.getModelCategory('fal-ai/sdxl-turbo')).toBe('image');
        });

        it('categorizes audio models correctly', () => {
            expect(FalRegistry.getModelCategory('fal-ai/audio-gen')).toBe('audio');
            expect(FalRegistry.getModelCategory('fal-ai/music-gen')).toBe('audio');
            expect(FalRegistry.getModelCategory('fal-ai/voice-clone')).toBe('audio');
        });

        it('returns "other" for unrecognized models', () => {
            expect(FalRegistry.getModelCategory('fal-ai/some-model')).toBe('other');
            expect(FalRegistry.getModelCategory('custom/llm')).toBe('other');
        });
    });
});
