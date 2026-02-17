import { getBrand } from './brandManager';

export interface VoiceProfile {
  formality: number;       // 0-100
  humor: number;           // 0-100
  technicality: number;    // 0-100
  avgSentenceLength: number;
  favoriteWords: string[];
  avoidWords: string[];
}

/**
 * Analyze sample content to extract a voice profile.
 */
export function analyzeBrandVoice(sampleContent: string[]): VoiceProfile {
  const allText = sampleContent.join(' ');
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = allText.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  // Avg sentence length
  const avgSentenceLength = sentences.length > 0
    ? Math.round(words.length / sentences.length)
    : 0;

  // Word frequency
  const freq: Record<string, number> = {};
  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, '');
    if (clean.length > 3) freq[clean] = (freq[clean] || 0) + 1;
  }
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const favoriteWords = sorted.slice(0, 10).map(([w]) => w);

  // Heuristic scores
  const formalWords = ['therefore', 'furthermore', 'consequently', 'nevertheless', 'accordingly', 'regarding'];
  const humorWords = ['lol', 'haha', 'funny', 'joke', 'laugh', '😂', '🤣', 'hilarious'];
  const techWords = ['algorithm', 'api', 'infrastructure', 'implementation', 'framework', 'architecture', 'deploy'];

  const countMatches = (list: string[]) => words.filter(w => list.includes(w.replace(/[^a-z]/g, ''))).length;

  const formality = Math.min(100, Math.round((countMatches(formalWords) / Math.max(words.length, 1)) * 2000 + (avgSentenceLength > 15 ? 30 : 10)));
  const humor = Math.min(100, Math.round((countMatches(humorWords) / Math.max(words.length, 1)) * 2000));
  const technicality = Math.min(100, Math.round((countMatches(techWords) / Math.max(words.length, 1)) * 2000));

  return { formality, humor, technicality, avgSentenceLength, favoriteWords, avoidWords: [] };
}

/**
 * Generate content instructions styled in a brand's voice.
 */
export function generateWithVoice(prompt: string, brandId: string): { prompt: string; voiceInstructions: string; brandId: string } {
  const brand = getBrand(brandId);
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const voiceInstructions = [
    `Write in a ${brand.voiceTone} tone.`,
    `Target audience: ${brand.targetAudience}.`,
    brand.prohibitedWords.length > 0 ? `Never use these words: ${brand.prohibitedWords.join(', ')}.` : '',
    `Follow these guidelines: ${brand.guidelines}`,
  ].filter(Boolean).join(' ');

  return { prompt, voiceInstructions, brandId };
}

/**
 * Score how consistent content is with a brand's voice (0-100).
 */
export function scoreBrandConsistency(content: string, brandId: string): number {
  const brand = getBrand(brandId);
  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  let score = 70; // Base score
  const lower = content.toLowerCase();

  // Penalize prohibited words
  for (const word of brand.prohibitedWords) {
    if (lower.includes(word.toLowerCase())) {
      score -= 15;
    }
  }

  // Bonus for matching tone keywords
  const toneWords = brand.voiceTone.split(/[,\s]+/).filter(w => w.length > 3);
  for (const tw of toneWords) {
    if (lower.includes(tw.toLowerCase())) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
