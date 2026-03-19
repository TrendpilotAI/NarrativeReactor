import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

vi.mock('@fal-ai/client', () => ({
  fal: {
    subscribe: vi.fn(),
  },
}));

vi.mock('../../lib/fal-registry', () => ({
  FalRegistry: {
    getPricing: vi.fn(),
  },
}));

import { fal } from '@fal-ai/client';
import { FalRegistry } from '../../lib/fal-registry';

const mockSubscribe = fal.subscribe as ReturnType<typeof vi.fn>;
const mockGetPricing = FalRegistry.getPricing as ReturnType<typeof vi.fn>;

describe('fal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPricing.mockResolvedValue([{ unit_price: 0.05, unit: 'image' }]);
  });

  describe('generateImage', () => {
    it('happy path — result.data.images[0]', async () => {
      mockSubscribe.mockResolvedValue({
        data: { images: [{ url: 'https://example.com/img.png' }] },
      });
      const { generateImage } = await import('../../lib/fal');
      const result = await generateImage('a cat');
      expect(result.url).toBe('https://example.com/img.png');
      expect(result.cost).toBe(0.05);
    });

    it('fallback — result.images[0]', async () => {
      mockSubscribe.mockResolvedValue({
        images: [{ url: 'https://example.com/fallback.png' }],
      });
      const { generateImage } = await import('../../lib/fal');
      const result = await generateImage('a dog');
      expect(result.url).toBe('https://example.com/fallback.png');
    });

    it('no image URL — throws', async () => {
      mockSubscribe.mockResolvedValue({ data: { images: [] } });
      const { generateImage } = await import('../../lib/fal');
      await expect(generateImage('empty')).rejects.toThrow('Error generating image');
    });

    it('fal.ai error — throws', async () => {
      mockSubscribe.mockRejectedValue(new Error('API down'));
      const { generateImage } = await import('../../lib/fal');
      await expect(generateImage('fail')).rejects.toThrow('Error generating image: API down');
    });

    it('pricing fetch failure — cost is 0', async () => {
      mockSubscribe.mockResolvedValue({
        data: { images: [{ url: 'https://example.com/img.png' }] },
      });
      mockGetPricing.mockRejectedValue(new Error('pricing error'));
      const { generateImage } = await import('../../lib/fal');
      const result = await generateImage('a cat');
      expect(result.cost).toBe(0);
    });
  });

  describe('generateVideo', () => {
    it('happy path — result.data.video.url', async () => {
      mockSubscribe.mockResolvedValue({
        data: { video: { url: 'https://example.com/vid.mp4' } },
      });
      const { generateVideo } = await import('../../lib/fal');
      const result = await generateVideo('a cat running');
      expect(result.url).toBe('https://example.com/vid.mp4');
      expect(result.cost).toBe(0.05);
    });

    it('fallback — result.video.url', async () => {
      mockSubscribe.mockResolvedValue({
        video: { url: 'https://example.com/fallback.mp4' },
      });
      const { generateVideo } = await import('../../lib/fal');
      const result = await generateVideo('a dog running');
      expect(result.url).toBe('https://example.com/fallback.mp4');
    });

    it('no video URL — throws', async () => {
      mockSubscribe.mockResolvedValue({ data: {} });
      const { generateVideo } = await import('../../lib/fal');
      await expect(generateVideo('empty')).rejects.toThrow('Error generating video');
    });

    it('pricing with per-second unit', async () => {
      mockSubscribe.mockResolvedValue({
        data: { video: { url: 'https://example.com/vid.mp4' } },
      });
      mockGetPricing.mockResolvedValue([{ unit_price: 0.01, unit: 'second' }]);
      const { generateVideo } = await import('../../lib/fal');
      const result = await generateVideo('a cat');
      expect(result.cost).toBe(0.05); // 0.01 * 5 seconds
    });
  });
});
