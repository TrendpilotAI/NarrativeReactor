/**
 * Tests: BlotatoPublisher service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the blotato lib
const mockBlotatoPublish = vi.fn();
const mockBlotatoGetQueue = vi.fn();
const mockBlotatoGetPost = vi.fn();
const mockBlotatoCancelPost = vi.fn();
const mockBlotatoListAccounts = vi.fn();

vi.mock('../../lib/blotato', () => ({
  blotatoPublish: mockBlotatoPublish,
  blotatoGetQueue: mockBlotatoGetQueue,
  blotatoGetPost: mockBlotatoGetPost,
  blotatoCancelPost: mockBlotatoCancelPost,
  blotatoListAccounts: mockBlotatoListAccounts,
  BlotatoPlatform: { TWITTER: 'twitter', LINKEDIN: 'linkedin' },
}));

// Mock contentPipeline
const mockGetDraft = vi.fn();
const mockMarkDraftPublished = vi.fn();

vi.mock('../../services/contentPipeline', () => ({
  getDraft: mockGetDraft,
  markDraftPublished: mockMarkDraftPublished,
}));

// Mock publisher
vi.mock('../../services/publisher', () => ({
  formatForPlatform: vi.fn((content: string) => content),
}));

describe('BlotatoPublisher Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishDraftViaBlotato', () => {
    it('publishes an approved draft successfully', async () => {
      const draft = {
        id: 'draft-1',
        status: 'approved',
        formats: {
          xThread: 'Thread content here',
          linkedinPost: 'LinkedIn post',
          blogArticle: 'Blog article',
        },
      };
      mockGetDraft.mockReturnValue(draft);
      mockBlotatoPublish.mockResolvedValue({ postId: 'blotato-123', status: 'published' });

      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      const result = await publishDraftViaBlotato({
        draftId: 'draft-1',
        platforms: ['twitter' as any],
        format: 'xThread',
      });

      expect(result.draftId).toBe('draft-1');
      expect(result.blotatoResult.postId).toBe('blotato-123');
      expect(result.content).toBe('Thread content here');
      expect(mockMarkDraftPublished).toHaveBeenCalledWith('draft-1');
    });

    it('publishes a draft-status draft', async () => {
      const draft = {
        id: 'draft-2',
        status: 'draft',
        formats: { linkedinPost: 'LinkedIn content' },
      };
      mockGetDraft.mockReturnValue(draft);
      mockBlotatoPublish.mockResolvedValue({ postId: 'blotato-456', status: 'published' });

      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      const result = await publishDraftViaBlotato({
        draftId: 'draft-2',
        platforms: ['linkedin' as any],
        format: 'linkedinPost',
      });
      expect(result.blotatoResult.postId).toBe('blotato-456');
    });

    it('throws if draft not found', async () => {
      mockGetDraft.mockReturnValue(null);
      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      await expect(publishDraftViaBlotato({
        draftId: 'nonexistent',
        platforms: ['twitter' as any],
        format: 'xThread',
      })).rejects.toThrow('Draft nonexistent not found');
    });

    it('throws if draft is already published', async () => {
      mockGetDraft.mockReturnValue({ id: 'draft-3', status: 'published', formats: {} });
      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      await expect(publishDraftViaBlotato({
        draftId: 'draft-3',
        platforms: ['twitter' as any],
        format: 'xThread',
      })).rejects.toThrow('is published, cannot publish');
    });

    it('throws if format not found in draft', async () => {
      mockGetDraft.mockReturnValue({
        id: 'draft-4',
        status: 'approved',
        formats: { linkedinPost: 'LinkedIn content' },
      });
      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      await expect(publishDraftViaBlotato({
        draftId: 'draft-4',
        platforms: ['twitter' as any],
        format: 'xThread',
      })).rejects.toThrow('Format xThread not found in draft');
    });

    it('does not mark as published when scheduledAt is provided', async () => {
      const draft = {
        id: 'draft-5',
        status: 'approved',
        formats: { xThread: 'Scheduled thread' },
      };
      mockGetDraft.mockReturnValue(draft);
      mockBlotatoPublish.mockResolvedValue({ postId: 'blotato-789', status: 'scheduled' });

      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      await publishDraftViaBlotato({
        draftId: 'draft-5',
        platforms: ['twitter' as any],
        format: 'xThread',
        scheduledAt: '2025-12-25T10:00:00Z',
      });

      expect(mockMarkDraftPublished).not.toHaveBeenCalled();
    });

    it('passes mediaUrls to blotato', async () => {
      const draft = {
        id: 'draft-6',
        status: 'approved',
        formats: { xThread: 'Thread with media' },
      };
      mockGetDraft.mockReturnValue(draft);
      mockBlotatoPublish.mockResolvedValue({ postId: 'blotato-999', status: 'published' });

      const { publishDraftViaBlotato } = await import('../../services/blotatoPublisher');
      await publishDraftViaBlotato({
        draftId: 'draft-6',
        platforms: ['twitter' as any],
        format: 'xThread',
        mediaUrls: ['https://example.com/image.png'],
      });

      expect(mockBlotatoPublish).toHaveBeenCalledWith(expect.objectContaining({
        mediaUrls: ['https://example.com/image.png'],
      }));
    });
  });

  describe('publishContentViaBlotato', () => {
    it('publishes raw content', async () => {
      mockBlotatoPublish.mockResolvedValue({ postId: 'raw-123', status: 'published' });
      const { publishContentViaBlotato } = await import('../../services/blotatoPublisher');
      const result = await publishContentViaBlotato(
        'Hello world!',
        ['twitter' as any],
      );
      expect(result.postId).toBe('raw-123');
      expect(mockBlotatoPublish).toHaveBeenCalledWith({
        platforms: ['twitter'],
        content: 'Hello world!',
        scheduledAt: undefined,
        mediaUrls: undefined,
      });
    });

    it('passes scheduledAt and mediaUrls', async () => {
      mockBlotatoPublish.mockResolvedValue({ postId: 'sched-123', status: 'scheduled' });
      const { publishContentViaBlotato } = await import('../../services/blotatoPublisher');
      await publishContentViaBlotato(
        'Scheduled post',
        ['linkedin' as any],
        '2025-12-01T09:00:00Z',
        ['https://example.com/img.jpg'],
      );
      expect(mockBlotatoPublish).toHaveBeenCalledWith({
        platforms: ['linkedin'],
        content: 'Scheduled post',
        scheduledAt: '2025-12-01T09:00:00Z',
        mediaUrls: ['https://example.com/img.jpg'],
      });
    });
  });

  describe('getBlotatoQueue', () => {
    it('returns the queue', async () => {
      mockBlotatoGetQueue.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]);
      const { getBlotatoQueue } = await import('../../services/blotatoPublisher');
      const queue = await getBlotatoQueue();
      expect(queue).toHaveLength(2);
    });
  });

  describe('getBlotatoPostStatus', () => {
    it('returns post status', async () => {
      mockBlotatoGetPost.mockResolvedValue({ postId: 'p123', status: 'published' });
      const { getBlotatoPostStatus } = await import('../../services/blotatoPublisher');
      const status = await getBlotatoPostStatus('p123');
      expect(status.postId).toBe('p123');
    });
  });

  describe('cancelBlotatoPost', () => {
    it('cancels a post', async () => {
      mockBlotatoCancelPost.mockResolvedValue({ cancelled: true });
      const { cancelBlotatoPost } = await import('../../services/blotatoPublisher');
      const result = await cancelBlotatoPost('p123');
      expect(result.cancelled).toBe(true);
    });
  });

  describe('listBlotatoAccounts', () => {
    it('returns account list', async () => {
      mockBlotatoListAccounts.mockResolvedValue([{ id: 'acc1', platform: 'twitter' }]);
      const { listBlotatoAccounts } = await import('../../services/blotatoPublisher');
      const accounts = await listBlotatoAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].platform).toBe('twitter');
    });
  });
});
