/**
 * Unit tests for src/lib/context.ts
 * 
 * Tests the Story Bible context loader and brand guidelines reader.
 * All filesystem access is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
const mockAccess = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs/promises', () => ({
    default: {
        access: (...args: any[]) => mockAccess(...args),
        readFile: (...args: any[]) => mockReadFile(...args),
    },
    access: (...args: any[]) => mockAccess(...args),
    readFile: (...args: any[]) => mockReadFile(...args),
}));

import { loadStoryBibleContext, loadBrandGuidelines } from '../context';

describe('context.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadStoryBibleContext()', () => {
        it('routes episode 1.x to Part3_Week1-2.MD', async () => {
            mockAccess.mockResolvedValueOnce(undefined); // root path exists
            mockReadFile.mockResolvedValueOnce('### Episode 1.1 — The Spark\nSome content about Maya.');

            const result = await loadStoryBibleContext('1.1');

            // Should have tried to read a file containing "Part3_Week1-2.MD"
            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('Part3_Week1-2.MD');
            expect(result).toContain('Episode 1.1');
        });

        it('routes episode 2.x to Part3_Week1-2.MD', async () => {
            mockAccess.mockResolvedValueOnce(undefined);
            mockReadFile.mockResolvedValueOnce('### Episode 2.3 — The Build\nMarcus reflects.');

            const result = await loadStoryBibleContext('2.3');

            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('Part3_Week1-2.MD');
        });

        it('routes episode 3.x to Part4_Week3-4.MD', async () => {
            mockAccess.mockResolvedValueOnce(undefined);
            mockReadFile.mockResolvedValueOnce('### Episode 3.1 — Pivot\nElena decides.');

            await loadStoryBibleContext('3.1');

            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('Part4_Week3-4.MD');
        });

        it('routes episode 5.x to Part5_Week5-6.MD', async () => {
            mockAccess.mockResolvedValueOnce(undefined);
            mockReadFile.mockResolvedValueOnce('### Episode 5.2 — Finale\nThe team launches.');

            await loadStoryBibleContext('5.2');

            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('Part5_Week5-6.MD');
        });

        it('returns fallback message for unmatched episode ID structure', async () => {
            const result = await loadStoryBibleContext('99.1');
            expect(result).toContain('Context not found');
        });

        it('falls back to StoryBible/ subdir when root file not found', async () => {
            mockAccess.mockRejectedValueOnce(new Error('ENOENT')); // root fails
            mockReadFile.mockResolvedValueOnce('### Episode 1.1\nContent from StoryBible subdir.');

            const result = await loadStoryBibleContext('1.1');

            // The readFile call should use the StoryBible subdirectory path
            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('StoryBible');
            expect(result).toContain('Episode 1.1');
        });

        it('extracts content around the episode match', async () => {
            // Build a large file with the episode in the middle
            const before = 'A'.repeat(1000);
            const episode = '### Episode 1.2 — The Discovery';
            const after = 'B'.repeat(5000);
            const fullContent = before + episode + after;

            mockAccess.mockResolvedValueOnce(undefined);
            mockReadFile.mockResolvedValueOnce(fullContent);

            const result = await loadStoryBibleContext('1.2');

            // Should contain the episode marker
            expect(result).toContain('Episode 1.2');
            // Should NOT contain the full file (it's truncated)
            expect(result.length).toBeLessThan(fullContent.length);
            // Max length is about 3500 (500 before + 3000 after)
            expect(result.length).toBeLessThanOrEqual(3500);
        });

        it('returns "not found" when episode ID not in file content', async () => {
            mockAccess.mockResolvedValueOnce(undefined);
            mockReadFile.mockResolvedValueOnce('### Episode 1.1\nOnly episode 1.1 here.');

            const result = await loadStoryBibleContext('1.9');
            expect(result).toContain('not found');
        });
    });

    describe('loadBrandGuidelines()', () => {
        it('reads Part1_Foundation.MD successfully', async () => {
            mockAccess.mockResolvedValueOnce(undefined);
            mockReadFile.mockResolvedValueOnce('# Signal Studio Brand Guidelines\nProfessional and accessible.');

            const result = await loadBrandGuidelines();
            expect(result).toContain('Signal Studio');

            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('Part1_Foundation.MD');
        });

        it('falls back to StoryBible/ subdir when root file not found', async () => {
            mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
            mockReadFile.mockResolvedValueOnce('# Brand Guidelines from subdir');

            const result = await loadBrandGuidelines();

            const readCall = mockReadFile.mock.calls[0][0];
            expect(readCall).toContain('StoryBible');
            expect(result).toContain('Brand Guidelines');
        });

        it('returns fallback message when file is missing entirely', async () => {
            mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
            mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

            const result = await loadBrandGuidelines();
            expect(result).toBe('Brand guidelines not found.');
        });
    });
});
