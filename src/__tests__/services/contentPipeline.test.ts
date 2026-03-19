import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  researchTopic,
  runContentPipeline,
  getDraft,
  listDrafts,
  approveDraft,
  rejectDraft,
  updateDraftContent,
  markDraftPublished,
} from '../../services/contentPipeline';

// Mock ai.generate
vi.mock('../../genkit.config', () => ({
  ai: {
    generate: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        summary: 'Test summary about AI trends',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
        angles: ['Angle 1', 'Angle 2'],
        sources: ['Source 1'],
      }),
    }),
  },
}));

// Mock Claude
vi.mock('../../lib/claude', () => ({
  generateCopyClaude: vi.fn().mockResolvedValue('Mock Claude content'),
}));

describe('Content Pipeline', () => {
  describe('researchTopic', () => {
    it('should return structured research', async () => {
      const result = await researchTopic('AI in healthcare');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('angles');
      expect(result).toHaveProperty('sources');
      expect(Array.isArray(result.keyPoints)).toBe(true);
    });
  });

  describe('runContentPipeline', () => {
    it('should generate a draft with all three formats', async () => {
      // Override mock for format generation (returns plain text for formats)
      const { ai } = await import('../../genkit.config');
      (ai.generate as any)
        .mockResolvedValueOnce({
          text: JSON.stringify({
            summary: 'Research summary',
            keyPoints: ['KP1'],
            angles: ['A1'],
            sources: ['S1'],
          }),
        })
        .mockResolvedValueOnce({ text: '1/ First tweet\n\n2/ Second tweet' })
        .mockResolvedValueOnce({ text: 'LinkedIn post about AI' })
        .mockResolvedValueOnce({ text: '# Blog Title\n\nBlog content here' });

      const draft = await runContentPipeline({ topic: 'AI trends 2026' });

      expect(draft).toHaveProperty('id');
      expect(draft).toHaveProperty('topic', 'AI trends 2026');
      expect(draft).toHaveProperty('research');
      expect(draft.formats).toHaveProperty('xThread');
      expect(draft.formats).toHaveProperty('linkedinPost');
      expect(draft.formats).toHaveProperty('blogArticle');
      expect(draft.status).toBe('draft');
    });
  });

  describe('Draft Management', () => {
    let draftId: string;

    beforeEach(async () => {
      const { ai } = await import('../../genkit.config');
      (ai.generate as any)
        .mockResolvedValueOnce({
          text: JSON.stringify({
            summary: 'S', keyPoints: ['K'], angles: ['A'], sources: [],
          }),
        })
        .mockResolvedValueOnce({ text: 'X thread' })
        .mockResolvedValueOnce({ text: 'LinkedIn post' })
        .mockResolvedValueOnce({ text: 'Blog article' });

      const draft = await runContentPipeline({ topic: 'Test topic' });
      draftId = draft.id;
    });

    it('should retrieve a draft by id', () => {
      const draft = getDraft(draftId);
      expect(draft).toBeDefined();
      expect(draft!.id).toBe(draftId);
    });

    it('should list drafts', () => {
      const all = listDrafts();
      expect(all.length).toBeGreaterThan(0);
    });

    it('should list drafts filtered by status', () => {
      const draftsOnly = listDrafts('draft');
      expect(draftsOnly.every(d => d.status === 'draft')).toBe(true);
    });

    it('should approve a draft', () => {
      const approved = approveDraft(draftId);
      expect(approved).toBeDefined();
      expect(approved!.status).toBe('approved');
    });

    it('should reject a draft with feedback', () => {
      const rejected = rejectDraft(draftId, 'Needs more data');
      expect(rejected).toBeDefined();
      expect(rejected!.status).toBe('rejected');
      expect(rejected!.feedback).toBe('Needs more data');
    });

    it('should update draft content', () => {
      const updated = updateDraftContent(draftId, 'xThread', 'Updated thread');
      expect(updated).toBeDefined();
      expect(updated!.formats.xThread).toBe('Updated thread');
    });

    it('should reset rejected draft to draft on edit', () => {
      rejectDraft(draftId, 'Fix it');
      const updated = updateDraftContent(draftId, 'linkedinPost', 'Fixed post');
      expect(updated!.status).toBe('draft');
    });

    it('should mark draft as published', () => {
      const published = markDraftPublished(draftId);
      expect(published).toBeDefined();
      expect(published!.status).toBe('published');
    });

    it('should return undefined for non-existent draft', () => {
      expect(getDraft('non-existent')).toBeUndefined();
      expect(approveDraft('non-existent')).toBeUndefined();
      expect(rejectDraft('non-existent', 'x')).toBeUndefined();
    });
  });
});
