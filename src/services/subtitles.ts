/**
 * Subtitle/Caption Generation
 * Generates SRT and WebVTT subtitle formats from scripts with auto-timing.
 */

export interface WordTiming {
    word: string;
    startTime: number; // seconds
    endTime: number;   // seconds
}

export interface SubtitleEntry {
    index: number;
    startTime: number;
    endTime: number;
    text: string;
}

const WORDS_PER_MINUTE = 150;
const MAX_CHARS_PER_LINE = 42;
const MAX_WORDS_PER_SEGMENT = 10;

function formatSRTTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatVTTTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function segmentText(script: string): string[] {
    const words = script.split(/\s+/).filter(w => w.length > 0);
    const segments: string[] = [];
    let current: string[] = [];

    for (const word of words) {
        current.push(word);
        const line = current.join(' ');
        if (current.length >= MAX_WORDS_PER_SEGMENT || line.length >= MAX_CHARS_PER_LINE) {
            segments.push(current.join(' '));
            current = [];
        }
    }
    if (current.length > 0) {
        segments.push(current.join(' '));
    }
    return segments;
}

function buildEntries(script: string, wordTimings?: WordTiming[]): SubtitleEntry[] {
    if (wordTimings && wordTimings.length > 0) {
        // Use provided word timings
        const segments: SubtitleEntry[] = [];
        let currentWords: WordTiming[] = [];
        let index = 1;

        for (const wt of wordTimings) {
            currentWords.push(wt);
            const text = currentWords.map(w => w.word).join(' ');
            if (currentWords.length >= MAX_WORDS_PER_SEGMENT || text.length >= MAX_CHARS_PER_LINE) {
                segments.push({
                    index: index++,
                    startTime: currentWords[0].startTime,
                    endTime: currentWords[currentWords.length - 1].endTime,
                    text,
                });
                currentWords = [];
            }
        }
        if (currentWords.length > 0) {
            segments.push({
                index: index++,
                startTime: currentWords[0].startTime,
                endTime: currentWords[currentWords.length - 1].endTime,
                text: currentWords.map(w => w.word).join(' '),
            });
        }
        return segments;
    }

    // Auto-timing based on reading speed
    const segments = segmentText(script);
    const secondsPerWord = 60 / WORDS_PER_MINUTE;
    let currentTime = 0;
    
    return segments.map((text, i) => {
        const wordCount = text.split(/\s+/).length;
        const duration = wordCount * secondsPerWord;
        const entry: SubtitleEntry = {
            index: i + 1,
            startTime: currentTime,
            endTime: currentTime + duration,
            text,
        };
        currentTime += duration;
        return entry;
    });
}

export function generateSubtitles(script: string, wordTimings?: WordTiming[]): string {
    if (!script || script.trim().length === 0) {
        return '';
    }
    const entries = buildEntries(script, wordTimings);
    return entries.map(e =>
        `${e.index}\n${formatSRTTime(e.startTime)} --> ${formatSRTTime(e.endTime)}\n${e.text}`
    ).join('\n\n');
}

export function generateVTT(script: string, wordTimings?: WordTiming[]): string {
    if (!script || script.trim().length === 0) {
        return 'WEBVTT\n';
    }
    const entries = buildEntries(script, wordTimings);
    const cues = entries.map(e =>
        `${e.index}\n${formatVTTTime(e.startTime)} --> ${formatVTTTime(e.endTime)}\n${e.text}`
    ).join('\n\n');
    return `WEBVTT\n\n${cues}`;
}

export function embedSubtitles(videoUrl: string, srtContent: string): string {
    // Write SRT to temp file, then burn into video
    const srtFile = `/tmp/subs_${Date.now()}.srt`;
    return `echo '${srtContent.replace(/'/g, "'\\''")}' > ${srtFile} && ffmpeg -i "${videoUrl}" -vf "subtitles=${srtFile}" -c:a copy output_subtitled.mp4`;
}
