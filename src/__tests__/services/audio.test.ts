import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TTS Service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('generateSpeech returns cached result if file exists', async () => {
    const audioDir = path.join(process.cwd(), 'data', 'audio');

    // Import after mocks
    const { generateSpeech } = await import('../../services/tts');

    // Generate with mocked fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      text: () => Promise.resolve(''),
    });

    const result1 = await generateSpeech('Hello world', 'default');
    expect(result1.cached).toBe(false);
    expect(result1.audioUrl).toContain('.mp3');
    expect(result1.voiceId).toBe('default');

    // Second call should be cached
    const result2 = await generateSpeech('Hello world', 'default');
    expect(result2.cached).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Cleanup
    if (fs.existsSync(result1.filePath)) fs.unlinkSync(result1.filePath);
  });

  it('generateSpeech throws on API error', async () => {
    const { generateSpeech } = await import('../../services/tts');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    // Use unique text to avoid cache
    await expect(generateSpeech('unique-text-' + Date.now())).rejects.toThrow('Fish Audio TTS failed');
  });

  it('listAudioFiles returns array', async () => {
    const { listAudioFiles } = await import('../../services/tts');
    const files = listAudioFiles();
    expect(Array.isArray(files)).toBe(true);
  });

  it('estimateDuration is reasonable', async () => {
    const { generateSpeech } = await import('../../services/tts');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
      text: () => Promise.resolve(''),
    });

    const result = await generateSpeech('This is a test with about ten words in it ' + Date.now());
    expect(result.durationEstimate).toBeGreaterThan(0);

    if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
  });
});

describe('VOICE_PROFILES', () => {
  it('has expected voice profiles', async () => {
    const { VOICE_PROFILES } = await import('../../services/tts');
    expect(VOICE_PROFILES.narrator).toBeDefined();
    expect(VOICE_PROFILES.host).toBeDefined();
    expect(VOICE_PROFILES.guest).toBeDefined();
  });
});

describe('Podcast Generator', () => {
  it('generatePodcastScript generates valid script', async () => {
    // Mock genkit generate
    vi.doMock('@genkit-ai/ai', () => ({
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          title: 'Test Podcast',
          intro: { speaker: 'Host', text: 'Welcome to the show.' },
          segments: [
            { speaker: 'Host', text: 'Today we discuss AI.' },
            { speaker: 'Guest', text: 'AI is fascinating.' },
          ],
          outro: { speaker: 'Host', text: 'Thanks for listening.' },
        }),
      }),
    }));

    const { generatePodcastScript } = await import('../../services/podcastGenerator');
    const script = await generatePodcastScript('AI Technology', 'interview');

    expect(script.title).toBe('Test Podcast');
    expect(script.style).toBe('interview');
    expect(script.intro.speaker).toBe('Host');
    expect(script.segments.length).toBe(2);
    expect(script.outro.speaker).toBe('Host');
    expect(script.estimatedDuration).toBeGreaterThan(0);
    expect(script.intro.voiceId).toBeDefined();
  });
});

describe('Dialogue Service', () => {
  it('generateDialogue validates character count', async () => {
    vi.doMock('@genkit-ai/ai', () => ({
      generate: vi.fn(),
    }));

    const { generateDialogue } = await import('../../services/dialogue');

    await expect(generateDialogue([{ name: 'Solo' }], 'test')).rejects.toThrow('2-4 characters');
    await expect(
      generateDialogue(
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }],
        'test'
      )
    ).rejects.toThrow('2-4 characters');
  });

  it('generateDialogue creates dialogue with correct structure', async () => {
    vi.resetModules();
    vi.doMock('@genkit-ai/ai', () => ({
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          lines: [
            { character: 'Alice', text: 'Hello Bob!' },
            { character: 'Bob', text: 'Hi Alice!' },
            { character: 'Alice', text: 'How are you?' },
          ],
        }),
      }),
    }));

    const { generateDialogue } = await import('../../services/dialogue');
    const dialogue = await generateDialogue(
      [{ name: 'Alice', personality: 'cheerful' }, { name: 'Bob', personality: 'grumpy' }],
      'greetings'
    );

    expect(dialogue.topic).toBe('greetings');
    expect(dialogue.characters.length).toBe(2);
    expect(dialogue.lines.length).toBe(3);
    expect(dialogue.lines[0].character).toBe('Alice');
    expect(dialogue.lines[0].voiceId).toBeDefined();
    expect(dialogue.estimatedDuration).toBeGreaterThan(0);
  });
});
