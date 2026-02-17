import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type WorkflowState = 'draft' | 'review' | 'approved' | 'published' | 'rejected';

export interface WorkflowHistoryEntry {
  from: WorkflowState;
  to: WorkflowState;
  by: string;
  reason?: string;
  timestamp: string;
}

export interface ReviewRequest {
  id: string;
  contentId: string;
  brandId: string;
  state: WorkflowState;
  history: WorkflowHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowData {
  reviews: ReviewRequest[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WF_FILE = path.join(DATA_DIR, 'workflows.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): WorkflowData {
  ensureDataDir();
  if (!fs.existsSync(WF_FILE)) return { reviews: [] };
  try { return JSON.parse(fs.readFileSync(WF_FILE, 'utf-8')); } catch { return { reviews: [] }; }
}

function save(data: WorkflowData): void {
  ensureDataDir();
  fs.writeFileSync(WF_FILE, JSON.stringify(data, null, 2));
}

function findReview(data: WorkflowData, contentId: string): ReviewRequest | undefined {
  return data.reviews.find(r => r.contentId === contentId);
}

export function submitForReview(contentId: string, brandId: string): ReviewRequest {
  const data = load();
  let review = findReview(data, contentId);
  if (review) {
    const prev = review.state;
    review.state = 'review';
    review.brandId = brandId;
    review.history.push({ from: prev, to: 'review', by: 'system', timestamp: new Date().toISOString() });
    review.updatedAt = new Date().toISOString();
  } else {
    review = {
      id: randomUUID(),
      contentId,
      brandId,
      state: 'review',
      history: [{ from: 'draft', to: 'review', by: 'system', timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.reviews.push(review);
  }
  save(data);
  return review;
}

export function approveContent(contentId: string, reviewerId: string): ReviewRequest {
  const data = load();
  const review = findReview(data, contentId);
  if (!review) throw new Error(`No review found for content: ${contentId}`);
  if (review.state !== 'review') throw new Error(`Content is not in review state (current: ${review.state})`);
  review.history.push({ from: 'review', to: 'approved', by: reviewerId, timestamp: new Date().toISOString() });
  review.state = 'approved';
  review.updatedAt = new Date().toISOString();
  save(data);
  return review;
}

export function rejectContent(contentId: string, reviewerId: string, reason: string): ReviewRequest {
  const data = load();
  const review = findReview(data, contentId);
  if (!review) throw new Error(`No review found for content: ${contentId}`);
  if (review.state !== 'review') throw new Error(`Content is not in review state (current: ${review.state})`);
  review.history.push({ from: 'review', to: 'rejected', by: reviewerId, reason, timestamp: new Date().toISOString() });
  review.state = 'rejected';
  review.updatedAt = new Date().toISOString();
  save(data);
  return review;
}

export function getReviewQueue(brandId?: string): ReviewRequest[] {
  const data = load();
  return data.reviews.filter(r => r.state === 'review' && (!brandId || r.brandId === brandId));
}

export function getReviewByContentId(contentId: string): ReviewRequest | undefined {
  return findReview(load(), contentId);
}
