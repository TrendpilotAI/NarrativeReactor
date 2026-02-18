/**
 * Blotato API Client
 * Cross-platform social media publishing via Blotato.
 * Docs: https://docs.blotato.com (inferred from API patterns)
 */

const BLOTATO_API_KEY = process.env.BLOTATO_API_KEY || 'blt_rcytWk1X4BNvUZ3l0cIWHg44AZP9v15RwhW2bd3TSfw=';
const BLOTATO_BASE_URL = process.env.BLOTATO_BASE_URL || 'https://api.blotato.com/v1';

export interface BlotatoPostRequest {
  platforms: BlotatoPlatform[];
  content: string;
  mediaUrls?: string[];
  scheduledAt?: string; // ISO 8601 — omit for immediate
  title?: string; // For blog/LinkedIn article
}

export type BlotatoPlatform = 'x' | 'linkedin' | 'instagram' | 'threads' | 'facebook' | 'bluesky';

export interface BlotatoPostResult {
  id: string;
  status: 'queued' | 'published' | 'scheduled' | 'failed';
  platforms: BlotatoPlatformResult[];
  scheduledAt?: string;
}

export interface BlotatoPlatformResult {
  platform: BlotatoPlatform;
  status: 'success' | 'failed' | 'pending';
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface BlotatoQueueItem {
  id: string;
  content: string;
  platforms: BlotatoPlatform[];
  scheduledAt: string;
  status: 'queued' | 'published' | 'failed';
  createdAt: string;
}

async function blotatoFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BLOTATO_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${BLOTATO_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Blotato API error (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Publish content to one or more platforms via Blotato.
 * If scheduledAt is provided, the post is queued for that time.
 */
export async function blotatoPublish(req: BlotatoPostRequest): Promise<BlotatoPostResult> {
  return blotatoFetch<BlotatoPostResult>('/posts', {
    method: 'POST',
    body: JSON.stringify({
      platforms: req.platforms,
      content: req.content,
      media_urls: req.mediaUrls,
      scheduled_at: req.scheduledAt,
      title: req.title,
    }),
  });
}

/**
 * Get the scheduled queue from Blotato.
 */
export async function blotatoGetQueue(): Promise<BlotatoQueueItem[]> {
  return blotatoFetch<BlotatoQueueItem[]>('/posts/queue');
}

/**
 * Get status of a specific post.
 */
export async function blotatoGetPost(postId: string): Promise<BlotatoPostResult> {
  return blotatoFetch<BlotatoPostResult>(`/posts/${postId}`);
}

/**
 * Cancel a scheduled post.
 */
export async function blotatoCancelPost(postId: string): Promise<{ success: boolean }> {
  return blotatoFetch<{ success: boolean }>(`/posts/${postId}`, {
    method: 'DELETE',
  });
}

/**
 * List connected accounts on Blotato.
 */
export async function blotatoListAccounts(): Promise<{ platform: string; username: string; connected: boolean }[]> {
  return blotatoFetch('/accounts');
}
