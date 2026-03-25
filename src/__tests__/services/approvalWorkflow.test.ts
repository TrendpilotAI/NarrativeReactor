/**
 * Tests: Approval Workflow service
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  submitForReview,
  approveContent,
  rejectContent,
  getReviewQueue,
  getReviewByContentId,
} from '../../services/approvalWorkflow';

describe('Approval Workflow Service', () => {
  // Use unique content IDs per test to avoid collisions with in-memory DB
  const makeId = () => `content-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  describe('submitForReview', () => {
    it('creates a new review in "review" state', () => {
      const contentId = makeId();
      const review = submitForReview(contentId, 'brand-1');
      expect(review.contentId).toBe(contentId);
      expect(review.brandId).toBe('brand-1');
      expect(review.state).toBe('review');
      expect(review.history.length).toBeGreaterThan(0);
      expect(review.id).toBeDefined();
    });

    it('re-submits an existing draft review', () => {
      const contentId = makeId();
      const r1 = submitForReview(contentId, 'brand-1');
      // Submit again (re-open)
      const r2 = submitForReview(contentId, 'brand-1');
      expect(r2.state).toBe('review');
      expect(r2.history.length).toBeGreaterThan(r1.history.length);
    });
  });

  describe('approveContent', () => {
    it('approves a review in "review" state', () => {
      const contentId = makeId();
      submitForReview(contentId, 'brand-1');
      const approved = approveContent(contentId, 'reviewer-1');
      expect(approved.state).toBe('approved');
      expect(approved.history.at(-1)?.by).toBe('reviewer-1');
    });

    it('throws when content not found', () => {
      expect(() => approveContent('no-such-content', 'reviewer')).toThrow('No review found');
    });

    it('throws when content is not in review state', () => {
      const contentId = makeId();
      submitForReview(contentId, 'brand-1');
      approveContent(contentId, 'reviewer-1'); // approve once
      // Try to approve again (now in "approved" state)
      expect(() => approveContent(contentId, 'reviewer-1')).toThrow('not in review state');
    });
  });

  describe('rejectContent', () => {
    it('rejects a review with reason', () => {
      const contentId = makeId();
      submitForReview(contentId, 'brand-1');
      const rejected = rejectContent(contentId, 'reviewer-2', 'Needs more work');
      expect(rejected.state).toBe('rejected');
      expect(rejected.history.at(-1)?.reason).toBe('Needs more work');
    });

    it('throws when content not found', () => {
      expect(() => rejectContent('missing', 'reviewer', 'reason')).toThrow('No review found');
    });

    it('throws when not in review state', () => {
      const contentId = makeId();
      submitForReview(contentId, 'brand-1');
      approveContent(contentId, 'reviewer-1');
      expect(() => rejectContent(contentId, 'reviewer-1', 'too late')).toThrow('not in review state');
    });
  });

  describe('getReviewQueue', () => {
    it('returns an array', () => {
      const queue = getReviewQueue();
      expect(Array.isArray(queue)).toBe(true);
    });

    it('filters by brandId when provided', () => {
      const contentId1 = makeId();
      const contentId2 = makeId();
      submitForReview(contentId1, 'brand-filter-test-A');
      submitForReview(contentId2, 'brand-filter-test-B');
      const queueA = getReviewQueue('brand-filter-test-A');
      expect(queueA.every(r => r.brandId === 'brand-filter-test-A')).toBe(true);
    });
  });

  describe('getReviewByContentId', () => {
    it('returns review for existing content', () => {
      const contentId = makeId();
      submitForReview(contentId, 'brand-1');
      const found = getReviewByContentId(contentId);
      expect(found).toBeDefined();
      expect(found!.contentId).toBe(contentId);
    });

    it('returns undefined for unknown content', () => {
      expect(getReviewByContentId('no-such-id')).toBeUndefined();
    });
  });
});
