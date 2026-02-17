import { describe, it, expect, beforeEach } from 'vitest';
import { createBrand, getBrand, listBrands, updateBrand, deleteBrand, type Brand } from '../../src/services/brandManager';
import { analyzeContent, createVoiceProfile, addSamples, getVoiceProfile, generateContentGuidance, deleteVoiceProfile } from '../../src/services/voiceCloner';
import { submitForReview, approveContent, rejectContent, getReviewQueue, getReviewByContentId } from '../../src/services/approvalWorkflow';
import { scoreContent, batchScore } from '../../src/services/brandScorer';
import { assignTask, addComment, getComments, getAssignments, getNotifications } from '../../src/services/teamCollab';

// ── Brand Manager Tests ──

describe('Brand Manager', () => {
  it('should create a brand with all fields', () => {
    const brand = createBrand({
      name: 'TestBrand',
      guidelines: 'Be professional and innovative',
      voiceTone: 'confident, formal',
      colors: ['#FF0000'],
      logos: ['logo.png'],
      targetAudience: 'developers',
      prohibitedWords: ['spam'],
    });
    expect(brand.id).toBeDefined();
    expect(brand.name).toBe('TestBrand');
    expect(brand.colors).toEqual(['#FF0000']);
    expect(brand.createdAt).toBeDefined();
  });

  it('should list and get brands', () => {
    const brands = listBrands();
    expect(brands.length).toBeGreaterThan(0);
    const first = brands[0];
    const fetched = getBrand(first.id);
    expect(fetched?.name).toBe(first.name);
  });

  it('should update a brand', () => {
    const brand = createBrand({ name: 'UpdateMe', guidelines: '', voiceTone: '', colors: [], logos: [], targetAudience: '', prohibitedWords: [] });
    const updated = updateBrand(brand.id, { name: 'Updated' });
    expect(updated?.name).toBe('Updated');
  });

  it('should delete a brand', () => {
    const brand = createBrand({ name: 'DeleteMe', guidelines: '', voiceTone: '', colors: [], logos: [], targetAudience: '', prohibitedWords: [] });
    expect(deleteBrand(brand.id)).toBe(true);
    expect(getBrand(brand.id)).toBeUndefined();
  });
});

// ── Voice Cloner Tests ──

describe('Voice Cloner', () => {
  it('should analyze content tone metrics', () => {
    const metrics = analyzeContent('This is an amazing and incredible product. We love it! Fantastic results.');
    expect(metrics.formality).toBeGreaterThanOrEqual(0);
    expect(metrics.formality).toBeLessThanOrEqual(1);
    expect(metrics.enthusiasm).toBeGreaterThan(0);
    expect(metrics.sentimentPolarity).toBeGreaterThan(0);
    expect(metrics.avgSentenceLength).toBeGreaterThan(0);
  });

  it('should create a voice profile from samples', () => {
    const profile = createVoiceProfile('brand-1', 'Formal Voice', [
      'Furthermore, we must consider the implications of this decision.',
      'Therefore, it is paramount that we proceed with caution.',
    ]);
    expect(profile.brandId).toBe('brand-1');
    expect(profile.sampleCount).toBe(2);
    expect(profile.metrics.formality).toBeGreaterThan(0.4);
  });

  it('should add samples and update metrics', () => {
    const profile = createVoiceProfile('brand-2', 'Test', ['Hello world. Simple text.']);
    const updated = addSamples(profile.id, ['Another sample with more words to analyze carefully.']);
    expect(updated.sampleCount).toBe(2);
  });

  it('should generate content guidance', () => {
    const profile = createVoiceProfile('brand-3', 'Guide', [
      'Hey cool awesome stuff! We love this amazing product! Super exciting!',
    ]);
    const guidance = generateContentGuidance(profile.id);
    expect(guidance.toneDescription).toBeDefined();
    expect(guidance.writingTips.length).toBeGreaterThan(0);
  });
});

// ── Approval Workflow Tests ──

describe('Approval Workflow', () => {
  it('should submit content for review', () => {
    const review = submitForReview('content-100', 'brand-x');
    expect(review.state).toBe('review');
    expect(review.contentId).toBe('content-100');
    expect(review.history.length).toBe(1);
  });

  it('should approve content', () => {
    submitForReview('content-approve', 'brand-x');
    const approved = approveContent('content-approve', 'reviewer-1');
    expect(approved.state).toBe('approved');
    expect(approved.history.length).toBe(2);
  });

  it('should reject content with reason', () => {
    submitForReview('content-reject', 'brand-x');
    const rejected = rejectContent('content-reject', 'reviewer-1', 'Off brand');
    expect(rejected.state).toBe('rejected');
    expect(rejected.history[1].reason).toBe('Off brand');
  });

  it('should get review queue', () => {
    submitForReview('content-queue-1', 'brand-q');
    const queue = getReviewQueue('brand-q');
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every(r => r.state === 'review')).toBe(true);
  });
});

// ── Brand Scorer Tests ──

describe('Brand Scorer', () => {
  let testBrandId: string;

  beforeEach(() => {
    const brand = createBrand({
      name: 'ScoreBrand',
      guidelines: 'Professional innovative audience-first content creation storytelling',
      voiceTone: 'confident, formal',
      colors: ['#000'],
      logos: [],
      targetAudience: 'marketers',
      prohibitedWords: ['spam', 'clickbait'],
    });
    testBrandId = brand.id;
  });

  it('should score content 0-100', () => {
    const result = scoreContent(testBrandId, 'Professional innovative content creation for storytelling audiences.');
    expect(result.breakdown.overall).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.overall).toBeLessThanOrEqual(100);
    expect(result.brandId).toBe(testBrandId);
  });

  it('should penalize prohibited words', () => {
    const clean = scoreContent(testBrandId, 'Great professional content for our audience.');
    const dirty = scoreContent(testBrandId, 'Great spam clickbait content for our audience.');
    expect(dirty.breakdown.prohibitedWordPenalty).toBeGreaterThan(0);
    expect(dirty.suggestions.some(s => s.includes('prohibited'))).toBe(true);
  });

  it('should batch score multiple contents', () => {
    const results = batchScore(testBrandId, ['Content one.', 'Content two.']);
    expect(results.length).toBe(2);
  });
});

// ── Team Collaboration Tests ──

describe('Team Collaboration', () => {
  it('should assign task and create notification', () => {
    const assignment = assignTask('content-collab-1', 'user-1', '2026-03-01');
    expect(assignment.status).toBe('pending');
    const notifs = getNotifications('user-1');
    expect(notifs.some(n => n.message.includes('content-collab-1'))).toBe(true);
  });

  it('should add and retrieve comments', () => {
    addComment('content-collab-2', 'user-2', 'Looks good!');
    addComment('content-collab-2', 'user-3', 'Needs revision.');
    const comments = getComments('content-collab-2');
    expect(comments.length).toBe(2);
  });

  it('should get assignments for user', () => {
    assignTask('content-collab-3', 'user-assign', '2026-04-01');
    const assignments = getAssignments('user-assign');
    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments[0].userId).toBe('user-assign');
  });
});
