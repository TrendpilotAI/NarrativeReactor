import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface ScheduledPost {
    id: string;
    content: string;
    platform: string;
    scheduledAt: string; // ISO 8601
    createdAt: string;
    status: 'scheduled' | 'published' | 'cancelled';
}

const CALENDAR_PATH = path.join(process.cwd(), 'data', 'calendar.json');

async function loadCalendar(): Promise<ScheduledPost[]> {
    try {
        const data = await fs.readFile(CALENDAR_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveCalendar(posts: ScheduledPost[]): Promise<void> {
    await fs.mkdir(path.dirname(CALENDAR_PATH), { recursive: true });
    await fs.writeFile(CALENDAR_PATH, JSON.stringify(posts, null, 2));
}

export async function schedulePost(content: string, platform: string, scheduledAt: string): Promise<ScheduledPost> {
    const posts = await loadCalendar();
    const post: ScheduledPost = {
        id: crypto.randomUUID(),
        content,
        platform,
        scheduledAt,
        createdAt: new Date().toISOString(),
        status: 'scheduled',
    };
    posts.push(post);
    await saveCalendar(posts);
    return post;
}

export async function getSchedule(startDate: string, endDate: string): Promise<ScheduledPost[]> {
    const posts = await loadCalendar();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return posts.filter(p => {
        const t = new Date(p.scheduledAt).getTime();
        return t >= start && t <= end && p.status === 'scheduled';
    });
}

export async function cancelPost(id: string): Promise<ScheduledPost | null> {
    const posts = await loadCalendar();
    const post = posts.find(p => p.id === id);
    if (!post) return null;
    post.status = 'cancelled';
    await saveCalendar(posts);
    return post;
}

export async function getNextDue(): Promise<ScheduledPost | null> {
    const posts = await loadCalendar();
    const now = Date.now();
    const due = posts
        .filter(p => p.status === 'scheduled' && new Date(p.scheduledAt).getTime() <= now)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return due[0] || null;
}
