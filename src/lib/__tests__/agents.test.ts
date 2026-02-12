/**
 * Unit tests for src/lib/agents.ts
 * 
 * Tests the 12 AI tools defined as Genkit tools.
 * The Genkit `ai` object, external APIs (Fal, social providers, Serper), 
 * are all mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockPrompt, mockLoadIntegrations, mockGenerateImage, mockGenerateVideo, mockFetch } = vi.hoisted(() => ({
    mockPrompt: vi.fn(),
    mockLoadIntegrations: vi.fn(),
    mockGenerateImage: vi.fn(),
    mockGenerateVideo: vi.fn(),
    mockFetch: vi.fn(),
}));

// Mock the genkit config — defineTool extracts the handler so we can call it directly
vi.mock('../../genkit.config', () => ({
    ai: {
        defineTool: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            // Return the handler so the exported tool IS the handler
            const tool = async (...args: any[]) => handler(...args);
            tool._config = _config;
            return tool;
        }),
        prompt: mockPrompt,
    },
}));

vi.mock('../social-providers', () => ({
    providers: {
        x: {
            name: 'X',
            identifier: 'x',
            post: vi.fn().mockResolvedValue({ postId: 'tweet-1', releaseURL: 'https://x.com/test/1', status: 'posted' }),
            getAnalytics: vi.fn().mockResolvedValue([{ label: 'Impressions', value: 100 }]),
        },
    },
    loadIntegrations: mockLoadIntegrations,
}));

vi.mock('../fal', () => ({
    generateImage: mockGenerateImage,
    generateVideo: mockGenerateVideo,
}));

// Now import the agents module — defineTool returns the handler
import * as agents from '../agents';

describe('agents.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', mockFetch);

        // Default prompt mock
        mockPrompt.mockReturnValue(async (input: any) => ({
            output: { result: 'mocked output', input },
        }));
    });

    describe('Prompt-based tools', () => {
        it('sceneGenerationTool calls scene-gen prompt and returns output', async () => {
            const result = await agents.sceneGenerationTool({
                storyContext: 'Maya discovers the truth',
                characters: ['Maya', 'Marcus'],
                location: 'Singapore office',
            });

            expect(mockPrompt).toHaveBeenCalledWith('scene-gen');
            expect(result).toBeDefined();
        });

        it('narrativeAssemblyTool calls narrative-assembly prompt', async () => {
            const result = await agents.narrativeAssemblyTool({
                prompt: 'Dialogue for the confrontation',
                availableCharacters: ['Maya', 'Elena'],
            });

            expect(mockPrompt).toHaveBeenCalledWith('narrative-assembly');
            expect(result).toBeDefined();
        });

        it('scoreGenTool calls score-gen prompt', async () => {
            const result = await agents.scoreGenTool({
                mood: 'tense',
                intensity: 8,
            });

            expect(mockPrompt).toHaveBeenCalledWith('score-gen');
            expect(result).toBeDefined();
        });
    });

    describe('previsImageTool', () => {
        it('generates image via Fal and returns result', async () => {
            mockGenerateImage.mockResolvedValueOnce({
                url: 'https://cdn.fal.ai/previs.png',
                modelId: 'fal-ai/hunyuan',
                cost: 0.02,
                duration: 5.0,
            });

            const result = await agents.previsImageTool({
                composition: 'Wide angle establishing shot',
                subject: 'futuristic Singapore skyline',
            });

            expect(result.imageUrl).toBe('https://cdn.fal.ai/previs.png');
            expect(result.status).toBe('generated');
            expect(mockGenerateImage).toHaveBeenCalledOnce();
            // Verify the prompt is composed correctly
            const prompt = mockGenerateImage.mock.calls[0][0];
            expect(prompt).toContain('Wide angle establishing shot');
            expect(prompt).toContain('futuristic Singapore skyline');
        });

        it('returns error on generation failure', async () => {
            mockGenerateImage.mockRejectedValueOnce(new Error('GPU capacity exceeded'));

            const result = await agents.previsImageTool({
                composition: 'test',
                subject: 'test',
            });

            expect(result.error).toContain('GPU capacity exceeded');
        });
    });

    describe('Social tools', () => {
        it('socialPostTool posts when integration exists', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({
                x: { accessToken: 'test-token' },
            });

            const result = await agents.socialPostTool({
                provider: 'x',
                message: 'Hello world!',
            });

            expect(result.postId).toBe('tweet-1');
            expect(result.status).toBe('posted');
        });

        it('socialPostTool returns error when no integration', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({});

            const result = await agents.socialPostTool({
                provider: 'x',
                message: 'Hello!',
            });

            expect(result.error).toContain('No account connected');
        });

        it('listIntegrationsTool lists all providers with status', async () => {
            mockLoadIntegrations.mockResolvedValueOnce({
                x: { username: 'testuser' },
            });

            const result = await agents.listIntegrationsTool();

            expect(result).toHaveLength(1); // Only 'x' is defined in our mock
            expect(result[0].provider).toBe('x');
            expect(result[0].connected).toBe(true);
        });
    });

    describe('OSINT tools', () => {
        it('osintResearchTool returns error when API key not configured', async () => {
            const origKey = process.env.SERPER_API_KEY;
            process.env.SERPER_API_KEY = 'YOUR_SERPER_API_KEY';

            const result = await agents.osintResearchTool({
                query: 'test query',
                category: 'general',
            });

            expect(result.error).toContain('SERPER_API_KEY not configured');
            process.env.SERPER_API_KEY = origKey;
        });

        it('osintResearchTool fetches results from Serper API', async () => {
            process.env.SERPER_API_KEY = 'test-serper-key';
            mockFetch.mockResolvedValueOnce({
                json: async () => ({
                    organic: [
                        { title: 'Result 1', snippet: 'Snippet 1', link: 'https://example.com' },
                        { title: 'Result 2', snippet: 'Snippet 2', link: 'https://example2.com' },
                    ],
                }),
            });

            const result = await agents.osintResearchTool({
                query: 'tech trends Singapore',
                category: 'trend',
            });

            expect(result.results).toHaveLength(2);
            expect(result.results[0].title).toBe('Result 1');
            expect(mockFetch).toHaveBeenCalledOnce();
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('serper.dev');
            expect(options.headers['X-API-KEY']).toBe('test-serper-key');
        });

        it('osintVisualSearchTool fetches images from Serper', async () => {
            process.env.SERPER_API_KEY = 'test-serper-key';
            mockFetch.mockResolvedValueOnce({
                json: async () => ({
                    images: Array.from({ length: 15 }, (_, i) => ({
                        title: `Image ${i}`,
                        imageUrl: `https://img${i}.com`,
                        link: `https://link${i}.com`,
                        source: `source${i}`,
                    })),
                }),
            });

            const result = await agents.osintVisualSearchTool({
                query: 'Singapore futuristic office',
            });

            // Should be capped at 10 results
            expect(result.images).toHaveLength(10);
        });
    });

    describe('videoGenTool', () => {
        it('generates video via Fal and returns result', async () => {
            mockGenerateVideo.mockResolvedValueOnce({
                url: 'https://cdn.fal.ai/video.mp4',
                modelId: 'fal-ai/seedance',
                cost: 0.10,
                duration: 15.0,
            });

            const result = await agents.videoGenTool({
                sceneDescription: 'A car chase through neon-lit streets',
            });

            expect(result.videoUrl).toBe('https://cdn.fal.ai/video.mp4');
            expect(result.status).toBe('generated');
        });

        it('returns error on video generation failure', async () => {
            mockGenerateVideo.mockRejectedValueOnce(new Error('Model unavailable'));

            const result = await agents.videoGenTool({
                sceneDescription: 'test',
            });

            expect(result.error).toContain('Model unavailable');
        });
    });
});
