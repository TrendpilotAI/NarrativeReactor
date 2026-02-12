/**
 * Integration tests for assets, orchestration, and osint flows.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestDb, resetTestDb, closeTestDb, createDatabaseMock } from '../../__tests__/helpers/mock-db';

// ── Hoisted mocks ──
const { mockPrompt, mockGenerate, mockGenerateImage, mockGenerateVideo, mockFetch } = vi.hoisted(() => ({
    mockPrompt: vi.fn(),
    mockGenerate: vi.fn(),
    mockGenerateImage: vi.fn(),
    mockGenerateVideo: vi.fn(),
    mockFetch: vi.fn(),
}));

vi.mock('../../genkit.config', () => ({
    ai: {
        defineFlow: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            const flow = async (...args: any[]) => handler(...args);
            flow._config = _config;
            return flow;
        }),
        defineTool: vi.fn((_config: any, handler: (...args: any[]) => any) => {
            const tool = async (...args: any[]) => handler(...args);
            tool._config = _config;
            return tool;
        }),
        prompt: mockPrompt,
        generate: mockGenerate,
    },
}));

vi.mock('../../lib/database', () => createDatabaseMock());

vi.mock('../../lib/fal', () => ({
    generateImage: mockGenerateImage,
    generateVideo: mockGenerateVideo,
}));

// Mock social providers for orchestration flow's agenticChat
vi.mock('../../lib/social-providers', () => ({
    providers: { x: { name: 'X', identifier: 'x' } },
    loadIntegrations: vi.fn().mockResolvedValue({}),
}));

// Import flows AFTER mocks
import { listAssetsFlow, getAssetFlow, deleteAssetFlow } from '../assets';
import { MediaStore } from '../../lib/media-store';

describe('Assets Flow', () => {
    beforeAll(() => setupTestDb());
    afterEach(() => resetTestDb());
    afterAll(() => closeTestDb());

    it('listAssetsFlow returns all assets', async () => {
        MediaStore.save({ type: 'image', url: 'https://img1.com' });
        MediaStore.save({ type: 'video', url: 'https://vid1.com' });

        const result = await listAssetsFlow({ type: 'all' });
        expect(result).toHaveLength(2);
    });

    it('listAssetsFlow filters by type', async () => {
        MediaStore.save({ type: 'image', url: 'https://img1.com' });
        MediaStore.save({ type: 'image', url: 'https://img2.com' });
        MediaStore.save({ type: 'video', url: 'https://vid1.com' });

        const images = await listAssetsFlow({ type: 'image' });
        expect(images).toHaveLength(2);
        images.forEach((a: any) => expect(a.type).toBe('image'));
    });

    it('getAssetFlow returns asset by id', async () => {
        const saved = MediaStore.save({ type: 'image', url: 'https://img.com', prompt: 'hero shot' });

        const result = await getAssetFlow({ id: saved.id });
        expect(result).not.toBeNull();
        expect(result!.url).toBe('https://img.com');
        expect(result!.prompt).toBe('hero shot');
    });

    it('getAssetFlow returns null for missing id', async () => {
        const result = await getAssetFlow({ id: 'non-existent' });
        expect(result).toBeNull();
    });

    it('deleteAssetFlow removes an asset', async () => {
        const saved = MediaStore.save({ type: 'video', url: 'https://vid.com' });

        const result = await deleteAssetFlow({ id: saved.id });
        expect(result.success).toBe(true);

        const check = await getAssetFlow({ id: saved.id });
        expect(check).toBeNull();
    });

    it('deleteAssetFlow returns false for missing id', async () => {
        const result = await deleteAssetFlow({ id: 'non-existent' });
        expect(result.success).toBe(false);
    });
});

// ── OSINT flows ──
// These delegate directly to tools defined in agents.ts, which are also mocked via ai.defineTool
import { osintVisualSearchFlow, osintSentimentFlow, dossierEnrichmentFlow } from '../osint';

describe('OSINT Flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', mockFetch);
        process.env.SERPER_API_KEY = 'test-serper-key';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('osintVisualSearchFlow returns images', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({
                images: [
                    { title: 'Office', imageUrl: 'https://img.com/1.jpg', link: 'https://example.com', source: 'arch' },
                ],
            }),
        });

        const result = await osintVisualSearchFlow({ query: 'Singapore office' });
        expect(result.images).toHaveLength(1);
        expect(result.images[0].title).toBe('Office');
    });

    it('osintSentimentFlow returns discussions', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({
                organic: [
                    { title: 'Reddit thread', snippet: 'People love remote work', link: 'https://reddit.com/r/test' },
                ],
            }),
        });

        const result = await osintSentimentFlow({ topic: 'remote work' });
        expect(result.discussions).toHaveLength(1);
        expect(result.note).toContain('vibe');
    });

    it('dossierEnrichmentFlow returns career insights', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({
                organic: [
                    { snippet: 'Typical tech career in Singapore starts with...' },
                    { snippet: 'Most engineers pursue...' },
                ],
            }),
        });

        const result = await dossierEnrichmentFlow({
            characterName: 'Maya Chen',
            location: 'Singapore',
            occupation: 'Software Engineer',
        });

        expect(result.character).toBe('Maya Chen');
        expect(result.research.careerInsights).toHaveLength(2);
    });

    it('OSINT tools return error when SERPER key is placeholder', async () => {
        process.env.SERPER_API_KEY = 'YOUR_SERPER_API_KEY';

        const result = await osintVisualSearchFlow({ query: 'test' });
        expect(result.error).toContain('SERPER_API_KEY not configured');
    });
});

// ── Orchestration flow (videoGenerationFlow) ──
import { videoGenerationFlow } from '../orchestration';

describe('Video Generation Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock prompt calls for scene/narrative/score
        mockPrompt.mockReturnValue(async (input: any) => ({
            output: { result: 'mocked output', ...input },
        }));

        // Mock image generation for previs
        mockGenerateImage.mockResolvedValue({
            url: 'https://cdn.fal.ai/previs.png',
            modelId: 'fal-ai/hunyuan',
            cost: 0.02,
            duration: 3.0,
        });

        // Mock video generation
        mockGenerateVideo.mockResolvedValue({
            url: 'https://cdn.fal.ai/vid.mp4',
            modelId: 'fal-ai/seedance',
            cost: 0.10,
            duration: 15.0,
        });
    });

    it('orchestrates all tools in parallel and returns complete package', async () => {
        const result = await videoGenerationFlow({
            theme: 'Maya discovers the signal',
            characters: ['Maya', 'Marcus'],
        });

        expect(result.orchestrationStatus).toBe('COMPLETE');
        expect(result.scene).toBeDefined();
        expect(result.narrative).toBeDefined();
        expect(result.score).toBeDefined();
        expect(result.previs).toBeDefined();
        expect(result.timestamp).toBeDefined();
    });

    it('continues even when video generation fails', async () => {
        mockGenerateVideo.mockRejectedValueOnce(new Error('GPU unavailable'));

        const result = await videoGenerationFlow({
            theme: 'Test theme',
            characters: ['Maya'],
        });

        // Flow should still complete
        expect(result.orchestrationStatus).toBe('COMPLETE');
        expect(result.scene).toBeDefined();
    });
});
