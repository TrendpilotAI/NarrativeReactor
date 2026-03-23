/**
 * Integration tests for content-generation and compliance flows.
 * 
 * These mock external APIs (Claude, Genkit generate) but test the
 * flow logic including context loading and compliance verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockLoadContext, mockLoadGuidelines, mockGenerateClaude, mockGenerate } = vi.hoisted(() => ({
    mockLoadContext: vi.fn(),
    mockLoadGuidelines: vi.fn(),
    mockGenerateClaude: vi.fn(),
    mockGenerate: vi.fn(),
}));

// Mock genkit config — defineFlow extracts handler for direct calling
vi.mock('../../genkit.config', () => ({
    ai: {
        defineFlow: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            const flow = async (...args: any[]) => handler(...args);
            flow._config = _config;
            return flow;
        }),
        generate: mockGenerate,
    },
}));

vi.mock('../../lib/context', () => ({
    loadStoryBibleContext: mockLoadContext,
    loadBrandGuidelines: mockLoadGuidelines,
}));

vi.mock('../../lib/claude', () => ({
    generateCopyClaude: mockGenerateClaude,
}));

// Must import compliance before content-gen since content-gen imports compliance
import { verifyBrandCompliance } from '../compliance';
import { generateContentFlow } from '../content-generation';

describe('Content Generation Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadContext.mockResolvedValue('Episode 1.1: Maya discovers the 11-second answer.');
        mockLoadGuidelines.mockResolvedValue('Professional, accessible tone. Signal Studio brand.');
    });

    it('generates content with Claude and runs compliance', async () => {
        mockGenerateClaude.mockResolvedValueOnce('Maya stared at the screen. #SignalStudio');
        mockGenerate.mockResolvedValueOnce({
            output: { passed: true, issues: [], score: 95 },
        });

        const result = await generateContentFlow({
            episodeId: '1.1',
            platform: 'twitter',
            useClaude: true,
        });

        expect(result.content).toBe('Maya stared at the screen. #SignalStudio');
        expect(result.compliance.passed).toBe(true);
        expect(result.metadata.generator).toBe('Claude');
        expect(mockGenerateClaude).toHaveBeenCalledOnce();
    });

    it('generates content with Gemini when useClaude is false', async () => {
        mockGenerate
            .mockResolvedValueOnce({ text: 'Gemini-generated content about Maya.' })
            .mockResolvedValueOnce({ output: { passed: true, issues: [], score: 90 } });

        const result = await generateContentFlow({
            episodeId: '1.1',
            platform: 'linkedin',
            useClaude: false,
        });

        expect(result.content).toBe('Gemini-generated content about Maya.');
        expect(result.metadata.generator).toBe('Gemini');
        expect(mockGenerateClaude).not.toHaveBeenCalled();
    });

    it('passes context and guidelines to claude', async () => {
        mockGenerateClaude.mockResolvedValueOnce('Content');
        mockGenerate.mockResolvedValueOnce({ output: { passed: true, issues: [], score: 85 } });

        await generateContentFlow({ episodeId: '2.1', platform: 'threads', useClaude: true });

        expect(mockGenerateClaude).toHaveBeenCalledWith(
            expect.objectContaining({
                episodeId: '2.1',
                platform: 'threads',
                context: expect.stringContaining('Maya discovers'),
                guidelines: expect.stringContaining('Professional'),
            })
        );
    });
});

describe('Compliance Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadGuidelines.mockResolvedValue('Professional tone. No slang.');
    });

    it('returns compliance result with score', async () => {
        mockGenerate.mockResolvedValueOnce({
            output: { passed: true, issues: [], score: 92 },
        });

        const result = await verifyBrandCompliance({
            content: 'Professional content here.',
            platform: 'twitter',
        });

        expect(result.passed).toBe(true);
        expect(result.score).toBe(92);
    });

    it('throws when generate returns null output', async () => {
        mockGenerate.mockResolvedValueOnce({ output: null });

        await expect(
            verifyBrandCompliance({ content: 'test', platform: 'twitter' })
        ).rejects.toThrow('Failed to generate compliance report');
    });

    it('includes platform and content in the prompt', async () => {
        mockGenerate.mockResolvedValueOnce({
            output: { passed: false, issues: ['Too informal'], score: 40 },
        });

        await verifyBrandCompliance({ content: 'yo check this out', platform: 'linkedin' });

        const callArgs = mockGenerate.mock.calls[0][0];
        expect(callArgs.prompt).toContain('linkedin');
        expect(callArgs.prompt).toContain('yo check this out');
    });
});
