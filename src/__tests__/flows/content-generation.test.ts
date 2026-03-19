import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
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

const mockLoadStoryBibleContext = vi.fn();
const mockLoadBrandGuidelines = vi.fn();
vi.mock('../../lib/context', () => ({
  loadStoryBibleContext: mockLoadStoryBibleContext,
  loadBrandGuidelines: mockLoadBrandGuidelines,
}));

const mockGenerateCopyClaude = vi.fn();
vi.mock('../../lib/claude', () => ({
  generateCopyClaude: mockGenerateCopyClaude,
}));

const mockVerifyBrandCompliance = vi.fn();
vi.mock('../../../src/flows/compliance', () => ({
  verifyBrandCompliance: mockVerifyBrandCompliance,
}));

// Import — defineFlow mock returns the handler directly
const { generateContentFlow } = await import('../../flows/content-generation');

describe('generateContentFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadStoryBibleContext.mockResolvedValue('Story context for episode');
    mockLoadBrandGuidelines.mockResolvedValue('Brand guidelines text');
    mockVerifyBrandCompliance.mockResolvedValue({ passed: true, issues: [], score: 95 });
  });

  it('should generate content with Gemini by default', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'Generated gemini content' });

    const result = await generateContentFlow({
      episodeId: '1.1',
      platform: 'twitter',
      useClaude: false,
    });

    expect(mockLoadStoryBibleContext).toHaveBeenCalledWith('1.1');
    expect(mockLoadBrandGuidelines).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(result.content).toBe('Generated gemini content');
    expect(result.metadata.generator).toBe('Gemini');
    expect(result.compliance.passed).toBe(true);
  });

  it('should use Claude when useClaude is true', async () => {
    mockGenerateCopyClaude.mockResolvedValueOnce('Claude generated content');

    const result = await generateContentFlow({
      episodeId: '2.1',
      platform: 'linkedin',
      useClaude: true,
    });

    expect(mockGenerateCopyClaude).toHaveBeenCalledWith({
      episodeId: '2.1',
      platform: 'linkedin',
      context: 'Story context for episode',
      guidelines: 'Brand guidelines text',
    });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result.content).toBe('Claude generated content');
    expect(result.metadata.generator).toBe('Claude');
  });

  it('should return compliance issues when compliance fails', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'Bad content' });
    mockVerifyBrandCompliance.mockResolvedValueOnce({
      passed: false,
      issues: ['Tone mismatch', 'Banned word detected'],
      score: 30,
    });

    const result = await generateContentFlow({
      episodeId: '1.1',
      platform: 'threads',
      useClaude: false,
    });

    expect(result.compliance.passed).toBe(false);
    expect(result.compliance.issues).toEqual(['Tone mismatch', 'Banned word detected']);
  });

  it('should propagate context loading errors', async () => {
    mockLoadStoryBibleContext.mockRejectedValueOnce(new Error('File not found'));

    await expect(
      generateContentFlow({ episodeId: '99.99', platform: 'twitter', useClaude: false })
    ).rejects.toThrow('File not found');
  });

  it('should propagate AI generation errors', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('Model overloaded'));

    await expect(
      generateContentFlow({ episodeId: '1.1', platform: 'twitter', useClaude: false })
    ).rejects.toThrow('Model overloaded');
  });

  it('should include episodeId in metadata', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'content' });

    const result = await generateContentFlow({
      episodeId: '3.5',
      platform: 'twitter',
      useClaude: false,
    });

    expect(result.metadata.episodeId).toBe('3.5');
  });
});
