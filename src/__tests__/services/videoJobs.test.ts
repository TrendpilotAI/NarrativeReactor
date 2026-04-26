import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { closeDatabase, getDatabase } from '../../lib/database';

const { mockGenerateVideo, mockPublishContentViaBlotato } = vi.hoisted(() => ({
  mockGenerateVideo: vi.fn(),
  mockPublishContentViaBlotato: vi.fn(),
}));

vi.mock('../../lib/fal', () => ({
  generateVideo: mockGenerateVideo,
}));

vi.mock('../../services/blotatoPublisher', () => ({
  publishContentViaBlotato: mockPublishContentViaBlotato,
}));

const {
  approveVideoJob,
  createVideoJob,
  getVideoJob,
  publishApprovedVideoJob,
  rejectVideoJob,
  renderShortFormVideo,
} = await import('../../services/videoJobs');

describe('videoJobs service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_PATH = ':memory:';
    getDatabase().exec('DELETE FROM video_render_jobs');
    mockGenerateVideo.mockResolvedValue({
      url: 'https://cdn.test/video.mp4',
      modelId: 'fal-ai/seedance',
      cost: 0.2,
      duration: 15,
      metadata: { aspectRatio: '9:16' },
    });
    mockPublishContentViaBlotato.mockResolvedValue({
      id: 'post-123',
      status: 'queued',
      platforms: [{ platform: 'youtube', status: 'pending' }],
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates and fetches a queued video job', () => {
    const job = createVideoJob({
      theme: 'FlipMyEra launch',
      platformTargets: ['youtube'],
    });

    const fetched = getVideoJob(job.id);
    expect(fetched).toMatchObject({
      status: 'queued',
      publishingStatus: 'pending_approval',
      theme: 'FlipMyEra launch',
      aspectRatio: '9:16',
      durationSeconds: 30,
      platformTargets: ['youtube'],
    });
  });

  it('renders a short-form job and preserves review status', async () => {
    const job = await renderShortFormVideo({
      theme: 'Swiftie alternate timeline',
      script: 'Your era begins with one choice.',
      platformTargets: ['tiktok'],
      coverImageUrl: 'https://cdn.test/cover.jpg',
    });

    expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'tiktok',
      aspectRatio: '9:16',
      durationSeconds: 30,
      sourceJobId: job.id,
    }));
    expect(job).toMatchObject({
      status: 'rendered',
      publishingStatus: 'pending_approval',
      videoUrl: 'https://cdn.test/video.mp4',
      thumbnailUrl: 'https://cdn.test/cover.jpg',
    });
    expect(job.captions?.raw).toContain('Your era begins');
    expect(job.score?.overallScore).toBeGreaterThan(0);
  });

  it('marks render failures explicitly', async () => {
    mockGenerateVideo.mockRejectedValueOnce(new Error('GPU timeout'));

    const job = await renderShortFormVideo({
      theme: 'Failure case',
      platformTargets: ['youtube'],
    });

    expect(job.status).toBe('failed');
    expect(job.publishingStatus).toBe('failed');
    expect(job.error).toContain('GPU timeout');
  });

  it('enforces approval before publishing', async () => {
    const job = await renderShortFormVideo({
      theme: 'Approval case',
      platformTargets: ['youtube'],
    });

    await expect(publishApprovedVideoJob(job.id)).rejects.toThrow('must be approved');

    const approved = approveVideoJob(job.id);
    expect(approved.publishingStatus).toBe('approved');

    const published = await publishApprovedVideoJob(job.id);
    expect(mockPublishContentViaBlotato).toHaveBeenCalledWith(
      expect.any(String),
      ['youtube'],
      undefined,
      ['https://cdn.test/video.mp4'],
      expect.objectContaining({ title: 'Approval case' }),
    );
    expect(published.publishingStatus).toBe('published');
    expect(published.blotatoResult?.id).toBe('post-123');
  });

  it('rejects unrendered jobs and rejected jobs', () => {
    const job = createVideoJob({ theme: 'Draft only', platformTargets: ['tiktok'] });
    expect(() => approveVideoJob(job.id)).toThrow('cannot approve');

    const rejected = rejectVideoJob(job.id, 'not on brand');
    expect(rejected.publishingStatus).toBe('rejected');
    expect(rejected.error).toBe('not on brand');
  });
});
