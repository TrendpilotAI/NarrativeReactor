import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks (outermost boundary) ──────────────────────────────

const mockGenerate = vi.fn();
const mockPrompt = vi.fn();
const mockDefineFlow = vi.fn((_config: any, handler: any) => handler);
const mockDefineTool = vi.fn((_config: any, handler: any) => handler);

vi.mock('../../genkit.config', () => ({
  ai: {
    defineFlow: mockDefineFlow,
    defineTool: mockDefineTool,
    generate: mockGenerate,
    prompt: mockPrompt,
  },
}));

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

// Mock external APIs at the boundary
const mockGenerateImage = vi.fn();
const mockGenerateVideo = vi.fn();
vi.mock('../../lib/fal', () => ({
  generateImage: mockGenerateImage,
  generateVideo: mockGenerateVideo,
}));

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

const mockSaveIntegration = vi.fn();
const mockLoadIntegrations = vi.fn();

const mockXProvider = {
  identifier: 'x',
  name: 'X',
  generateAuthUrl: vi.fn(),
  authenticate: vi.fn(),
  post: vi.fn(),
  getAnalytics: vi.fn(),
  getMentions: vi.fn(),
};

vi.mock('../../lib/social-providers', () => ({
  providers: { x: mockXProvider },
  saveIntegration: mockSaveIntegration,
  loadIntegrations: mockLoadIntegrations,
}));

// ── Import flows (defineFlow mock returns handlers directly) ──────

const { generateContentFlow } = await import('../../flows/content-generation');
const { verifyBrandCompliance } = await import('../../flows/compliance');
const { videoGenerationFlow, agenticChatFlow } = await import('../../flows/orchestration');
const {
  getAuthUrlFlow,
  connectSocialAccountFlow,
  postToSocialFlow,
  getPerformanceDataFlow,
  getMentionsFlow,
  listIntegrationsFlow,
} = await import('../../flows/integrations');

// ── Tests ──────────────────────────────────────────────────────────

describe('E2E: Content Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadStoryBibleContext.mockResolvedValue('Episode 1.1: Maya discovers the signal.');
    mockLoadBrandGuidelines.mockResolvedValue('Professional tone. No slang.');
  });

  it('should run full pipeline: context → generation (Gemini) → compliance → structured result', async () => {
    mockGenerate
      .mockResolvedValueOnce({ text: 'Maya discovers a hidden signal in the noise.' }) // content gen
      .mockResolvedValueOnce({ output: { passed: true, issues: [], score: 95 } }); // compliance

    const result = await generateContentFlow({
      episodeId: '1.1',
      platform: 'twitter',
      useClaude: false,
    });

    // Context was loaded
    expect(mockLoadStoryBibleContext).toHaveBeenCalledWith('1.1');
    expect(mockLoadBrandGuidelines).toHaveBeenCalledTimes(2); // once for content, once for compliance

    // Content was generated
    expect(result.content).toBe('Maya discovers a hidden signal in the noise.');
    expect(result.metadata.generator).toBe('Gemini');

    // Compliance ran on generated content
    expect(result.compliance.passed).toBe(true);
    expect(result.compliance.issues).toEqual([]);
  });

  it('should run full pipeline with Claude and catch compliance failures', async () => {
    mockGenerateCopyClaude.mockResolvedValueOnce('yo check this lol');
    mockGenerate.mockResolvedValueOnce({
      output: { passed: false, issues: ['Informal tone', 'Slang detected'], score: 25 },
    });

    const result = await generateContentFlow({
      episodeId: '2.1',
      platform: 'linkedin',
      useClaude: true,
    });

    expect(result.content).toBe('yo check this lol');
    expect(result.metadata.generator).toBe('Claude');
    expect(result.compliance.passed).toBe(false);
    expect(result.compliance.issues).toContain('Informal tone');
  });

  it('should propagate context loading errors through the full pipeline', async () => {
    mockLoadStoryBibleContext.mockRejectedValueOnce(new Error('Story bible not found'));

    await expect(
      generateContentFlow({ episodeId: '99.99', platform: 'twitter', useClaude: false })
    ).rejects.toThrow('Story bible not found');
  });
});

describe('E2E: Video Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock all 4 prompt-based tools (scene, narrative, score return via ai.prompt)
    const mockPromptFn = vi.fn();
    mockPrompt.mockReturnValue(mockPromptFn);

    mockPromptFn
      .mockResolvedValueOnce({ output: { scene: 'A dimly lit control room', characters: ['Maya'] } })
      .mockResolvedValueOnce({ output: { beats: ['Discovery', 'Tension', 'Reveal'], dialogue: ['Maya: "What is this?"'] } })
      .mockResolvedValueOnce({ output: { track: 'Ambient Pulse', bpm: 90 } });

    // previs uses generateImage
    mockGenerateImage.mockResolvedValue({
      url: 'https://fal.ai/image/abc123.png',
      modelId: 'hunyuan-image/v3',
      cost: 0.02,
      duration: 3.5,
    });

    // video gen uses generateVideo
    mockGenerateVideo.mockResolvedValue({
      url: 'https://fal.ai/video/xyz789.mp4',
      modelId: 'seedance-1.5-pro',
      cost: 0.15,
      duration: 12.0,
    });
  });

  it('should orchestrate 4 parallel tools then sequential video generation', async () => {
    const result = await videoGenerationFlow({
      theme: 'Signal Discovery',
      characters: ['Maya Chen', 'Marcus'],
    });

    // All parallel tools were invoked
    expect(mockPrompt).toHaveBeenCalledWith('scene-gen');
    expect(mockPrompt).toHaveBeenCalledWith('narrative-assembly');
    expect(mockPrompt).toHaveBeenCalledWith('score-gen');
    expect(mockGenerateImage).toHaveBeenCalled();

    // Sequential video was generated using previs output
    expect(mockGenerateVideo).toHaveBeenCalled();

    // Final result has all components
    expect(result.scene).toEqual({ scene: 'A dimly lit control room', characters: ['Maya'] });
    expect(result.narrative).toEqual({ beats: ['Discovery', 'Tension', 'Reveal'], dialogue: ['Maya: "What is this?"'] });
    expect(result.score).toEqual({ track: 'Ambient Pulse', bpm: 90 });
    expect(result.previs).toMatchObject({ imageUrl: 'https://fal.ai/image/abc123.png', status: 'generated' });
    expect(result.orchestrationStatus).toBe('COMPLETE');
    expect(result.timestamp).toBeDefined();
  });

  it('should complete even if video generation fails', async () => {
    const mockPromptFn = vi.fn();
    mockPrompt.mockReturnValue(mockPromptFn);
    mockPromptFn
      .mockResolvedValueOnce({ output: { scene: 'test' } })
      .mockResolvedValueOnce({ output: { beats: [] } })
      .mockResolvedValueOnce({ output: { track: 'test' } });

    mockGenerateImage.mockResolvedValue({ url: 'https://fal.ai/img.png', modelId: 'x', cost: 0, duration: 1 });
    mockGenerateVideo.mockRejectedValue(new Error('GPU timeout'));

    const result = await videoGenerationFlow({
      theme: 'Fallback test',
      characters: ['Maya'],
    });

    // Pipeline completes despite video failure
    expect(result.orchestrationStatus).toBe('COMPLETE');
    expect(result.scene).toBeDefined();
  });
});

describe('E2E: Social Publishing Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full lifecycle: auth → connect → post → analytics → mentions', async () => {
    // Step 1: Get auth URL
    mockXProvider.generateAuthUrl.mockResolvedValue({
      url: 'https://api.twitter.com/oauth/authenticate?oauth_token=abc',
      codeVerifier: 'token123:secret456',
      state: 'token123',
    });

    const authResult = await getAuthUrlFlow({ provider: 'x' });
    expect(authResult.url).toContain('twitter.com');
    expect(authResult.codeVerifier).toBeDefined();

    // Step 2: Connect account (simulate callback)
    mockXProvider.authenticate.mockResolvedValue({
      id: 'user_123',
      name: 'Signal Studio',
      username: 'signalstudio',
      accessToken: 'access:secret',
      picture: 'https://pbs.twimg.com/pic.jpg',
    });
    mockSaveIntegration.mockResolvedValue(undefined);

    const connectResult = await connectSocialAccountFlow({
      provider: 'x',
      code: 'oauth_verifier_abc',
      codeVerifier: authResult.codeVerifier,
    });
    expect(connectResult.success).toBe(true);
    expect(connectResult.account.username).toBe('signalstudio');
    expect(mockSaveIntegration).toHaveBeenCalledWith('x', expect.objectContaining({ id: 'user_123' }));

    // Step 3: Post content
    mockLoadIntegrations.mockResolvedValue({
      x: { accessToken: 'access:secret', username: 'signalstudio' },
    });
    mockXProvider.post.mockResolvedValue({
      postId: 'tweet_789',
      releaseURL: 'https://x.com/signalstudio/status/tweet_789',
      status: 'posted',
    });

    const postResult = await postToSocialFlow({
      provider: 'x',
      message: 'Maya discovers the signal. Episode 1 drops now. 🎬',
    });
    expect(postResult.success).toBe(true);
    expect(postResult.postId).toBe('tweet_789');

    // Step 4: Get performance data
    mockXProvider.getAnalytics.mockResolvedValue([
      { label: 'Impressions', value: 12500, change: '+12%' },
      { label: 'Likes', value: 340, change: '+5%' },
    ]);

    const perfResult = await getPerformanceDataFlow({ provider: 'x', days: 7 });
    expect(perfResult).toHaveLength(2);
    expect(perfResult[0].label).toBe('Impressions');

    // Step 5: Get mentions
    mockXProvider.getMentions.mockResolvedValue([
      {
        id: 'mention_1',
        text: '@signalstudio this is incredible!',
        createdAt: '2026-02-17T04:00:00Z',
        author: { name: 'Fan', username: 'superfan', avatar: 'https://pic.jpg' },
      },
    ]);

    const mentions = await getMentionsFlow({ provider: 'x' });
    expect(mentions).toHaveLength(1);
    expect(mentions[0].text).toContain('@signalstudio');
  });

  it('should fail gracefully when provider not connected', async () => {
    mockLoadIntegrations.mockResolvedValue({});

    await expect(
      postToSocialFlow({ provider: 'x', message: 'test' })
    ).rejects.toThrow('Integration for x not found');
  });

  it('should list integrations showing connected status', async () => {
    mockLoadIntegrations.mockResolvedValue({
      x: { username: 'signalstudio', picture: 'https://pic.jpg' },
    });

    const integrations = await listIntegrationsFlow(undefined);
    expect(integrations).toHaveLength(1);
    expect(integrations[0]).toMatchObject({
      provider: 'x',
      connected: true,
      username: 'signalstudio',
    });
  });
});

describe('E2E: Agentic Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadIntegrations.mockResolvedValue({});
  });

  it('should handle chat with tool invocations and history threading', async () => {
    mockGenerate.mockResolvedValueOnce({
      text: 'I\'ll generate a scene for Maya in the control room. Here\'s the cinematic breakdown...',
      toolRequests: [
        {
          toolRequest: {
            name: 'sceneGenerationTool',
            input: { storyContext: 'Control room discovery', characters: ['Maya'], location: 'HQ' },
          },
        },
      ],
    });

    const result = await agenticChatFlow({
      message: 'Generate a scene for Maya discovering the signal',
      history: [
        { role: 'user', content: [{ text: 'What can you do?' }] },
        { role: 'model', content: [{ text: 'I can generate scenes, scripts, and more.' }] },
      ],
      context: { currentEpisode: '1.1' },
    });

    expect(result.response).toContain('Maya');
    expect(result.suggestedActions).toBeDefined();
    expect(result.suggestedActions.length).toBeGreaterThan(0);
    expect(result.toolOutputs).toHaveLength(1);
    expect(result.toolOutputs![0].name).toBe('sceneGenerationTool');

    // Verify history was threaded through
    const generateCall = mockGenerate.mock.calls[0][0];
    expect(generateCall.messages).toHaveLength(3); // 2 history + 1 new
    expect(generateCall.messages[2].content[0].text).toBe('Generate a scene for Maya discovering the signal');
  });

  it('should inject performance context when X is connected', async () => {
    mockLoadIntegrations.mockResolvedValue({
      x: { accessToken: 'tok:sec', username: 'studio' },
    });

    mockXProvider.getAnalytics.mockResolvedValue([
      { label: 'Impressions', value: 5000, change: '+10%' },
    ]);

    mockGenerate.mockResolvedValueOnce({
      text: 'Your impressions are up 10%! Great momentum.',
      toolRequests: [],
    });

    const result = await agenticChatFlow({
      message: 'How are we performing on social?',
      context: {},
    });

    // Verify performance context was injected into the system prompt
    const generateCall = mockGenerate.mock.calls[0][0];
    expect(generateCall.system).toContain('CURRENT SOCIAL PERFORMANCE');
    expect(result.response).toContain('impressions');
  });

  it('should work without tool invocations', async () => {
    mockGenerate.mockResolvedValueOnce({
      text: 'Signal Studio is a cinematic marketing platform.',
      toolRequests: undefined,
    });

    const result = await agenticChatFlow({
      message: 'What is Signal Studio?',
    });

    expect(result.response).toBe('Signal Studio is a cinematic marketing platform.');
    expect(result.toolOutputs).toBeUndefined();
  });
});
