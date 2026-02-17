import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || '';
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio';
const AUDIO_DIR = path.join(process.cwd(), 'data', 'audio');

// Default voice IDs for Fish Audio
export const VOICE_PROFILES: Record<string, string> = {
  narrator: 'default',       // Default Fish Audio voice
  host: 'default',
  guest: 'default',
  character_a: 'default',
  character_b: 'default',
  character_c: 'default',
  character_d: 'default',
};

export interface TTSResult {
  audioUrl: string;
  filePath: string;
  text: string;
  voiceId: string;
  cached: boolean;
  durationEstimate: number; // seconds, rough estimate
}

function ensureAudioDir(): void {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
}

function getCacheKey(text: string, voiceId: string): string {
  return crypto.createHash('sha256').update(`${voiceId}:${text}`).digest('hex');
}

function estimateDuration(text: string): number {
  // ~150 words per minute average speech
  const words = text.split(/\s+/).length;
  return Math.ceil((words / 150) * 60);
}

export async function generateSpeech(text: string, voiceId?: string): Promise<TTSResult> {
  const resolvedVoice = voiceId || VOICE_PROFILES.narrator;
  const cacheKey = getCacheKey(text, resolvedVoice);
  const fileName = `${cacheKey}.mp3`;
  const filePath = path.join(AUDIO_DIR, fileName);

  ensureAudioDir();

  // Check cache
  if (fs.existsSync(filePath)) {
    return {
      audioUrl: `/data/audio/${fileName}`,
      filePath,
      text,
      voiceId: resolvedVoice,
      cached: true,
      durationEstimate: estimateDuration(text),
    };
  }

  // Call Fish Audio TTS API
  const response = await fetch(`${FISH_AUDIO_BASE_URL}/v1/tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      reference_id: resolvedVoice === 'default' ? undefined : resolvedVoice,
      format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fish Audio TTS failed (${response.status}): ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, audioBuffer);

  return {
    audioUrl: `/data/audio/${fileName}`,
    filePath,
    text,
    voiceId: resolvedVoice,
    cached: false,
    durationEstimate: estimateDuration(text),
  };
}

export function listAudioFiles(): { name: string; size: number; created: string }[] {
  ensureAudioDir();
  const files = fs.readdirSync(AUDIO_DIR);
  return files
    .filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
    .map(f => {
      const stats = fs.statSync(path.join(AUDIO_DIR, f));
      return { name: f, size: stats.size, created: stats.birthtime.toISOString() };
    });
}
