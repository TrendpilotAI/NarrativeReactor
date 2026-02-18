/**
 * Content Generation Pipeline
 * Topic → AI Research → Multi-format Drafts → Approval
 *
 * Produces content in three formats: X thread, LinkedIn post, blog article.
 */

import { ai } from '../genkit.config';
import { generateCopyClaude } from '../lib/claude';
import { z } from 'genkit';
import crypto from 'crypto';

// ── Types ──

export interface PipelineInput {
  topic: string;
  context?: string;       // Optional additional context / brand brief
  useClaude?: boolean;     // Use Claude instead of Gemini
  brandGuidelines?: string;
}

export interface ResearchResult {
  summary: string;
  keyPoints: string[];
  angles: string[];
  sources: string[];
}

export interface ContentDraft {
  id: string;
  topic: string;
  research: ResearchResult;
  formats: {
    xThread: string;
    linkedinPost: string;
    blogArticle: string;
  };
  status: 'draft' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  updatedAt: string;
  feedback?: string;
}

// ── In-memory draft store ──
const drafts = new Map<string, ContentDraft>();

// ── Step 1: Research ──

export async function researchTopic(topic: string, context?: string): Promise<ResearchResult> {
  const prompt = `You are a research analyst. Analyze the following topic and provide structured research.

TOPIC: ${topic}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

Respond in this exact JSON format (no markdown, no code fences):
{
  "summary": "2-3 sentence executive summary",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "angles": ["unique angle 1", "unique angle 2", "unique angle 3"],
  "sources": ["relevant domain/topic area 1", "relevant domain/topic area 2"]
}`;

  const { text } = await ai.generate({ prompt });

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned) as ResearchResult;
  } catch {
    return {
      summary: text.slice(0, 500),
      keyPoints: [text.slice(0, 200)],
      angles: ['General analysis'],
      sources: [],
    };
  }
}

// ── Step 2: Generate Multi-format Drafts ──

async function generateFormat(
  format: 'xThread' | 'linkedinPost' | 'blogArticle',
  topic: string,
  research: ResearchResult,
  guidelines?: string,
  useClaude?: boolean,
): Promise<string> {
  const formatInstructions: Record<string, string> = {
    xThread: `Write an X (Twitter) thread about this topic. 
- 4-7 tweets, each under 280 characters
- Number each tweet (1/, 2/, etc.)
- First tweet should hook attention
- Last tweet should have a CTA
- Include 2-3 relevant hashtags on the last tweet
- Separate tweets with blank lines`,

    linkedinPost: `Write a LinkedIn post about this topic.
- Professional but engaging tone
- 1000-2000 characters
- Start with a hook line
- Use line breaks for readability
- Include a thought-provoking question at the end
- Add 3-5 relevant hashtags`,

    blogArticle: `Write a blog article about this topic.
- 500-800 words
- Include a compelling headline (first line, prefixed with #)
- Use subheadings (## format)
- Professional yet accessible tone
- Include an introduction, 2-3 main sections, and conclusion
- End with a call to action`,
  };

  const prompt = `${formatInstructions[format]}

TOPIC: ${topic}

RESEARCH:
Summary: ${research.summary}
Key Points: ${research.keyPoints.join('; ')}
Angles: ${research.angles.join('; ')}
${guidelines ? `\nBRAND GUIDELINES:\n${guidelines}` : ''}

Write the content now:`;

  if (useClaude) {
    return await generateCopyClaude({
      episodeId: topic,
      platform: format === 'xThread' ? 'twitter' : format === 'linkedinPost' ? 'linkedin' : 'threads',
      context: prompt,
      guidelines: guidelines || '',
    });
  }

  const { text } = await ai.generate({ prompt });
  return text;
}

// ── Full Pipeline ──

export async function runContentPipeline(input: PipelineInput): Promise<ContentDraft> {
  // Step 1: Research
  const research = await researchTopic(input.topic, input.context);

  // Step 2: Generate all three formats in parallel
  const [xThread, linkedinPost, blogArticle] = await Promise.all([
    generateFormat('xThread', input.topic, research, input.brandGuidelines, input.useClaude),
    generateFormat('linkedinPost', input.topic, research, input.brandGuidelines, input.useClaude),
    generateFormat('blogArticle', input.topic, research, input.brandGuidelines, input.useClaude),
  ]);

  const draft: ContentDraft = {
    id: crypto.randomUUID(),
    topic: input.topic,
    research,
    formats: { xThread, linkedinPost, blogArticle },
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  drafts.set(draft.id, draft);
  return draft;
}

// ── Draft Management ──

export function getDraft(id: string): ContentDraft | undefined {
  return drafts.get(id);
}

export function listDrafts(status?: string): ContentDraft[] {
  const all = Array.from(drafts.values());
  if (status) return all.filter(d => d.status === status);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function approveDraft(id: string): ContentDraft | undefined {
  const draft = drafts.get(id);
  if (!draft) return undefined;
  draft.status = 'approved';
  draft.updatedAt = new Date().toISOString();
  return draft;
}

export function rejectDraft(id: string, feedback: string): ContentDraft | undefined {
  const draft = drafts.get(id);
  if (!draft) return undefined;
  draft.status = 'rejected';
  draft.feedback = feedback;
  draft.updatedAt = new Date().toISOString();
  return draft;
}

export function updateDraftContent(
  id: string,
  format: 'xThread' | 'linkedinPost' | 'blogArticle',
  content: string,
): ContentDraft | undefined {
  const draft = drafts.get(id);
  if (!draft) return undefined;
  draft.formats[format] = content;
  draft.updatedAt = new Date().toISOString();
  // Reset to draft if it was rejected (re-editing)
  if (draft.status === 'rejected') draft.status = 'draft';
  return draft;
}

export function markDraftPublished(id: string): ContentDraft | undefined {
  const draft = drafts.get(id);
  if (!draft) return undefined;
  draft.status = 'published';
  draft.updatedAt = new Date().toISOString();
  return draft;
}
