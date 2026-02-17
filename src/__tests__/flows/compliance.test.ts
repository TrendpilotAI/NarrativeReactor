import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();
const mockDefineFlow = vi.fn((config: any, handler: any) => handler);

vi.mock('../../genkit.config', () => ({
  ai: {
    defineFlow: mockDefineFlow,
    generate: mockGenerate,
  },
}));

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

const mockLoadBrandGuidelines = vi.fn();
vi.mock('../../lib/context', () => ({
  loadBrandGuidelines: mockLoadBrandGuidelines,
}));

const { verifyBrandCompliance } = await import('../../flows/compliance');

describe('verifyBrandCompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadBrandGuidelines.mockResolvedValue('Signal Studio Brand Guidelines');
  });

  it('should return compliance result on success', async () => {
    mockGenerate.mockResolvedValueOnce({
      output: { passed: true, issues: [], score: 98 },
    });

    const result = await verifyBrandCompliance({
      content: 'Great professional content',
      platform: 'twitter',
    });

    expect(result).toEqual({ passed: true, issues: [], score: 98 });
    expect(mockLoadBrandGuidelines).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({ schema: expect.anything() }),
      })
    );
  });

  it('should return failing compliance with issues', async () => {
    mockGenerate.mockResolvedValueOnce({
      output: { passed: false, issues: ['Informal tone', 'Missing CTA'], score: 40 },
    });

    const result = await verifyBrandCompliance({
      content: 'yo check this out lol',
      platform: 'linkedin',
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.score).toBe(40);
  });

  it('should throw when AI returns null output', async () => {
    mockGenerate.mockResolvedValueOnce({ output: null });

    await expect(
      verifyBrandCompliance({ content: 'test', platform: 'twitter' })
    ).rejects.toThrow('Failed to generate compliance report');
  });

  it('should propagate guidelines loading errors', async () => {
    mockLoadBrandGuidelines.mockRejectedValueOnce(new Error('No guidelines file'));

    await expect(
      verifyBrandCompliance({ content: 'test', platform: 'twitter' })
    ).rejects.toThrow('No guidelines file');
  });

  it('should propagate AI generation errors', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('Rate limited'));

    await expect(
      verifyBrandCompliance({ content: 'test', platform: 'twitter' })
    ).rejects.toThrow('Rate limited');
  });

  it('should include platform in the prompt', async () => {
    mockGenerate.mockResolvedValueOnce({
      output: { passed: true, issues: [], score: 90 },
    });

    await verifyBrandCompliance({ content: 'content', platform: 'threads' });

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.prompt).toContain('threads');
  });
});
