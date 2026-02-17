/**
 * Subtitle/Caption Generator
 * Auto-generate SRT/VTT captions from script text with word-level timing and multi-language support.
 */

export type CaptionFormat = 'srt' | 'vtt';

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

export interface CaptionLine {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  words: WordTiming[];
}

export interface CaptionResult {
  format: CaptionFormat;
  language: string;
  lines: CaptionLine[];
  totalDuration: number;
  raw: string;
}

const WORDS_PER_MINUTE = 150;
const MAX_CHARS_PER_LINE = 42;
const MAX_WORDS_PER_LINE = 8;

function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatTimeVTT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function splitIntoLines(text: string): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const prospective = [...current, word].join(' ');
    if (current.length >= MAX_WORDS_PER_LINE || prospective.length > MAX_CHARS_PER_LINE) {
      if (current.length > 0) {
        lines.push(current.join(' '));
        current = [word];
      } else {
        current.push(word);
      }
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) lines.push(current.join(' '));
  return lines;
}

export function generateCaptions(
  scriptText: string,
  options: { format?: CaptionFormat; language?: string; startOffset?: number; wordsPerMinute?: number } = {}
): CaptionResult {
  const { format = 'srt', language = 'en', startOffset = 0, wordsPerMinute = WORDS_PER_MINUTE } = options;

  if (!scriptText || scriptText.trim().length === 0) {
    throw new Error('Script text is required');
  }

  const secondsPerWord = 60 / wordsPerMinute;
  const lines = splitIntoLines(scriptText.trim());
  let currentTime = startOffset;
  const captionLines: CaptionLine[] = [];

  lines.forEach((lineText, i) => {
    const words = lineText.split(/\s+/);
    const lineDuration = words.length * secondsPerWord;
    const lineStart = currentTime;
    const lineEnd = currentTime + lineDuration;

    let wordTime = lineStart;
    const wordTimings: WordTiming[] = words.map(word => {
      const wStart = wordTime;
      const wEnd = wordTime + secondsPerWord;
      wordTime = wEnd;
      return { word, startTime: wStart, endTime: wEnd };
    });

    captionLines.push({
      index: i + 1,
      startTime: lineStart,
      endTime: lineEnd,
      text: lineText,
      words: wordTimings,
    });

    currentTime = lineEnd + 0.1; // small gap between lines
  });

  const totalDuration = captionLines.length > 0 ? captionLines[captionLines.length - 1].endTime - startOffset : 0;

  const raw = format === 'srt' ? renderSRT(captionLines) : renderVTT(captionLines);

  return { format, language, lines: captionLines, totalDuration, raw };
}

function renderSRT(lines: CaptionLine[]): string {
  return lines.map(l =>
    `${l.index}\n${formatTimeSRT(l.startTime)} --> ${formatTimeSRT(l.endTime)}\n${l.text}`
  ).join('\n\n');
}

function renderVTT(lines: CaptionLine[]): string {
  const header = 'WEBVTT\n\n';
  const body = lines.map(l =>
    `${l.index}\n${formatTimeVTT(l.startTime)} --> ${formatTimeVTT(l.endTime)}\n${l.text}`
  ).join('\n\n');
  return header + body;
}

const SIMPLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: { 'hello': 'hola', 'world': 'mundo', 'the': 'el', 'is': 'es', 'a': 'un', 'this': 'esto', 'and': 'y' },
  fr: { 'hello': 'bonjour', 'world': 'monde', 'the': 'le', 'is': 'est', 'a': 'un', 'this': 'ceci', 'and': 'et' },
  de: { 'hello': 'hallo', 'world': 'welt', 'the': 'die', 'is': 'ist', 'a': 'ein', 'this': 'dies', 'and': 'und' },
};

function simpleTranslate(text: string, targetLang: string): string {
  const dict = SIMPLE_TRANSLATIONS[targetLang];
  if (!dict) return text;
  return text.split(/\s+/).map(w => {
    const lower = w.toLowerCase().replace(/[^a-z]/g, '');
    const punct = w.replace(/[a-zA-Z]/g, '');
    return (dict[lower] || w) + (punct && !w.endsWith(punct) ? '' : '');
  }).join(' ');
}

export function translateCaptions(captions: CaptionResult, targetLanguage: string): CaptionResult {
  const translatedLines = captions.lines.map(line => ({
    ...line,
    text: simpleTranslate(line.text, targetLanguage),
    words: line.words.map(w => ({
      ...w,
      word: simpleTranslate(w.word, targetLanguage),
    })),
  }));

  const raw = captions.format === 'srt' ? renderSRT(translatedLines) : renderVTT(translatedLines);

  return {
    ...captions,
    language: targetLanguage,
    lines: translatedLines,
    raw,
  };
}

export function getSupportedLanguages(): string[] {
  return ['en', ...Object.keys(SIMPLE_TRANSLATIONS)];
}
