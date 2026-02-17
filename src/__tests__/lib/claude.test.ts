import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class {
      messages = { create: mockCreate };
    },
  };
});

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

// Dynamic import to ensure mocks are registered first
const { generateCopyClaude } = await import('../../lib/claude');

describe('generateCopyClaude', () => {
  const baseInput = {
    episodeId: '1.1',
    platform: 'twitter' as const,
    context: 'Maya discovers the Signal Protocol.',
    guidelines: 'Professional tone. No jargon.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return generated text on success', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '🚀 Maya unlocks the future. #SignalStudio #AI' }],
    });

    const result = await generateCopyClaude(baseInput);

    expect(result).toBe('🚀 Maya unlocks the future. #SignalStudio #AI');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        system: expect.stringContaining('Professional tone'),
      })
    );
  });

  it('should include TWITTER and 280 chars in system prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'output' }],
    });

    await generateCopyClaude(baseInput);

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('TWITTER');
    expect(call.system).toContain('280 chars');
  });

  it('should include LINKEDIN and Thought leadership for linkedin platform', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'output' }],
    });

    await generateCopyClaude({ ...baseInput, platform: 'linkedin' });

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('LINKEDIN');
    expect(call.system).toContain('Thought leadership');
  });

  it('should include THREADS for threads platform', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'output' }],
    });

    await generateCopyClaude({ ...baseInput, platform: 'threads' });

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('THREADS');
  });

  it('should return error string when API throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Rate limited'));

    const result = await generateCopyClaude(baseInput);
    expect(result).toContain('Error generating copy with Claude');
  });

  it('should return error when response has no text block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    });

    const result = await generateCopyClaude(baseInput);
    expect(result).toContain('Error: No text returned');
  });
});
