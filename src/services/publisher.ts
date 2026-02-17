import { postToSocialFlow } from '../flows/integrations';

export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
  formattedContent: string;
}

// --- Platform formatters ---

function formatForTwitter(content: string): string[] {
  if (content.length <= 280) return [content];
  // Thread splitting: split on sentence boundaries, fit within 280 chars with numbering
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  const threads: string[] = [];
  let current = '';
  let idx = 1;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const prefix = `(${idx}/) `;
    if (current.length + trimmed.length + 1 <= 280 - prefix.length) {
      current = current ? `${current} ${trimmed}` : trimmed;
    } else {
      if (current) {
        threads.push(current);
        idx++;
      }
      // If single sentence > 280, hard-split
      if (trimmed.length > 280 - prefix.length) {
        let remaining = trimmed;
        while (remaining.length > 0) {
          const chunk = remaining.slice(0, 280 - `(${idx}/) `.length);
          threads.push(chunk);
          remaining = remaining.slice(chunk.length);
          if (remaining.length > 0) idx++;
        }
        current = '';
      } else {
        current = trimmed;
      }
    }
  }
  if (current) threads.push(current);

  // Add numbering
  const total = threads.length;
  if (total === 1) return threads;
  return threads.map((t, i) => `(${i + 1}/${total}) ${t}`);
}

function formatForLinkedIn(content: string): string {
  // LinkedIn supports up to ~3000 chars, return full text
  return content.slice(0, 3000);
}

function formatForThreads(content: string): string {
  return content.slice(0, 500);
}

export function formatForPlatform(content: string, platform: string): string | string[] {
  switch (platform.toLowerCase()) {
    case 'twitter':
    case 'x':
      return formatForTwitter(content);
    case 'linkedin':
      return formatForLinkedIn(content);
    case 'threads':
      return formatForThreads(content);
    default:
      return content;
  }
}

async function publishToPlatform(content: string, platform: string): Promise<PublishResult> {
  const formatted = formatForPlatform(content, platform);
  const displayContent = Array.isArray(formatted) ? formatted.join('\n---\n') : formatted;

  try {
    // For Twitter threads, post each tweet
    const messages = Array.isArray(formatted) ? formatted : [formatted];
    for (const msg of messages) {
      await postToSocialFlow({ provider: platform, message: msg });
    }
    return {
      platform,
      success: true,
      postId: `${platform}-${Date.now()}`,
      formattedContent: displayContent,
    };
  } catch (err: any) {
    return {
      platform,
      success: false,
      error: err.message || 'Unknown error',
      formattedContent: displayContent,
    };
  }
}

export async function publishToAll(content: string, platforms: string[]): Promise<PublishResult[]> {
  const results = await Promise.allSettled(
    platforms.map(p => publishToPlatform(content, p))
  );
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { platform: platforms[i], success: false, error: (r as PromiseRejectedResult).reason?.message || 'Unknown error', formattedContent: content }
  );
}
