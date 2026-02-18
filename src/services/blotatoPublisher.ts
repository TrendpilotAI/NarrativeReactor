/**
 * Blotato Publisher Service
 * Bridges the content pipeline with Blotato API for cross-platform publishing.
 */

import {
  blotatoPublish,
  blotatoGetQueue,
  blotatoGetPost,
  blotatoCancelPost,
  blotatoListAccounts,
  BlotatoPlatform,
  BlotatoPostResult,
} from '../lib/blotato';
import { getDraft, markDraftPublished, ContentDraft } from './contentPipeline';
import { formatForPlatform } from './publisher';

export interface PublishDraftRequest {
  draftId: string;
  platforms: BlotatoPlatform[];
  format: 'xThread' | 'linkedinPost' | 'blogArticle';
  scheduledAt?: string; // ISO 8601 for scheduled publishing
  mediaUrls?: string[];
}

export interface PublishDraftResult {
  draftId: string;
  blotatoResult: BlotatoPostResult;
  content: string;
}

/**
 * Publish a draft via Blotato to specified platforms.
 */
export async function publishDraftViaBlotato(req: PublishDraftRequest): Promise<PublishDraftResult> {
  const draft = getDraft(req.draftId);
  if (!draft) {
    throw new Error(`Draft ${req.draftId} not found`);
  }

  if (draft.status !== 'approved' && draft.status !== 'draft') {
    throw new Error(`Draft ${req.draftId} is ${draft.status}, cannot publish`);
  }

  const content = draft.formats[req.format];
  if (!content) {
    throw new Error(`Format ${req.format} not found in draft`);
  }

  const result = await blotatoPublish({
    platforms: req.platforms,
    content,
    scheduledAt: req.scheduledAt,
    mediaUrls: req.mediaUrls,
  });

  // Mark as published if immediate
  if (!req.scheduledAt) {
    markDraftPublished(req.draftId);
  }

  return {
    draftId: req.draftId,
    blotatoResult: result,
    content,
  };
}

/**
 * Publish raw content (not from a draft) via Blotato.
 */
export async function publishContentViaBlotato(
  content: string,
  platforms: BlotatoPlatform[],
  scheduledAt?: string,
  mediaUrls?: string[],
): Promise<BlotatoPostResult> {
  return blotatoPublish({
    platforms,
    content,
    scheduledAt,
    mediaUrls,
  });
}

/**
 * Get the Blotato publishing queue.
 */
export async function getBlotatoQueue() {
  return blotatoGetQueue();
}

/**
 * Get status of a Blotato post.
 */
export async function getBlotatoPostStatus(postId: string) {
  return blotatoGetPost(postId);
}

/**
 * Cancel a scheduled Blotato post.
 */
export async function cancelBlotatoPost(postId: string) {
  return blotatoCancelPost(postId);
}

/**
 * List connected Blotato accounts.
 */
export async function listBlotatoAccounts() {
  return blotatoListAccounts();
}
