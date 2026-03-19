import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

// Mock genkit's z export to avoid loading the full genkit runtime
vi.mock('genkit', async () => {
  const zod = await import('zod');
  return { z: zod.z };
});

describe('loadStoryBibleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getModule = () => import('../../lib/context');

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

  it('should load context for episode 3.2 from Part4_Week3-4.MD', async () => {
    const { loadStoryBibleContext } = await getModule();
    const content = '### Episode 3.2\nThe team faces a new challenge.';

    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('3.2');

    expect(result).toContain('The team faces a new challenge');
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Part4_Week3-4.MD'),
      'utf-8'
    );
  });

  it('should load context for episode 5.1 from Part5_Week5-6.MD', async () => {
    const { loadStoryBibleContext } = await getModule();
    const content = '### Episode 5.1\nFinal showdown begins.';

    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('5.1');

    expect(result).toContain('Final showdown begins');
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Part5_Week5-6.MD'),
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

  it('should extract correct substring around match', async () => {
    const { loadStoryBibleContext } = await getModule();
    // Create content where match is in the middle
    const prefix = 'A'.repeat(600);
    const suffix = 'B'.repeat(4000);
    const content = `${prefix}Episode 1.1 - The beginning${suffix}`;

    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('1.1');
    expect(result).toContain('Episode 1.1');
    // Should not contain the full prefix (it's trimmed to 500 chars before match)
    expect(result.length).toBeLessThan(content.length);
  });

  it('should load episode 2.1 from Part3 file', async () => {
    const { loadStoryBibleContext } = await getModule();
    const content = '### Episode 2.1\nSecond arc begins.';

    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('2.1');
    expect(result).toContain('Second arc begins');
  });

  it('should load episode 4.1 from Part4 file', async () => {
    const { loadStoryBibleContext } = await getModule();
    const content = '### Episode 4.1\nMidpoint crisis.';

    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce(content);

    const result = await loadStoryBibleContext('4.1');
    expect(result).toContain('Midpoint crisis');
  });
});

describe('loadBrandGuidelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
