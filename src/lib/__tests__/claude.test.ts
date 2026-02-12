/**
 * Unit tests for src/lib/claude.ts
 * 
 * Tests the Anthropic Claude API integration for copy generation.
 * The Anthropic SDK is fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted() so the mock fn is available when vi.mock factory runs (hoisted above imports)
const { mockCreate } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
}));

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(() => ({
        messages: {
            create: mockCreate,
        },
    })),
}));

import { generateCopyClaude, GenerateCopySchema } from '../claude';

const validInput = {
    episodeId: '1.1',
    platform: 'twitter' as const,
    context: 'Maya discovers the 11-second answer.',
    guidelines: 'Professional, accessible tone.',
};

describe('claude.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GenerateCopySchema', () => {
        it('validates correct input', () => {
            const result = GenerateCopySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('rejects invalid platform', () => {
            const result = GenerateCopySchema.safeParse({
                ...validInput,
                platform: 'tiktok',
            });
            expect(result.success).toBe(false);
        });

        it('rejects missing required fields', () => {
            const result = GenerateCopySchema.safeParse({
                episodeId: '1.1',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('generateCopyClaude()', () => {
        it('calls anthropic.messages.create with correct model', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [{ type: 'text', text: 'Generated tweet about Maya.' }],
            });

            await generateCopyClaude(validInput);

            expect(mockCreate).toHaveBeenCalledOnce();
            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.model).toBe('claude-sonnet-4-20250514');
            expect(callArgs.max_tokens).toBe(1024);
        });

        it('includes platform-specific constraints in the system prompt', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [{ type: 'text', text: 'Tweet content' }],
            });

            await generateCopyClaude(validInput);

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.system).toContain('TWITTER');
            expect(callArgs.system).toContain('280 chars');

            // Test LinkedIn too
            mockCreate.mockResolvedValueOnce({
                content: [{ type: 'text', text: 'LinkedIn content' }],
            });

            await generateCopyClaude({ ...validInput, platform: 'linkedin' });
            const linkedInCall = mockCreate.mock.calls[1][0];
            expect(linkedInCall.system).toContain('LINKEDIN');
            expect(linkedInCall.system).toContain('3000 chars');
        });

        it('returns text content from the response', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [{ type: 'text', text: 'Maya stared at the screen. 11 seconds. #SignalStudio #Innovation' }],
            });

            const result = await generateCopyClaude(validInput);
            expect(result).toBe('Maya stared at the screen. 11 seconds. #SignalStudio #Innovation');
        });

        it('returns error message when content type is not text', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [{ type: 'tool_use', id: 'tool_1', name: 'test', input: {} }],
            });

            const result = await generateCopyClaude(validInput);
            expect(result).toContain('Error');
        });

        it('handles API errors gracefully without throwing', async () => {
            mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

            const result = await generateCopyClaude(validInput);
            expect(result).toContain('Error generating copy with Claude');
        });

        it('includes brand guidelines and context in the API call', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [{ type: 'text', text: 'Content' }],
            });

            await generateCopyClaude(validInput);

            const callArgs = mockCreate.mock.calls[0][0];
            // System prompt should contain guidelines
            expect(callArgs.system).toContain('Professional, accessible tone.');
            // User message should contain context and episode
            const userMessage = callArgs.messages[0].content;
            expect(userMessage).toContain('1.1');
            expect(userMessage).toContain('Maya discovers');
        });
    });
});
