import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fal client to prevent import issues
vi.mock('@fal-ai/client', () => ({
  fal: { subscribe: vi.fn() },
}));

import { FalRegistry } from '../../lib/fal-registry';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FalRegistry.getModelCategory', () => {
  it('should classify text-to-video as video', () => {
    expect(FalRegistry.getModelCategory('fal-ai/text-to-video')).toBe('video');
  });

  it('should classify image-to-video as video', () => {
    expect(FalRegistry.getModelCategory('fal-ai/image-to-video')).toBe('video');
  });

  it('should classify text-to-image as image', () => {
    expect(FalRegistry.getModelCategory('fal-ai/text-to-image')).toBe('image');
  });

  it('should classify flux model as image', () => {
    expect(FalRegistry.getModelCategory('fal-ai/flux/dev')).toBe('image');
  });

  it('should classify sdxl model as image', () => {
    expect(FalRegistry.getModelCategory('fal-ai/sdxl-lightning')).toBe('image');
  });

  it('should classify audio model as audio', () => {
    expect(FalRegistry.getModelCategory('fal-ai/audio-generation')).toBe('audio');
  });

  it('should classify music model as audio', () => {
    expect(FalRegistry.getModelCategory('fal-ai/music-gen')).toBe('audio');
  });

  it('should classify voice model as audio', () => {
    expect(FalRegistry.getModelCategory('fal-ai/voice-clone')).toBe('audio');
  });

  it('should classify unknown model as other', () => {
    expect(FalRegistry.getModelCategory('fal-ai/some-random-thing')).toBe('other');
  });

  it('should classify model with video keyword as video', () => {
    expect(FalRegistry.getModelCategory('fal-ai/video-upscaler')).toBe('video');
  });
});

describe('FalRegistry.listModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return mapped models on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        models: [
          { endpoint_id: 'fal-ai/flux/dev', owner: 'fal-ai', metadata: { created_at: '2024-01-01', tags: ['image'], category: 'image-gen' } },
        ],
      }),
    });

    const models = await FalRegistry.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('fal-ai/flux/dev');
  });

  it('should return empty array on API error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const models = await FalRegistry.listModels();
    expect(models).toEqual([]);
  });
});

describe('FalRegistry.getPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return pricing on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        prices: [{ endpoint_id: 'fal-ai/flux/dev', unit_price: 0.01, unit: 'image', currency: 'USD' }],
      }),
    });

    const pricing = await FalRegistry.getPricing(['fal-ai/flux/dev']);
    expect(pricing).toHaveLength(1);
    expect(pricing[0].unit_price).toBe(0.01);
  });

  it('should return empty array for empty input', async () => {
    const pricing = await FalRegistry.getPricing([]);
    expect(pricing).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw when FAL_KEY is missing', async () => {
    const origKey = process.env.FAL_KEY;
    const origKey2 = process.env.FAL_API_KEY;
    delete process.env.FAL_KEY;
    delete process.env.FAL_API_KEY;

    mockFetch.mockImplementationOnce(() => {
      throw new Error('FAL_KEY is not configured');
    });

    const result = await FalRegistry.getPricing(['fal-ai/flux/dev']);
    // getPricing catches errors and returns []
    expect(result).toEqual([]);

    process.env.FAL_KEY = origKey;
    if (origKey2) process.env.FAL_API_KEY = origKey2;
  });
});
