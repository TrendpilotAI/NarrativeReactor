# NarrativeReactor — Test-Driven Development Plan

> **Author:** Auto-generated | **Date:** 2026-02-16 | **Status:** Ready for implementation

---

## 1. Testing Strategy Overview

### Framework: Vitest

- **Why:** Native ESM support, TypeScript-first, fast, compatible with Zod + Genkit
- **Install:** `npm i -D vitest @vitest/coverage-v8`

### Test Layers

| Layer | What | Tools | Run Time |
|-------|-------|-------|----------|
| **Unit** | Pure functions, helpers, isolated logic | Vitest + vi.mock | < 5s |
| **Integration** | Flows with mocked externals | Vitest + vi.mock | < 15s |
| **E2E** | Full server with real (staging) APIs | Vitest + supertest | Manual / nightly |

### Mocking Strategy

Every external dependency is mocked at the module boundary:
- **Genkit SDK** → mock `ai.generate()`, `ai.prompt()`, `ai.defineFlow()`, `ai.defineTool()`
- **Anthropic SDK** → mock `anthropic.messages.create()`
- **Fal.ai client** → mock `fal.subscribe()`
- **Twitter API v2** → mock `TwitterApi` class methods
- **File system** → mock `fs/promises` (readFile, access, writeFile, mkdir)
- **Fetch** → mock global `fetch` for Serper and Fal Registry

All mocks live in `__mocks__/` or are declared inline via `vi.mock()`.

---

## 2. Test Coverage Matrix

### `src/lib/context.ts`

| Function | Scenario | Mocks | Priority |
|----------|----------|-------|----------|
| `loadStoryBibleContext` | Happy path — episode "1.1" loads from Part3 | `fs.access`, `fs.readFile` | **P0** |
| `loadStoryBibleContext` | Episode "3.2" maps to Part4 file | `fs.access`, `fs.readFile` | **P0** |
| `loadStoryBibleContext` | Episode "5.1" maps to Part5 file | `fs.access`, `fs.readFile` | **P1** |
| `loadStoryBibleContext` | Unknown episode format (e.g., "99.1") returns fallback | none | **P0** |
| `loadStoryBibleContext` | File not found — falls back to StoryBible subdir | `fs.access` (throw), `fs.readFile` | **P0** |
| `loadStoryBibleContext` | File read error — returns error string | `fs.readFile` (throw) | **P1** |
| `loadStoryBibleContext` | Episode ID not found in file content | `fs.readFile` (content without match) | **P1** |
| `loadStoryBibleContext` | Extracts correct substring around match | `fs.readFile` | **P1** |
| `loadBrandGuidelines` | Happy path — loads Part1_Foundation.MD | `fs.access`, `fs.readFile` | **P0** |
| `loadBrandGuidelines` | File not found — returns fallback string | `fs.access` (throw), `fs.readFile` (throw) | **P0** |

### `src/lib/claude.ts`

| Function | Scenario | Mocks | Priority |
|----------|----------|-------|----------|
| `generateCopyClaude` | Happy path — twitter platform | `anthropic.messages.create` | **P0** |
| `generateCopyClaude` | Happy path — linkedin platform | `anthropic.messages.create` | **P1** |
| `generateCopyClaude` | Happy path — threads platform | `anthropic.messages.create` | **P1** |
| `generateCopyClaude` | API error — returns error string | `anthropic.messages.create` (throw) | **P0** |
| `generateCopyClaude` | Non-text response block — returns error | `anthropic.messages.create` (non-text) | **P1** |
| `generateCopyClaude` | Correct system prompt includes guidelines | `anthropic.messages.create` (assert args) | **P0** |

### `src/lib/fal.ts`

| Function | Scenario | Mocks | Priority |
|----------|----------|-------|----------|
| `generateImage` | Happy path — returns URL from `result.data.images[0]` | `fal.subscribe`, `FalRegistry.getPricing` | **P0** |
| `generateImage` | Fallback — returns URL from `result.images[0]` | `fal.subscribe` | **P1** |
| `generateImage` | No image URL — throws | `fal.subscribe` (empty result) | **P0** |
| `generateImage` | Fal.ai error — throws with message | `fal.subscribe` (throw) | **P0** |
| `generateImage` | Pricing fetch failure — cost is 0 | `fal.subscribe`, `FalRegistry.getPricing` (throw) | **P2** |
| `generateVideo` | Happy path — returns URL from `result.data.video.url` | `fal.subscribe`, `FalRegistry.getPricing` | **P0** |
| `generateVideo` | Fallback — returns URL from `result.video.url` | `fal.subscribe` | **P1** |
| `generateVideo` | No video URL — throws | `fal.subscribe` (empty) | **P0** |
| `generateVideo` | Pricing with per-second unit | `fal.subscribe`, `FalRegistry.getPricing` | **P2** |

### `src/lib/fal-registry.ts`

| Function | Scenario | Mocks | Priority |
|----------|----------|-------|----------|
| `FalRegistry.listModels` | Happy path — maps models | `fetch` | **P1** |
| `FalRegistry.listModels` | API error — returns empty array | `fetch` (throw) | **P1** |
| `FalRegistry.getPricing` | Happy path — returns prices | `fetch` | **P1** |
| `FalRegistry.getPricing` | Empty array input — returns [] | none | **P2** |
| `FalRegistry.getPricing` | Missing API key — throws | env | **P1** |
| `FalRegistry.getModelCategory` | Classifies video/image/audio/other | none (pure) | **P0** |

### `src/lib/social-providers.ts`

| Function | Scenario | Mocks | Priority |
|----------|----------|-------|----------|
| `XProvider.generateAuthUrl` | Returns URL + codeVerifier | `TwitterApi` | **P1** |
| `XProvider.authenticate` | Returns account details | `TwitterApi.login`, `v2.me` | **P1** |
| `XProvider.post` | Posts tweet, returns postId + URL | `TwitterApi.v2.tweet`, `v2.me` | **P0** |
| `XProvider.post` | API error — throws | `TwitterApi.v2.tweet` (throw) | **P1** |
| `XProvider.getAnalytics` | Aggregates metrics correctly | `TwitterApi.v2.userTimeline` | **P1** |
| `XProvider.getAnalytics` | No tweets — returns zeros | `TwitterApi.v2.userTimeline` (empty) | **P2** |
| `XProvider.getMentions` | Returns formatted mentions | `TwitterApi.v2.userMentionTimeline` | **P1** |
| `saveIntegration` | Writes JSON file | `fs.mkdir`, `fs.writeFile` | **P1** |
| `loadIntegrations` | Reads existing file | `fs.readFile` | **P1** |
| `loadIntegrations` | File not found — returns {} | `fs.readFile` (throw) | **P1** |

### `src/lib/agents.ts`

| Tool | Scenario | Mocks | Priority |
|------|----------|-------|----------|
| `sceneGenerationTool` | Calls ai.prompt('scene-gen') | `ai.prompt` | **P1** |
| `narrativeAssemblyTool` | Calls ai.prompt('narrative-assembly') | `ai.prompt` | **P1** |
| `scoreGenTool` | Calls ai.prompt('score-gen') | `ai.prompt` | **P1** |
| `previsImageTool` | Generates image via fal | `generateImage` | **P0** |
| `previsImageTool` | Fal error — returns error object | `generateImage` (throw) | **P1** |
| `socialPostTool` | Posts via provider | `loadIntegrations`, `providers.x.post` | **P1** |
| `socialPostTool` | No integration — returns error | `loadIntegrations` (empty) | **P1** |
| `osintResearchTool` | Happy path — returns results | `fetch` | **P1** |
| `osintResearchTool` | No API key — returns error | env | **P1** |
| `osintResearchTool` | Fetch fails — returns error | `fetch` (throw) | **P2** |
| `videoGenTool` | Generates video via fal | `generateVideo` | **P0** |

### `src/flows/compliance.ts`

| Flow | Scenario | Mocks | Priority |
|------|----------|-------|----------|
| `verifyBrandCompliance` | Content passes — score > 80 | `loadBrandGuidelines`, `ai.generate` | **P0** |
| `verifyBrandCompliance` | Content fails — returns issues | `loadBrandGuidelines`, `ai.generate` | **P0** |
| `verifyBrandCompliance` | ai.generate returns null output — throws | `ai.generate` | **P1** |

### `src/flows/content-generation.ts`

| Flow | Scenario | Mocks | Priority |
|------|----------|-------|----------|
| `generateContent` | Claude path — useClaude=true | `loadStoryBibleContext`, `loadBrandGuidelines`, `generateCopyClaude`, `verifyBrandCompliance` | **P0** |
| `generateContent` | Gemini path — useClaude=false | `loadStoryBibleContext`, `loadBrandGuidelines`, `ai.generate`, `verifyBrandCompliance` | **P0** |
| `generateContent` | Compliance fails — returns issues | all above | **P1** |

### `src/flows/integrations.ts`

| Flow | Scenario | Mocks | Priority |
|------|----------|-------|----------|
| `getAuthUrlFlow` | Valid provider | `providers.x.generateAuthUrl` | **P1** |
| `getAuthUrlFlow` | Invalid provider — throws | none | **P1** |
| `connectSocialAccountFlow` | Happy path | `providers.x.authenticate`, `saveIntegration` | **P1** |
| `listIntegrationsFlow` | Returns connected list | `loadIntegrations` | **P1** |
| `postToSocialFlow` | Happy path | `loadIntegrations`, `providers.x.post` | **P0** |
| `postToSocialFlow` | No integration — throws | `loadIntegrations` (empty) | **P1** |
| `getPerformanceDataFlow` | Returns metrics | `loadIntegrations`, `providers.x.getAnalytics` | **P1** |
| `getMentionsFlow` | Returns mentions | `loadIntegrations`, `providers.x.getMentions` | **P1** |

### `src/flows/orchestration.ts`

| Flow | Scenario | Mocks | Priority |
|------|----------|-------|----------|
| `videoGenerationFlow` | All tools succeed in parallel | all 4 agent tools + `videoGenTool` | **P1** |
| `videoGenerationFlow` | Video generation fails — still returns other results | agent tools + `videoGenTool` (throw) | **P2** |
| `agenticChatFlow` | Returns response with suggested actions | `ai.generate`, integration tools | **P1** |

### `src/genkit.config.ts`

| Item | Scenario | Priority |
|------|----------|----------|
| `ai` export | Exports configured genkit instance | **P2** |

### `src/index.ts`

| Item | Scenario | Priority |
|------|----------|----------|
| Server startup | `startFlowServer` called with all flows | **P2** (E2E) |

---

## 3. Mocking Architecture

### 3.1 Genkit SDK

```typescript
// test/mocks/genkit.ts
import { vi } from 'vitest';

// Mock the genkit config module
vi.mock('../genkit.config', () => {
  const mockGenerate = vi.fn().mockResolvedValue({
    text: 'Generated text',
    output: { passed: true, issues: [], score: 95 },
    toolRequests: [],
  });

  const mockPromptFn = vi.fn().mockResolvedValue({ output: {} });
  const mockPrompt = vi.fn().mockReturnValue(mockPromptFn);

  const mockDefineFlow = vi.fn().mockImplementation((_config, handler) => handler);
  const mockDefineTool = vi.fn().mockImplementation((_config, handler) => handler);

  return {
    ai: {
      generate: mockGenerate,
      prompt: mockPrompt,
      defineFlow: mockDefineFlow,
      defineTool: mockDefineTool,
    },
  };
});
```

**Key insight:** `defineFlow` and `defineTool` return the handler function directly in tests. This lets you call the flow/tool handler directly without Genkit runtime overhead.

### 3.2 Anthropic SDK

```typescript
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Generated copy for Twitter' }],
  });
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});
```

### 3.3 Fal.ai Client

```typescript
vi.mock('@fal-ai/client', () => ({
  fal: {
    subscribe: vi.fn().mockResolvedValue({
      data: {
        images: [{ url: 'https://fal.ai/mock-image.png' }],
        video: { url: 'https://fal.ai/mock-video.mp4' },
      },
    }),
  },
}));
```

### 3.4 Twitter API v2

```typescript
vi.mock('twitter-api-v2', () => {
  const mockTweet = vi.fn().mockResolvedValue({ data: { id: 'tweet-123' } });
  const mockMe = vi.fn().mockResolvedValue({ data: { id: 'user-1', username: 'testuser', name: 'Test' } });
  const mockTimeline = vi.fn().mockResolvedValue({ data: { data: [] } });
  const mockMentions = vi.fn().mockResolvedValue({ data: { data: [] }, includes: { users: [] } });

  return {
    TwitterApi: class MockTwitterApi {
      v2 = {
        tweet: mockTweet,
        me: mockMe,
        userTimeline: mockTimeline,
        userMentionTimeline: mockMentions,
      };
      generateAuthLink = vi.fn().mockResolvedValue({
        url: 'https://twitter.com/auth',
        oauth_token: 'token',
        oauth_token_secret: 'secret',
      });
      login = vi.fn().mockResolvedValue({
        accessToken: 'at', accessSecret: 'as', screenName: 'test', userId: '1',
      });
      constructor() {}
    },
  };
});
```

### 3.5 File System

```typescript
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));
```

### 3.6 Fetch (OSINT / Fal Registry)

```typescript
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Per-test setup:
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: () => Promise.resolve({ organic: [{ title: 'Result', snippet: '...', link: 'https://...' }] }),
});
```

---

## 4. Test File Structure

```
src/
  __tests__/
    setup.ts                          # Global test setup (env vars, shared mocks)
    lib/
      context.test.ts                 # loadStoryBibleContext, loadBrandGuidelines
      claude.test.ts                  # generateCopyClaude
      fal.test.ts                     # generateImage, generateVideo
      fal-registry.test.ts            # FalRegistry static methods
      social-providers.test.ts        # XProvider, saveIntegration, loadIntegrations
      agents.test.ts                  # All 9 Genkit tools
    flows/
      compliance.test.ts              # verifyBrandCompliance
      content-generation.test.ts      # generateContent
      integrations.test.ts            # All integration flows
      orchestration.test.ts           # videoGenerationFlow, agenticChatFlow
    e2e/
      server.test.ts                  # Full server smoke test (optional)
  __mocks__/
    genkit-config.ts                  # Shared Genkit mock
```

---

## 5. Implementation Order

### Phase 1: Pure Functions & Simple Units (Week 1)
1. `context.test.ts` — Pure file I/O with mocked fs ← **Start here**
2. `fal-registry.test.ts` — `getModelCategory()` is fully pure; API methods are simple fetch mocks
3. `claude.test.ts` — Single function, straightforward mock

### Phase 2: Complex Units (Week 1-2)
4. `fal.test.ts` — Depends on fal client + FalRegistry
5. `social-providers.test.ts` — XProvider methods + file-based store

### Phase 3: Tools (Week 2)
6. `agents.test.ts` — Each tool is a thin wrapper; mock dependencies

### Phase 4: Flows (Week 2-3)
7. `compliance.test.ts` — Simple flow, depends on context + ai.generate
8. `content-generation.test.ts` — Orchestrates context + claude/gemini + compliance
9. `integrations.test.ts` — CRUD flows over social providers
10. `orchestration.test.ts` — Parallel tool orchestration + agentic chat

### Phase 5: E2E (Week 3+, optional)
11. `server.test.ts` — Spin up Express, hit endpoints

---

## 6. Example Test Skeletons

### 6.1 Unit Test: `context.ts` — `loadStoryBibleContext`

```typescript
// src/__tests__/lib/context.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

describe('loadStoryBibleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Must import AFTER mocks are set up
  const getModule = async () => import('../../lib/context');

  it('should load context for episode 1.1 from Part3_Week1-2.MD', async () => {
    const { loadStoryBibleContext } = await getModule();
    const content = '## Previous\n### Episode 1.1\nMaya discovers the Signal Protocol in a dimly lit server room.\n### Episode 1.2';

    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('1.1');

    expect(result).toContain('Maya discovers the Signal Protocol');
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Part3_Week1-2.MD'),
      'utf-8'
    );
  });

  it('should return fallback for unknown episode format', async () => {
    const { loadStoryBibleContext } = await getModule();
    const result = await loadStoryBibleContext('99.1');
    expect(result).toBe('Context not found for this episode ID structure.');
  });

  it('should fall back to StoryBible subdir if root file missing', async () => {
    const { loadStoryBibleContext } = await getModule();
    const content = 'Episode 1.1 content here';

    vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('1.1');
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('StoryBible'),
      'utf-8'
    );
  });

  it('should return error string when file read fails', async () => {
    const { loadStoryBibleContext } = await getModule();
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('EACCES'));

    const result = await loadStoryBibleContext('1.1');
    expect(result).toBe('Error loading Story Bible context.');
  });

  it('should return not-found message when episode ID absent from file', async () => {
    const { loadStoryBibleContext } = await getModule();
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce('No matching episodes here.');

    const result = await loadStoryBibleContext('1.1');
    expect(result).toContain('not found in Part3_Week1-2.MD');
  });
});

describe('loadBrandGuidelines', () => {
  it('should load Part1_Foundation.MD', async () => {
    const { loadBrandGuidelines } = await import('../../lib/context');
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce('# Brand Guidelines\nTone: Professional');

    const result = await loadBrandGuidelines();
    expect(result).toContain('Brand Guidelines');
  });

  it('should return fallback when file missing', async () => {
    const { loadBrandGuidelines } = await import('../../lib/context');
    vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await loadBrandGuidelines();
    expect(result).toBe('Brand guidelines not found.');
  });
});
```

### 6.2 Unit Test: `claude.ts` — `generateCopyClaude`

```typescript
// src/__tests__/lib/claude.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

// Must mock genkit's z re-export too if needed
vi.mock('genkit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('genkit')>();
  return actual;
});

import { generateCopyClaude } from '../../lib/claude';

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
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );
  });

  it('should include platform constraints in system prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'output' }],
    });

    await generateCopyClaude(baseInput);

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('TWITTER');
    expect(call.system).toContain('280 chars');
  });

  it('should include linkedin constraints for linkedin platform', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'output' }],
    });

    await generateCopyClaude({ ...baseInput, platform: 'linkedin' });

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('LINKEDIN');
    expect(call.system).toContain('Thought leadership');
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
```

### 6.3 Integration Test: `compliance.ts` — `verifyBrandCompliance`

```typescript
// src/__tests__/flows/compliance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock genkit config — defineFlow returns the handler directly
vi.mock('../../genkit.config', () => {
  const mockGenerate = vi.fn();
  return {
    ai: {
      generate: mockGenerate,
      defineFlow: vi.fn().mockImplementation((_config: any, handler: Function) => handler),
      defineTool: vi.fn().mockImplementation((_config: any, handler: Function) => handler),
      prompt: vi.fn(),
    },
  };
});

vi.mock('../../lib/context', () => ({
  loadBrandGuidelines: vi.fn(),
}));

import { verifyBrandCompliance } from '../../flows/compliance';
import { ai } from '../../genkit.config';
import { loadBrandGuidelines } from '../../lib/context';

describe('verifyBrandCompliance flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return passing compliance for aligned content', async () => {
    vi.mocked(loadBrandGuidelines).mockResolvedValueOnce('Tone: Professional, accessible.');
    vi.mocked(ai.generate).mockResolvedValueOnce({
      output: { passed: true, issues: [], score: 95 },
      text: '',
      toolRequests: [],
    } as any);

    const result = await verifyBrandCompliance({
      content: 'Signal Studio revolutionizes AI-powered marketing.',
      platform: 'twitter',
    });

    expect(result).toEqual({ passed: true, issues: [], score: 95 });
    expect(ai.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Signal Studio revolutionizes'),
        output: expect.objectContaining({ schema: expect.anything() }),
      })
    );
  });

  it('should return failing compliance with issues', async () => {
    vi.mocked(loadBrandGuidelines).mockResolvedValueOnce('No slang. Professional tone.');
    vi.mocked(ai.generate).mockResolvedValueOnce({
      output: { passed: false, issues: ['Slang detected: "gonna"', 'Tone too casual'], score: 40 },
      text: '',
    } as any);

    const result = await verifyBrandCompliance({
      content: 'We gonna blow your mind with this AI stuff lol',
      platform: 'twitter',
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.score).toBeLessThan(50);
  });

  it('should throw when ai.generate returns null output', async () => {
    vi.mocked(loadBrandGuidelines).mockResolvedValueOnce('Guidelines');
    vi.mocked(ai.generate).mockResolvedValueOnce({
      output: null,
      text: '',
    } as any);

    await expect(
      verifyBrandCompliance({ content: 'Test', platform: 'twitter' })
    ).rejects.toThrow('Failed to generate compliance report');
  });

  it('should include brand guidelines in the prompt', async () => {
    vi.mocked(loadBrandGuidelines).mockResolvedValueOnce('CUSTOM GUIDELINES HERE');
    vi.mocked(ai.generate).mockResolvedValueOnce({
      output: { passed: true, issues: [], score: 90 },
    } as any);

    await verifyBrandCompliance({ content: 'Test', platform: 'linkedin' });

    const prompt = vi.mocked(ai.generate).mock.calls[0][0].prompt;
    expect(prompt).toContain('CUSTOM GUIDELINES HERE');
    expect(prompt).toContain('linkedin');
  });
});
```

---

## 7. CI Integration

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/flows/**'],
      exclude: ['src/index.ts', 'src/genkit.config.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 75,
        lines: 70,
      },
    },
    testTimeout: 10000,
  },
});
```

### `src/__tests__/setup.ts`

```typescript
// Global test setup — set env vars so modules don't crash on import
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.FAL_KEY = 'test-fal-key';
process.env.X_API_KEY = 'test-x-key';
process.env.X_API_SECRET = 'test-x-secret';
process.env.SERPER_API_KEY = 'test-serper-key';
process.env.GOOGLE_API_KEY = 'test-google-key';
```

### `package.json` additions

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --coverage --reporter=junit --outputFile=test-results.xml"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

### GitHub Actions (`.github/workflows/test.yml`)

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test:ci
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
```

---

## 8. Coverage Goals

| Module | Target | Rationale |
|--------|--------|-----------|
| `lib/context.ts` | **90%** | Pure I/O logic, easy to test exhaustively |
| `lib/claude.ts` | **90%** | Single function, all paths testable |
| `lib/fal.ts` | **80%** | Multiple response shapes to cover |
| `lib/fal-registry.ts` | **85%** | `getModelCategory` is pure; API methods straightforward |
| `lib/social-providers.ts` | **70%** | Heavy mocking; focus on post + loadIntegrations |
| `lib/agents.ts` | **70%** | Thin wrappers; test tool logic not Genkit plumbing |
| `flows/compliance.ts` | **90%** | Critical business logic |
| `flows/content-generation.ts` | **85%** | Core feature |
| `flows/integrations.ts` | **75%** | CRUD flows, error paths |
| `flows/orchestration.ts` | **60%** | Complex parallel orchestration; focus on happy path |
| **Overall** | **≥75%** | |

---

## Quick Start

```bash
# Install test dependencies
npm i -D vitest @vitest/coverage-v8

# Create vitest config
# (copy vitest.config.ts from Section 7 above)

# Create setup file
mkdir -p src/__tests__
# (copy setup.ts from Section 7 above)

# Create first test
mkdir -p src/__tests__/lib
# (copy context.test.ts from Section 6.1 above)

# Run
npx vitest run
```
