import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockPromptFn = vi.fn();
const mockPrompt = vi.fn().mockReturnValue(mockPromptFn);

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

vi.mock('../../genkit.config', () => ({
  ai: {
    defineTool: (_config: any, handler: Function) => handler,
    prompt: mockPrompt,
  },
}));

const mockGenerateImage = vi.fn();
const mockGenerateVideo = vi.fn();
vi.mock('../../lib/fal', () => ({
  generateImage: mockGenerateImage,
  generateVideo: mockGenerateVideo,
}));

const mockLoadIntegrations = vi.fn();
const mockProviders: Record<string, any> = {
  x: {
    name: 'X (Twitter)',
    post: vi.fn(),
    getAnalytics: vi.fn(),
  },
  linkedin: {
    name: 'LinkedIn',
    post: vi.fn(),
    getAnalytics: vi.fn(),
  },
};

vi.mock('../../lib/social-providers', () => ({
  loadIntegrations: (...args: any[]) => mockLoadIntegrations(...args),
  providers: mockProviders,
}));

// We need to mock global fetch for osintResearchTool
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// --- Import tools (after mocks) ---
const {
  sceneGenerationTool,
  narrativeAssemblyTool,
  scoreGenTool,
  previsImageTool,
  socialPostTool,
  socialPerformanceTool,
  listIntegrationsTool,
  osintResearchTool,
  videoGenTool,
} = await import('../../lib/agents');

// --- Tests ---

describe('Agent Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // 1. sceneGenerationTool
  // =============================================
  describe('sceneGenerationTool', () => {
    const input = {
      storyContext: 'A dystopian city at night',
      characters: ['Maya', 'Kai'],
      location: 'Rooftop',
    };

    it('should call scene-gen prompt and return output', async () => {
      const mockOutput = { scene: 'rooftop', lighting: 'neon' };
      mockPrompt.mockReturnValue(mockPromptFn);
      mockPromptFn.mockResolvedValue({ output: mockOutput });

      const result = await sceneGenerationTool(input);

      expect(mockPrompt).toHaveBeenCalledWith('scene-gen');
      expect(mockPromptFn).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockOutput);
    });

    it('should propagate errors from prompt', async () => {
      mockPromptFn.mockRejectedValue(new Error('Prompt failed'));

      await expect(sceneGenerationTool(input)).rejects.toThrow('Prompt failed');
    });
  });

  // =============================================
  // 2. narrativeAssemblyTool
  // =============================================
  describe('narrativeAssemblyTool', () => {
    const input = {
      prompt: 'Maya confronts the antagonist',
      availableCharacters: ['Maya', 'Kai', 'Villain'],
    };

    it('should call narrative-assembly prompt and return output', async () => {
      const mockOutput = { beats: [{ character: 'Maya', dialogue: 'I know your secret.' }] };
      mockPromptFn.mockResolvedValue({ output: mockOutput });

      const result = await narrativeAssemblyTool(input);

      expect(mockPrompt).toHaveBeenCalledWith('narrative-assembly');
      expect(mockPromptFn).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockOutput);
    });

    it('should propagate errors from prompt', async () => {
      mockPromptFn.mockRejectedValue(new Error('Assembly failed'));

      await expect(narrativeAssemblyTool(input)).rejects.toThrow('Assembly failed');
    });
  });

  // =============================================
  // 3. scoreGenTool
  // =============================================
  describe('scoreGenTool', () => {
    const input = { mood: 'tense', intensity: 7 };

    it('should call score-gen prompt and return output', async () => {
      const mockOutput = { instruments: ['strings', 'synth'], tempo: 120 };
      mockPromptFn.mockResolvedValue({ output: mockOutput });

      const result = await scoreGenTool(input);

      expect(mockPrompt).toHaveBeenCalledWith('score-gen');
      expect(result).toEqual(mockOutput);
    });

    it('should propagate errors from prompt', async () => {
      mockPromptFn.mockRejectedValue(new Error('Score gen failed'));

      await expect(scoreGenTool(input)).rejects.toThrow('Score gen failed');
    });
  });

  // =============================================
  // 4. previsImageTool
  // =============================================
  describe('previsImageTool', () => {
    const input = { composition: 'wide shot', subject: 'cyberpunk city' };

    it('should generate image and return result', async () => {
      mockGenerateImage.mockResolvedValue({
        url: 'https://fal.ai/img.png',
        modelId: 'hunyuan-image/v3',
        cost: 0.05,
        duration: 3.2,
      });

      const result = await previsImageTool(input);

      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.stringContaining('cyberpunk city'),
        undefined
      );
      expect(result).toEqual({
        prompt: expect.stringContaining('wide shot'),
        imageUrl: 'https://fal.ai/img.png',
        modelId: 'hunyuan-image/v3',
        cost: 0.05,
        duration: 3.2,
        status: 'generated',
      });
    });

    it('should pass custom modelId', async () => {
      mockGenerateImage.mockResolvedValue({ url: 'x', modelId: 'custom', cost: 0, duration: 0 });

      await previsImageTool({ ...input, modelId: 'custom-model' });

      expect(mockGenerateImage).toHaveBeenCalledWith(expect.any(String), 'custom-model');
    });

    it('should return error object on failure', async () => {
      mockGenerateImage.mockRejectedValue(new Error('FAL API down'));

      const result = await previsImageTool(input);

      expect(result).toEqual({ error: 'FAL API down' });
    });
  });

  // =============================================
  // 5. socialPostTool
  // =============================================
  describe('socialPostTool', () => {
    it('should post to connected provider', async () => {
      mockLoadIntegrations.mockResolvedValue({
        x: { accessToken: 'tok-123', username: 'user1' },
      });
      mockProviders.x.post.mockResolvedValue({ id: 'post-1', url: 'https://x.com/post/1' });

      const result = await socialPostTool({ provider: 'x', message: 'Hello world' });

      expect(mockProviders.x.post).toHaveBeenCalledWith('tok-123', 'Hello world');
      expect(result).toEqual({ id: 'post-1', url: 'https://x.com/post/1' });
    });

    it('should return error for unconnected provider', async () => {
      mockLoadIntegrations.mockResolvedValue({});

      const result = await socialPostTool({ provider: 'x', message: 'Hello' });

      expect(result).toEqual({ error: 'No account connected for x' });
    });
  });

  // =============================================
  // 6. socialPerformanceTool
  // =============================================
  describe('socialPerformanceTool', () => {
    it('should return analytics for connected provider', async () => {
      mockLoadIntegrations.mockResolvedValue({
        x: { accessToken: 'tok-123', username: 'user1' },
      });
      const analytics = { followers: 1000, impressions: 5000 };
      mockProviders.x.getAnalytics.mockResolvedValue(analytics);

      const result = await socialPerformanceTool({ provider: 'x', days: 14 });

      expect(mockProviders.x.getAnalytics).toHaveBeenCalledWith('tok-123', 14);
      expect(result).toEqual(analytics);
    });

    it('should return error for unconnected provider', async () => {
      mockLoadIntegrations.mockResolvedValue({});

      const result = await socialPerformanceTool({ provider: 'linkedin', days: 7 });

      expect(result).toEqual({ error: 'No account connected for linkedin' });
    });
  });

  // =============================================
  // 7. listIntegrationsTool
  // =============================================
  describe('listIntegrationsTool', () => {
    it('should list all providers with connection status', async () => {
      mockLoadIntegrations.mockResolvedValue({
        x: { accessToken: 'tok', username: 'myuser' },
      });

      const result = await listIntegrationsTool();

      expect(result).toEqual(
        expect.arrayContaining([
          { provider: 'x', name: 'X (Twitter)', connected: true, username: 'myuser' },
          { provider: 'linkedin', name: 'LinkedIn', connected: false, username: '' },
        ])
      );
    });

    it('should show all disconnected when no integrations', async () => {
      mockLoadIntegrations.mockResolvedValue({});

      const result = await listIntegrationsTool();

      for (const item of result as any[]) {
        expect(item.connected).toBe(false);
        expect(item.username).toBe('');
      }
    });
  });

  // =============================================
  // 8. osintResearchTool
  // =============================================
  describe('osintResearchTool', () => {
    it('should perform search and return formatted results', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          organic: [
            { title: 'Result 1', snippet: 'Snippet 1', link: 'https://example.com/1' },
            { title: 'Result 2', snippet: 'Snippet 2', link: 'https://example.com/2' },
          ],
        }),
      });

      const result = await osintResearchTool({ query: 'cyberpunk trends', category: 'trend' });

      expect(mockFetch).toHaveBeenCalledWith('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': 'test-serper-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: 'cyberpunk trends' }),
      });
      expect(result).toEqual({
        query: 'cyberpunk trends',
        category: 'trend',
        results: [
          { title: 'Result 1', snippet: 'Snippet 1', link: 'https://example.com/1' },
          { title: 'Result 2', snippet: 'Snippet 2', link: 'https://example.com/2' },
        ],
      });
    });

    it('should return empty results when no organic results', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const result = await osintResearchTool({ query: 'nothing', category: 'general' });

      expect((result as any).results).toEqual([]);
    });

    it('should return error when SERPER_API_KEY is missing', async () => {
      const original = process.env.SERPER_API_KEY;
      process.env.SERPER_API_KEY = 'YOUR_SERPER_API_KEY';

      const result = await osintResearchTool({ query: 'test', category: 'general' });

      expect((result as any).error).toContain('SERPER_API_KEY not configured');
      process.env.SERPER_API_KEY = original;
    });

    it('should return error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await osintResearchTool({ query: 'test', category: 'general' });

      expect((result as any).error).toContain('Failed to perform OSINT research');
    });
  });

  // =============================================
  // 9. videoGenTool
  // =============================================
  describe('videoGenTool', () => {
    const input = { sceneDescription: 'A spaceship launching into orbit' };

    it('should generate video and return result', async () => {
      mockGenerateVideo.mockResolvedValue({
        url: 'https://fal.ai/video.mp4',
        modelId: 'seedance-1.5-pro',
        cost: 0.25,
        duration: 12.5,
      });

      const result = await videoGenTool(input);

      expect(mockGenerateVideo).toHaveBeenCalledWith(input.sceneDescription, undefined, undefined);
      expect(result).toEqual({
        prompt: input.sceneDescription,
        videoUrl: 'https://fal.ai/video.mp4',
        modelId: 'seedance-1.5-pro',
        cost: 0.25,
        duration: 12.5,
        status: 'generated',
      });
    });

    it('should pass imageUrl and modelId when provided', async () => {
      mockGenerateVideo.mockResolvedValue({ url: 'x', modelId: 'm', cost: 0, duration: 0 });

      await videoGenTool({
        ...input,
        imageUrl: 'https://img.png',
        modelId: 'custom-video-model',
      });

      expect(mockGenerateVideo).toHaveBeenCalledWith(
        input.sceneDescription,
        'https://img.png',
        'custom-video-model'
      );
    });

    it('should return error object on failure', async () => {
      mockGenerateVideo.mockRejectedValue(new Error('Video gen failed'));

      const result = await videoGenTool(input);

      expect(result).toEqual({ error: 'Video gen failed' });
    });
  });
});
