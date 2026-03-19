import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();
const mockDefineFlow = vi.fn((config: any, handler: any) => handler);
const mockDefineTool = vi.fn((config: any, handler: any) => handler);

vi.mock('../../genkit.config', () => ({
  ai: {
    defineFlow: mockDefineFlow,
    defineTool: mockDefineTool,
    generate: mockGenerate,
  },
}));

vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

// Mock all agent tools
const mockSceneGen = vi.fn();
const mockNarrativeAssembly = vi.fn();
const mockScoreGen = vi.fn();
const mockPrevisImage = vi.fn();
const mockVideoGen = vi.fn();
const mockSocialPost = vi.fn();
const mockSocialPerformance = vi.fn();
const mockListIntegrationsTool = vi.fn();
const mockOsintResearch = vi.fn();

vi.mock('../../lib/agents', () => ({
  sceneGenerationTool: mockSceneGen,
  narrativeAssemblyTool: mockNarrativeAssembly,
  scoreGenTool: mockScoreGen,
  previsImageTool: mockPrevisImage,
  videoGenTool: mockVideoGen,
  socialPostTool: mockSocialPost,
  socialPerformanceTool: mockSocialPerformance,
  listIntegrationsTool: mockListIntegrationsTool,
  osintResearchTool: mockOsintResearch,
}));

// Mock integration flows
const mockListIntegrationsFlow = vi.fn();
const mockGetPerformanceDataFlow = vi.fn();

vi.mock('../../flows/integrations', () => ({
  listIntegrationsFlow: mockListIntegrationsFlow,
  getPerformanceDataFlow: mockGetPerformanceDataFlow,
}));

const { videoGenerationFlow, agenticChatFlow } = await import('../../flows/orchestration');

describe('videoGenerationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSceneGen.mockResolvedValue({ scene: 'A dark server room' });
    mockNarrativeAssembly.mockResolvedValue({ narrative: 'Maya enters...' });
    mockScoreGen.mockResolvedValue({ score: 'Cinematic pulse' });
    mockPrevisImage.mockResolvedValue({ imageUrl: 'https://example.com/img.png' });
    mockVideoGen.mockResolvedValue({ videoUrl: 'https://example.com/vid.mp4' });
  });

  it('should orchestrate all tools in parallel and return results', async () => {
    const result = await videoGenerationFlow({
      theme: 'AI Revolution',
      characters: ['Maya Chen', 'Marcus'],
    });

    expect(mockSceneGen).toHaveBeenCalled();
    expect(mockNarrativeAssembly).toHaveBeenCalled();
    expect(mockScoreGen).toHaveBeenCalled();
    expect(mockPrevisImage).toHaveBeenCalled();
    expect(result.orchestrationStatus).toBe('COMPLETE');
    expect(result.scene).toEqual({ scene: 'A dark server room' });
    expect(result.narrative).toEqual({ narrative: 'Maya enters...' });
    expect(result.timestamp).toBeDefined();
  });

  it('should call videoGenTool after parallel tools complete', async () => {
    await videoGenerationFlow({
      theme: 'Test',
      characters: ['Maya'],
    });

    expect(mockVideoGen).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://example.com/img.png',
      })
    );
  });

  it('should handle videoGenTool failure gracefully', async () => {
    mockVideoGen.mockRejectedValueOnce(new Error('GPU unavailable'));

    const result = await videoGenerationFlow({
      theme: 'Test',
      characters: ['Maya'],
    });

    // Should still complete despite video failure
    expect(result.orchestrationStatus).toBe('COMPLETE');
    expect(result.scene).toBeDefined();
  });

  it('should use default character when array is empty', async () => {
    await videoGenerationFlow({
      theme: 'Test',
      characters: [],
    });

    expect(mockPrevisImage).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Maya Chen' })
    );
  });

  it('should propagate errors from parallel tool failures', async () => {
    mockSceneGen.mockRejectedValueOnce(new Error('Scene gen failed'));

    await expect(
      videoGenerationFlow({ theme: 'Test', characters: ['Maya'] })
    ).rejects.toThrow('Scene gen failed');
  });
});

describe('agenticChatFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListIntegrationsFlow.mockResolvedValue([]);
    mockGenerate.mockResolvedValue({
      text: 'I can help you with that!',
      toolRequests: [],
    });
  });

  it('should generate a chat response', async () => {
    const result = await agenticChatFlow({
      message: 'Draft a scene for Maya',
    });

    expect(result.response).toBe('I can help you with that!');
    expect(result.suggestedActions).toBeInstanceOf(Array);
    expect(result.suggestedActions.length).toBeGreaterThan(0);
  });

  it('should pass message history to ai.generate', async () => {
    const history = [
      { role: 'user', content: [{ text: 'Hello' }] },
      { role: 'model', content: [{ text: 'Hi!' }] },
    ];

    await agenticChatFlow({
      message: 'What can you do?',
      history,
    });

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3); // 2 history + 1 new
    expect(callArgs.messages[2].content[0].text).toBe('What can you do?');
  });

  it('should include tools in the generate call', async () => {
    await agenticChatFlow({ message: 'test' });

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools.length).toBeGreaterThan(0);
  });

  it('should fetch performance data when X integration exists', async () => {
    mockListIntegrationsFlow.mockResolvedValueOnce([
      { provider: 'x', connected: true, name: 'X', username: 'test' },
    ]);
    mockGetPerformanceDataFlow.mockResolvedValueOnce([
      { label: 'Followers', value: 1000, change: '+5%' },
    ]);

    await agenticChatFlow({ message: 'How are we doing?' });

    expect(mockGetPerformanceDataFlow).toHaveBeenCalledWith({ provider: 'x', days: 7 });
    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.system).toContain('CURRENT SOCIAL PERFORMANCE');
  });

  it('should handle performance data fetch failure gracefully', async () => {
    mockListIntegrationsFlow.mockRejectedValueOnce(new Error('DB error'));

    const result = await agenticChatFlow({ message: 'test' });

    // Should still work despite error
    expect(result.response).toBeDefined();
  });

  it('should include tool outputs from tool requests', async () => {
    mockGenerate.mockResolvedValueOnce({
      text: 'Generated a scene!',
      toolRequests: [
        { toolRequest: { name: 'sceneGenerationTool', input: { theme: 'AI' } } },
      ],
    });

    const result = await agenticChatFlow({ message: 'Generate scene' });

    expect(result.toolOutputs).toHaveLength(1);
    expect(result.toolOutputs![0].name).toBe('sceneGenerationTool');
  });

  it('should include context in system prompt', async () => {
    await agenticChatFlow({
      message: 'test',
      context: { currentTab: 'scenes', episodeId: '1.1' },
    });

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.system).toContain('currentTab');
  });
});
