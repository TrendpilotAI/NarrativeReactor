import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startScheduler, stopScheduler } from '../../services/schedulerWorker';
import * as calendar from '../../services/calendar';
import * as publisher from '../../services/publisher';

vi.mock('../../services/calendar', () => ({
  getNextDue: vi.fn(),
  markPublished: vi.fn(),
}));

vi.mock('../../services/publisher', () => ({
  publishToAll: vi.fn(),
}));

describe('schedulerWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopScheduler();
    vi.useRealTimers();
  });

  it('starts and processes due posts on first tick', async () => {
    const mockPost = {
      id: 'post-1',
      content: 'Hello world',
      platform: 'twitter',
      scheduledAt: new Date(Date.now() - 60000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'scheduled' as const,
    };

    // First call returns a post, second call returns null (no more due)
    vi.mocked(calendar.getNextDue)
      .mockResolvedValueOnce(mockPost)
      .mockResolvedValueOnce(null);
    vi.mocked(calendar.markPublished).mockResolvedValue(mockPost);
    vi.mocked(publisher.publishToAll).mockResolvedValue([]);

    startScheduler();

    // Let the initial tick run
    await vi.advanceTimersByTimeAsync(100);

    expect(publisher.publishToAll).toHaveBeenCalledWith('Hello world', ['twitter']);
    expect(calendar.markPublished).toHaveBeenCalledWith('post-1');
  });

  it('does not mark as published on publish failure', async () => {
    const mockPost = {
      id: 'post-2',
      content: 'Fail post',
      platform: 'linkedin',
      scheduledAt: new Date(Date.now() - 60000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'scheduled' as const,
    };

    vi.mocked(calendar.getNextDue).mockResolvedValueOnce(mockPost);
    vi.mocked(publisher.publishToAll).mockRejectedValueOnce(new Error('API down'));

    startScheduler();
    await vi.advanceTimersByTimeAsync(100);

    expect(publisher.publishToAll).toHaveBeenCalled();
    expect(calendar.markPublished).not.toHaveBeenCalled();
  });

  it('is idempotent — calling startScheduler twice does not double-run', async () => {
    vi.mocked(calendar.getNextDue).mockResolvedValue(null);

    startScheduler();
    startScheduler(); // should warn and not create second interval

    await vi.advanceTimersByTimeAsync(100);
    // Only one initial tick worth of calls
    expect(calendar.getNextDue).toHaveBeenCalledTimes(1);
  });
});
