import { getBrand, Brand } from './brandManager.js';
import { analyzeContent, ToneMetrics, getProfilesByBrand } from './voiceCloner.js';

export interface ScoreBreakdown {
  keywordScore: number;       // 0-100
  toneScore: number;          // 0-100
  guidelineScore: number;     // 0-100
  prohibitedWordPenalty: number; // 0-100 (deduction)
  overall: number;            // 0-100
}

export interface ScoringResult {
  brandId: string;
  contentSnippet: string;
  breakdown: ScoreBreakdown;
  suggestions: string[];
  scoredAt: string;
}

function computeKeywordScore(text: string, brand: Brand): number {
  const lower = text.toLowerCase();
  const keywords = brand.guidelines.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  if (keywords.length === 0) return 50;
  const uniqueKeywords = [...new Set(keywords)];
  const found = uniqueKeywords.filter(kw => lower.includes(kw)).length;
  return Math.min(100, Math.round((found / Math.min(uniqueKeywords.length, 10)) * 100));
}

function computeToneScore(metrics: ToneMetrics, brand: Brand): number {
  const toneLower = brand.voiceTone.toLowerCase();
  let score = 50;
  if (toneLower.includes('formal') && metrics.formality > 0.5) score += 20;
  else if (toneLower.includes('casual') && metrics.formality < 0.5) score += 20;
  if (toneLower.includes('enthusiast') && metrics.enthusiasm > 0.3) score += 15;
  if (toneLower.includes('confident') && metrics.sentimentPolarity > 0) score += 10;
  if (toneLower.includes('approachable') && metrics.formality < 0.7) score += 5;
  return Math.min(100, score);
}

function computeGuidelineScore(text: string, brand: Brand): number {
  const lower = text.toLowerCase();
  const guidelineWords = brand.guidelines.toLowerCase().split(/\s+/).filter(w => w.length > 5);
  if (guidelineWords.length === 0) return 70;
  const unique = [...new Set(guidelineWords)].slice(0, 15);
  const matches = unique.filter(w => lower.includes(w)).length;
  return Math.min(100, Math.round((matches / unique.length) * 100));
}

function computeProhibitedPenalty(text: string, brand: Brand): number {
  const lower = text.toLowerCase();
  const found = brand.prohibitedWords.filter(w => lower.includes(w.toLowerCase()));
  return Math.min(100, found.length * 25);
}

export function scoreContent(brandId: string, content: string): ScoringResult {
  const brand = getBrand(brandId);
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const metrics = analyzeContent(content);
  const keywordScore = computeKeywordScore(content, brand);
  const toneScore = computeToneScore(metrics, brand);
  const guidelineScore = computeGuidelineScore(content, brand);
  const prohibitedWordPenalty = computeProhibitedPenalty(content, brand);

  const raw = (keywordScore * 0.25 + toneScore * 0.35 + guidelineScore * 0.25 + (100 - prohibitedWordPenalty) * 0.15);
  const overall = Math.max(0, Math.min(100, Math.round(raw)));

  const suggestions: string[] = [];
  if (keywordScore < 40) suggestions.push('Include more brand-relevant keywords from your guidelines');
  if (toneScore < 50) suggestions.push(`Adjust tone to better match brand voice: ${brand.voiceTone}`);
  if (guidelineScore < 40) suggestions.push('Review brand guidelines and align content themes');
  if (prohibitedWordPenalty > 0) {
    const found = brand.prohibitedWords.filter(w => content.toLowerCase().includes(w.toLowerCase()));
    suggestions.push(`Remove prohibited words: ${found.join(', ')}`);
  }

  return {
    brandId,
    contentSnippet: content.slice(0, 100),
    breakdown: { keywordScore, toneScore, guidelineScore, prohibitedWordPenalty, overall },
    suggestions,
    scoredAt: new Date().toISOString(),
  };
}

export function batchScore(brandId: string, contents: string[]): ScoringResult[] {
  return contents.map(c => scoreContent(brandId, c));
}
