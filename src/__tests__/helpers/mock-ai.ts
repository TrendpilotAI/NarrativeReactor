/**
 * Shared mock for the Genkit `ai` object.
 * 
 * Usage in test files:
 * ```ts
 * import { createMockAi, mockGenerate, mockPrompt } from '../helpers/mock-ai';
 * vi.mock('../../genkit.config', () => ({ ai: createMockAi() }));
 * ```
 */
import { vi } from 'vitest';

/**
 * Creates a mock `ai` object that mimics the Genkit AI interface.
 * - `defineFlow` returns a callable async function that runs the handler directly.
 * - `defineTool` returns a callable async function that runs the handler directly.
 * - `generate` returns a deterministic mock response.
 * - `prompt` returns a function that returns `{ output: mockOutput }`.
 */
export function createMockAi(overrides: Partial<MockAiConfig> = {}) {
    const config: MockAiConfig = {
        generateResponse: 'Mock generated content',
        promptOutput: { result: 'mock prompt output' },
        ...overrides,
    };

    return {
        defineFlow: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            // Return the handler itself so it can be called directly in tests
            const flow = async (...args: any[]) => handler(...args);
            flow._config = _config;
            return flow;
        }),

        defineTool: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            // Return the handler itself so it can be called directly in tests
            const tool = async (...args: any[]) => handler(...args);
            tool._config = _config;
            return tool;
        }),

        generate: vi.fn(async (_opts: any) => ({
            text: config.generateResponse,
            output: config.promptOutput,
            message: {
                content: [],
            },
        })),

        prompt: vi.fn((_name: string) => {
            return async (_input: any) => ({
                output: config.promptOutput,
                text: config.generateResponse,
            });
        }),
    };
}

interface MockAiConfig {
    generateResponse: string;
    promptOutput: Record<string, any>;
}

/**
 * Helper to set the next response from `ai.generate()`.
 */
export function setMockGenerateResponse(mockAi: ReturnType<typeof createMockAi>, response: string) {
    mockAi.generate.mockResolvedValueOnce({
        text: response,
        output: null,
        message: { content: [] },
    });
}

/**
 * Helper to set the next response from `ai.generate()` with structured output.
 */
export function setMockGenerateOutput(mockAi: ReturnType<typeof createMockAi>, output: any) {
    mockAi.generate.mockResolvedValueOnce({
        text: '',
        output,
        message: { content: [] },
    });
}
