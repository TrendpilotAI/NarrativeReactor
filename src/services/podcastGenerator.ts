import { generate } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/google-genai';
import { generateSpeech, VOICE_PROFILES, TTSResult } from './tts';

export type PodcastStyle = 'interview' | 'monologue' | 'panel_discussion' | 'story';

export interface PodcastSegment {
  speaker: string;
  text: string;
  voiceId: string;
}

export interface PodcastScript {
  title: string;
  intro: PodcastSegment;
  segments: PodcastSegment[];
  outro: PodcastSegment;
  estimatedDuration: number; // seconds
  style: PodcastStyle;
}

export interface PodcastAudioResult {
  script: PodcastScript;
  audioFiles: TTSResult[];
  totalDuration: number;
}

const STYLE_PROMPTS: Record<PodcastStyle, string> = {
  interview: 'Generate a podcast script as an interview between a Host and a Guest. Include back-and-forth questions and answers.',
  monologue: 'Generate a podcast script as a single-speaker monologue. Engaging, conversational tone.',
  panel_discussion: 'Generate a podcast script as a panel discussion between a Host and 2-3 panelists. Include debate and different viewpoints.',
  story: 'Generate a podcast script as a narrative story. Use a Narrator voice with vivid storytelling.',
};

const STYLE_SPEAKERS: Record<PodcastStyle, string[]> = {
  interview: ['Host', 'Guest'],
  monologue: ['Host'],
  panel_discussion: ['Host', 'Panelist1', 'Panelist2'],
  story: ['Narrator'],
};

function speakerToVoice(speaker: string): string {
  const map: Record<string, string> = {
    Host: VOICE_PROFILES.host,
    Guest: VOICE_PROFILES.guest,
    Narrator: VOICE_PROFILES.narrator,
    Panelist1: VOICE_PROFILES.character_a,
    Panelist2: VOICE_PROFILES.character_b,
  };
  return map[speaker] || VOICE_PROFILES.narrator;
}

export async function generatePodcastScript(topic: string, style: PodcastStyle): Promise<PodcastScript> {
  const speakers = STYLE_SPEAKERS[style];
  const prompt = `${STYLE_PROMPTS[style]}

Topic: ${topic}
Speakers: ${speakers.join(', ')}

Return a JSON object with this exact structure:
{
  "title": "Podcast Title",
  "intro": { "speaker": "${speakers[0]}", "text": "Introduction text..." },
  "segments": [
    { "speaker": "SpeakerName", "text": "Segment text..." }
  ],
  "outro": { "speaker": "${speakers[0]}", "text": "Outro text..." }
}

Generate 4-6 segments. Each segment should be 2-4 sentences. Return ONLY valid JSON, no markdown.`;

  const result = await generate({
    model: gemini15Flash,
    prompt,
    config: { temperature: 0.8 },
  });

  const text = result.text.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(text);

  // Attach voice IDs
  const addVoice = (seg: any): PodcastSegment => ({
    speaker: seg.speaker,
    text: seg.text,
    voiceId: speakerToVoice(seg.speaker),
  });

  const script: PodcastScript = {
    title: parsed.title,
    intro: addVoice(parsed.intro),
    segments: parsed.segments.map(addVoice),
    outro: addVoice(parsed.outro),
    estimatedDuration: 0,
    style,
  };

  // Estimate duration
  const allText = [script.intro, ...script.segments, script.outro].map(s => s.text).join(' ');
  const words = allText.split(/\s+/).length;
  script.estimatedDuration = Math.ceil((words / 150) * 60);

  return script;
}

export async function scriptToAudio(script: PodcastScript): Promise<PodcastAudioResult> {
  const allSegments = [script.intro, ...script.segments, script.outro];
  const audioFiles: TTSResult[] = [];
  let totalDuration = 0;

  for (const segment of allSegments) {
    const result = await generateSpeech(segment.text, segment.voiceId);
    audioFiles.push(result);
    totalDuration += result.durationEstimate;
  }

  return { script, audioFiles, totalDuration };
}
