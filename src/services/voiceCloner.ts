import { randomUUID } from 'crypto';

export interface ToneMetrics {
  formality: number;      // 0-1: casual to formal
  enthusiasm: number;     // 0-1: reserved to enthusiastic
  complexity: number;     // 0-1: simple to complex vocabulary
  sentimentPolarity: number; // -1 to 1: negative to positive
  avgSentenceLength: number;
  vocabularyRichness: number; // unique words / total words
}

export interface VoiceProfile {
  id: string;
  brandId: string;
  name: string;
  metrics: ToneMetrics;
  sampleCount: number;
  commonPhrases: string[];
  avoidPhrases: string[];
  createdAt: string;
  updatedAt: string;
}

const voiceProfiles: Map<string, VoiceProfile> = new Map();

function analyzeTone(text: string): ToneMetrics {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);

  const formalWords = ['therefore', 'furthermore', 'consequently', 'regarding', 'pursuant', 'hereby', 'whereas', 'nevertheless'];
  const casualWords = ['hey', 'cool', 'awesome', 'gonna', 'wanna', 'yeah', 'stuff', 'things', 'like', 'super'];
  const enthusiasticWords = ['amazing', 'incredible', 'awesome', 'love', 'fantastic', 'great', 'wonderful', 'exciting', 'brilliant'];

  const formalCount = words.filter(w => formalWords.includes(w)).length;
  const casualCount = words.filter(w => casualWords.includes(w)).length;
  const formality = words.length > 0 ? Math.min(1, Math.max(0, 0.5 + (formalCount - casualCount) * 0.1)) : 0.5;

  const enthCount = words.filter(w => enthusiasticWords.includes(w)).length;
  const exclamations = (text.match(/!/g) || []).length;
  const enthusiasm = Math.min(1, (enthCount + exclamations) / Math.max(1, sentences.length) * 0.3);

  const avgWordLen = words.length > 0 ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;
  const complexity = Math.min(1, Math.max(0, (avgWordLen - 3) / 5));

  const positiveWords = ['good', 'great', 'love', 'amazing', 'excellent', 'happy', 'wonderful', 'best', 'fantastic'];
  const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'worst', 'horrible', 'poor', 'ugly', 'disappointing'];
  const posCount = words.filter(w => positiveWords.includes(w)).length;
  const negCount = words.filter(w => negativeWords.includes(w)).length;
  const sentimentPolarity = words.length > 0 ? Math.max(-1, Math.min(1, (posCount - negCount) / Math.max(1, posCount + negCount))) : 0;

  return {
    formality: Math.round(formality * 100) / 100,
    enthusiasm: Math.round(enthusiasm * 100) / 100,
    complexity: Math.round(complexity * 100) / 100,
    sentimentPolarity: Math.round(sentimentPolarity * 100) / 100,
    avgSentenceLength: sentences.length > 0 ? Math.round(words.length / sentences.length * 10) / 10 : 0,
    vocabularyRichness: words.length > 0 ? Math.round(uniqueWords.size / words.length * 100) / 100 : 0,
  };
}

function extractPhrases(text: string, minFreq: number = 2): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const bigrams: Map<string, number> = new Map();
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }
  return Array.from(bigrams.entries())
    .filter(([, c]) => c >= minFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([p]) => p);
}

function mergeMetrics(existing: ToneMetrics, incoming: ToneMetrics, existingWeight: number): ToneMetrics {
  const w1 = existingWeight / (existingWeight + 1);
  const w2 = 1 / (existingWeight + 1);
  return {
    formality: Math.round((existing.formality * w1 + incoming.formality * w2) * 100) / 100,
    enthusiasm: Math.round((existing.enthusiasm * w1 + incoming.enthusiasm * w2) * 100) / 100,
    complexity: Math.round((existing.complexity * w1 + incoming.complexity * w2) * 100) / 100,
    sentimentPolarity: Math.round((existing.sentimentPolarity * w1 + incoming.sentimentPolarity * w2) * 100) / 100,
    avgSentenceLength: Math.round((existing.avgSentenceLength * w1 + incoming.avgSentenceLength * w2) * 10) / 10,
    vocabularyRichness: Math.round((existing.vocabularyRichness * w1 + incoming.vocabularyRichness * w2) * 100) / 100,
  };
}

export function analyzeContent(text: string): ToneMetrics {
  return analyzeTone(text);
}

export function createVoiceProfile(brandId: string, name: string, samples: string[]): VoiceProfile {
  if (samples.length === 0) throw new Error('At least one sample is required');
  const combined = samples.join(' ');
  const metrics = analyzeTone(combined);
  const commonPhrases = extractPhrases(combined, 1);
  const profile: VoiceProfile = {
    id: randomUUID(),
    brandId,
    name,
    metrics,
    sampleCount: samples.length,
    commonPhrases,
    avoidPhrases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  voiceProfiles.set(profile.id, profile);
  return profile;
}

export function addSamples(profileId: string, samples: string[]): VoiceProfile {
  const profile = voiceProfiles.get(profileId);
  if (!profile) throw new Error(`Voice profile not found: ${profileId}`);
  const combined = samples.join(' ');
  const newMetrics = analyzeTone(combined);
  profile.metrics = mergeMetrics(profile.metrics, newMetrics, profile.sampleCount);
  profile.sampleCount += samples.length;
  const newPhrases = extractPhrases(combined, 1);
  const phraseSet = new Set([...profile.commonPhrases, ...newPhrases]);
  profile.commonPhrases = Array.from(phraseSet).slice(0, 20);
  profile.updatedAt = new Date().toISOString();
  return profile;
}

export function getVoiceProfile(profileId: string): VoiceProfile | undefined {
  return voiceProfiles.get(profileId);
}

export function getProfilesByBrand(brandId: string): VoiceProfile[] {
  return Array.from(voiceProfiles.values()).filter(p => p.brandId === brandId);
}

export function generateContentGuidance(profileId: string): {
  toneDescription: string;
  writingTips: string[];
  examplePhrases: string[];
} {
  const profile = voiceProfiles.get(profileId);
  if (!profile) throw new Error(`Voice profile not found: ${profileId}`);
  const m = profile.metrics;
  const toneWords: string[] = [];
  if (m.formality > 0.6) toneWords.push('formal');
  else if (m.formality < 0.4) toneWords.push('casual');
  else toneWords.push('balanced');
  if (m.enthusiasm > 0.4) toneWords.push('enthusiastic');
  if (m.sentimentPolarity > 0.3) toneWords.push('positive');
  else if (m.sentimentPolarity < -0.3) toneWords.push('critical');
  if (m.complexity > 0.5) toneWords.push('sophisticated');
  else if (m.complexity < 0.3) toneWords.push('simple');

  const tips: string[] = [];
  tips.push(`Target sentence length: ~${m.avgSentenceLength} words`);
  if (m.formality > 0.6) tips.push('Use professional language and avoid slang');
  if (m.formality < 0.4) tips.push('Keep it conversational and relatable');
  if (m.enthusiasm > 0.4) tips.push('Use energetic language and exclamation marks');
  if (m.complexity < 0.3) tips.push('Use short, simple words');

  return {
    toneDescription: toneWords.join(', '),
    writingTips: tips,
    examplePhrases: profile.commonPhrases.slice(0, 5),
  };
}

export function deleteVoiceProfile(profileId: string): boolean {
  return voiceProfiles.delete(profileId);
}
