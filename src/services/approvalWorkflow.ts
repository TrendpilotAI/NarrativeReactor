import { randomUUID } from 'crypto';
import { workflowsRepo } from '../lib/db';

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

// Run one-time import of legacy JSON data on first load
workflowsRepo.importLegacy();

export function submitForReview(contentId: string, brandId: string): ReviewRequest {
  let review = workflowsRepo.getByContentId(contentId);
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
  }
  workflowsRepo.upsert(review);
  return review;
}

export function approveContent(contentId: string, reviewerId: string): ReviewRequest {
  const review = workflowsRepo.getByContentId(contentId);
  if (!review) throw new Error(`No review found for content: ${contentId}`);
  if (review.state !== 'review') throw new Error(`Content is not in review state (current: ${review.state})`);
  review.history.push({ from: 'review', to: 'approved', by: reviewerId, timestamp: new Date().toISOString() });
  review.state = 'approved';
  review.updatedAt = new Date().toISOString();
  workflowsRepo.upsert(review);
  return review;
}

export function rejectContent(contentId: string, reviewerId: string, reason: string): ReviewRequest {
  const review = workflowsRepo.getByContentId(contentId);
  if (!review) throw new Error(`No review found for content: ${contentId}`);
  if (review.state !== 'review') throw new Error(`Content is not in review state (current: ${review.state})`);
  review.history.push({ from: 'review', to: 'rejected', by: reviewerId, reason, timestamp: new Date().toISOString() });
  review.state = 'rejected';
  review.updatedAt = new Date().toISOString();
  workflowsRepo.upsert(review);
  return review;
}

export function getReviewQueue(brandId?: string): ReviewRequest[] {
  return workflowsRepo.getQueue(brandId);
}

export function getReviewByContentId(contentId: string): ReviewRequest | undefined {
  return workflowsRepo.getByContentId(contentId);
}
