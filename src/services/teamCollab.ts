import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface Assignment {
  id: string;
  contentId: string;
  userId: string;
  deadline: string;
  status: 'pending' | 'in-progress' | 'done';
  createdAt: string;
}

export interface Comment {
  id: string;
  contentId: string;
  userId: string;
  comment: string;
  parentId?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface CollabData {
  assignments: Assignment[];
  comments: Comment[];
  notifications: Notification[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const COLLAB_FILE = path.join(DATA_DIR, 'collab.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): CollabData {
  ensureDataDir();
  if (!fs.existsSync(COLLAB_FILE)) return { assignments: [], comments: [], notifications: [] };
  try { return JSON.parse(fs.readFileSync(COLLAB_FILE, 'utf-8')); } catch { return { assignments: [], comments: [], notifications: [] }; }
}

function save(data: CollabData): void {
  ensureDataDir();
  fs.writeFileSync(COLLAB_FILE, JSON.stringify(data, null, 2));
}

function addNotification(data: CollabData, userId: string, message: string): void {
  data.notifications.push({
    id: randomUUID(),
    userId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

export function assignTask(contentId: string, userId: string, deadline: string): Assignment {
  const data = load();
  const assignment: Assignment = {
    id: randomUUID(),
    contentId,
    userId,
    deadline,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  data.assignments.push(assignment);
  addNotification(data, userId, `You've been assigned content ${contentId}. Deadline: ${deadline}`);
  save(data);
  return assignment;
}

export function addComment(contentId: string, userId: string, comment: string, parentId?: string): Comment {
  const data = load();
  const entry: Comment = {
    id: randomUUID(),
    contentId,
    userId,
    comment,
    parentId,
    createdAt: new Date().toISOString(),
  };
  data.comments.push(entry);
  save(data);
  return entry;
}

export function getComments(contentId: string): Comment[] {
  return load().comments.filter(c => c.contentId === contentId);
}

export function getAssignments(userId: string): Assignment[] {
  return load().assignments.filter(a => a.userId === userId);
}

export function getNotifications(userId: string): Notification[] {
  return load().notifications.filter(n => n.userId === userId);
}
