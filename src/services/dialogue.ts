import { generate } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/google-genai';
import { generateSpeech, VOICE_PROFILES, TTSResult } from './tts';

export interface CharacterProfile {
  name: string;
  voiceId?: string;
  personality?: string;
}

export interface DialogueLine {
  character: string;
  text: string;
  voiceId: string;
}

export interface Dialogue {
  topic: string;
  characters: CharacterProfile[];
  lines: DialogueLine[];
  estimatedDuration: number;
}

export interface DialogueAudioResult {
  dialogue: Dialogue;
  audioFiles: TTSResult[];
  totalDuration: number;
}

const DEFAULT_VOICES = [
  VOICE_PROFILES.character_a,
  VOICE_PROFILES.character_b,
  VOICE_PROFILES.character_c,
  VOICE_PROFILES.character_d,
];

export async function generateDialogue(
  characters: CharacterProfile[],
  topic: string
): Promise<Dialogue> {
  if (characters.length < 2 || characters.length > 4) {
    throw new Error('Dialogue requires 2-4 characters');
  }

  const charDescriptions = characters
    .map(c => `${c.name}${c.personality ? ` (${c.personality})` : ''}`)
    .join(', ');

  const prompt = `Generate a natural conversation between these characters: ${charDescriptions}

Topic: ${topic}

Return a JSON object with this exact structure:
{
  "lines": [
    { "character": "CharacterName", "text": "What they say..." }
  ]
}

Generate 8-12 lines of dialogue. Each line should be 1-3 sentences. Make it feel natural and engaging.
Characters should stay in character based on their personality descriptions.
Return ONLY valid JSON, no markdown.`;

  const result = await generate({
    model: gemini15Flash,
    prompt,
    config: { temperature: 0.9 },
  });

  const text = result.text.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(text);

  // Map characters to voices
  const voiceMap = new Map<string, string>();
  characters.forEach((c, i) => {
    voiceMap.set(c.name, c.voiceId || DEFAULT_VOICES[i] || DEFAULT_VOICES[0]);
  });

  const lines: DialogueLine[] = parsed.lines.map((line: any) => ({
    character: line.character,
    text: line.text,
    voiceId: voiceMap.get(line.character) || DEFAULT_VOICES[0],
  }));

  const allText = lines.map(l => l.text).join(' ');
  const words = allText.split(/\s+/).length;
  const estimatedDuration = Math.ceil((words / 150) * 60);

  return {
    topic,
    characters,
    lines,
    estimatedDuration,
  };
}

export async function renderDialogue(dialogue: Dialogue): Promise<DialogueAudioResult> {
  const audioFiles: TTSResult[] = [];
  let totalDuration = 0;

  for (const line of dialogue.lines) {
    const result = await generateSpeech(line.text, line.voiceId);
    audioFiles.push(result);
    totalDuration += result.durationEstimate;
  }

  return { dialogue, audioFiles, totalDuration };
}
