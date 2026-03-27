/**
 * Tests: Calendar service — uses chdir for temp isolation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-calendar-test-'));
const dataDir = path.join(tmpDir, 'data');
const calFile = path.join(dataDir, 'calendar.json');
const originalCwd = process.cwd();

describe('Calendar Service', () => {
  beforeEach(() => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(calFile)) fs.unlinkSync(calFile);
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('schedulePost creates a post with correct fields', async () => {
    const { schedulePost } = await import('../../services/calendar');
    const post = await schedulePost(
      'Test content',
      'twitter',
      new Date(Date.now() + 3600000).toISOString(),
    );
    expect(post.id).toBeDefined();
    expect(post.content).toBe('Test content');
    expect(post.platform).toBe('twitter');
    expect(post.status).toBe('scheduled');
    expect(post.createdAt).toBeDefined();
  });

  it('schedulePost generates unique IDs', async () => {
    const { schedulePost } = await import('../../services/calendar');
    const future = new Date(Date.now() + 3600000).toISOString();
    const p1 = await schedulePost('Content 1', 'twitter', future);
    const p2 = await schedulePost('Content 2', 'linkedin', future);
    expect(p1.id).not.toBe(p2.id);
  });

  it('getSchedule returns posts within date range', async () => {
    const { schedulePost, getSchedule } = await import('../../services/calendar');
    const now = Date.now();
    const inRange = new Date(now + 3600000).toISOString();
    const outOfRange = new Date(now + 86400000 * 5).toISOString();
    await schedulePost('In range', 'twitter', inRange);
    await schedulePost('Out of range', 'twitter', outOfRange);

    const start = new Date(now).toISOString();
    const end = new Date(now + 86400000).toISOString();
    const schedule = await getSchedule(start, end);
    expect(schedule.length).toBe(1);
    expect(schedule[0].content).toBe('In range');
  });

  it('getSchedule returns empty array when no posts in range', async () => {
    const { getSchedule } = await import('../../services/calendar');
    const future = new Date(Date.now() + 86400000 * 10).toISOString();
    const futureEnd = new Date(Date.now() + 86400000 * 20).toISOString();
    const result = await getSchedule(future, futureEnd);
    expect(result).toEqual([]);
  });

  it('cancelPost cancels an existing post', async () => {
    const { schedulePost, cancelPost } = await import('../../services/calendar');
    const post = await schedulePost('To cancel', 'twitter', new Date(Date.now() + 3600000).toISOString());
    const cancelled = await cancelPost(post.id);
    expect(cancelled).not.toBeNull();
    expect(cancelled!.status).toBe('cancelled');
  });

  it('cancelPost returns null for non-existent post', async () => {
    const { cancelPost } = await import('../../services/calendar');
    const result = await cancelPost('nonexistent-id');
    expect(result).toBeNull();
  });

  it('getNextDue returns null when no posts are due', async () => {
    const { getNextDue } = await import('../../services/calendar');
    const result = await getNextDue();
    expect(result).toBeNull();
  });

  it('getNextDue returns overdue post', async () => {
    const { schedulePost, getNextDue } = await import('../../services/calendar');
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    await schedulePost('Past post', 'twitter', pastTime);
    const due = await getNextDue();
    expect(due).not.toBeNull();
    expect(due!.content).toBe('Past post');
  });

  it('markPublished marks post as published', async () => {
    const { schedulePost, markPublished } = await import('../../services/calendar');
    const post = await schedulePost('To publish', 'linkedin', new Date(Date.now() + 3600000).toISOString());
    const published = await markPublished(post.id);
    expect(published).not.toBeNull();
    expect(published!.status).toBe('published');
  });

  it('markPublished returns null for non-existent id', async () => {
    const { markPublished } = await import('../../services/calendar');
    const result = await markPublished('does-not-exist');
    expect(result).toBeNull();
  });

  it('getSchedule excludes cancelled posts', async () => {
    const { schedulePost, cancelPost, getSchedule } = await import('../../services/calendar');
    const now = Date.now();
    const inRange = new Date(now + 3600000).toISOString();
    const post = await schedulePost('Will cancel', 'twitter', inRange);
    await cancelPost(post.id);
    const start = new Date(now).toISOString();
    const end = new Date(now + 86400000).toISOString();
    const schedule = await getSchedule(start, end);
    expect(schedule.find(p => p.id === post.id)).toBeUndefined();
  });
});
