# NARRATIVE REACTOR

## Part 3: Vertex AI APIs & Claude Code Integration

---

# VERTEX AI APIs

## Enterprise-Grade AI for Production

Vertex AI provides the enterprise foundation for Narrative Reactor's production deployment, offering advanced features like fine-tuning, evaluation, and enterprise security.

### Available Models

| Model | Use Case | Features |
|-------|----------|----------|
| **Gemini 3 Pro** | Complex reasoning, agentic workflows | Adaptive thinking, 1M context, grounding |
| **Gemini 3 Flash** | Fast multimodal, complex problems | Cost-efficient reasoning, agentic support |
| **Gemini 2.5 Flash** | General purpose, fast | Balanced speed/quality |
| **Gemini 2.5 Pro** | High-quality generation | Best for long-form content |
| **Gemini Live API** | Real-time voice/video | Low-latency conversational AI |
| **Imagen 3** | Image generation | High-quality, brand-consistent images |
| **Veo 2/3** | Video generation | Text/image to video |

### Authentication Methods

```typescript
// Method 1: Application Default Credentials (Recommended for production)
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [
    vertexAI({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1',
      // ADC handles authentication automatically
    }),
  ],
});

// Method 2: Express Mode (API Key - for quick start)
const ai = genkit({
  plugins: [
    vertexAI({
      apiKey: process.env.VERTEX_EXPRESS_API_KEY,
      // No projectId or location needed for Express Mode
    }),
  ],
});
```

### Setting Up ADC

```bash
# Local development
gcloud auth application-default login

# Verify
gcloud auth application-default print-access-token

# Set project
gcloud config set project narrative-reactor

# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com
```

### Content Generation with Vertex AI

```typescript
// vertex-ai-generation.ts
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [vertexAI({ location: 'us-central1' })],
});

// Generate episode content with Gemini 3 Pro
export async function generateCinematicScript(
  episodeId: string,
  storyContext: string
) {
  const { text } = await ai.generate({
    model: vertexAI.model('gemini-3-pro'),
    prompt: `
      You are the Narrative Reactor creating a cinematic script.
      
      Episode: ${episodeId}
      Context: ${storyContext}
      
      Generate a detailed script with:
      - Scene descriptions
      - Camera directions
      - Lighting notes
      - Sound design
      - Character dialogue
      - Visual prompts for AI image generation
      
      Follow the Signal Studio brand guidelines.
    `,
    config: {
      temperature: 0.8,
      maxOutputTokens: 4096,
      // Enable thinking for complex reasoning
      thinkingConfig: {
        thinkingBudget: 1024,
      },
    },
  });
  
  return text;
}
```

### Image Generation with Imagen 3

```typescript
// imagen-generation.ts
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'us-central1',
});

const imageModel = vertexAI.preview.getImageGenerationModel({
  model: 'imagen-3.0-generate-001',
});

export async function generateCharacterImage(
  characterName: string,
  prompt: string,
  brandColors: string[]
) {
  const fullPrompt = `
    ${prompt}
    
    Style requirements:
    - Photorealistic, 8K quality
    - Cinematic lighting
    - Brand colors subtly integrated: ${brandColors.join(', ')}
    - Professional business environment
    - Canon EOS R5 style photography
  `;
  
  const response = await imageModel.generateImages({
    prompt: fullPrompt,
    numberOfImages: 4,
    aspectRatio: '16:9',
    safetyFilterLevel: 'block_some',
    personGeneration: 'allow_adult',
  });
  
  return response.images;
}

// Character-specific prompts from Story Bible
export const characterPrompts = {
  maya_chen: `Professional Asian-American woman, 38, Taiwanese heritage, 
    structured navy blazer over simple cream blouse, minimal jade pendant 
    on delicate gold chain, hair pulled back precisely in low bun, 
    sharp intelligent eyes with warmth, photorealistic, 8K`,
    
  marcus_thompson: `Professional man, 45, distinguished with silver touching 
    temples, warm brown eyes, expensive but understated charcoal suit, 
    vintage Patek Philippe watch visible, traditional office with mahogany, 
    photorealistic, 8K`,
    
  elena_vasquez: `Professional Latina woman, 52, silver-streaked dark hair 
    in precise updo, reading glasses on chain, dark tailored suit, 
    commanding presence, office with regulatory binders, photorealistic, 8K`,
};
```

### Video Generation with Veo

```typescript
// veo-generation.ts
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'us-central1',
});

const videoModel = vertexAI.preview.getVideoGenerationModel({
  model: 'veo-2.0-generate-001',
});

export async function generateEpisodeClip(
  episodeId: string,
  scene: string,
  firstFrame?: string  // Base64 image or GCS URI
) {
  const prompt = `
    Cinematic scene for Signal Studio campaign:
    ${scene}
    
    Style: Professional B2B marketing, photorealistic
    Mood: Transformative, hopeful, technology-forward
    Colors: Navy (#1E3A5F) and cyan (#00B4D8) accents
    Camera: Smooth, professional movement
    Duration: 5-10 seconds
  `;
  
  const response = await videoModel.generateVideo({
    prompt,
    firstFrame: firstFrame ? { imageUri: firstFrame } : undefined,
    aspectRatio: '16:9',
    numberOfVideos: 1,
  });
  
  return response.videos[0];
}
```

### Gemini Live API for Interactive Content

```typescript
// gemini-live.ts
import { GoogleGenAI, LiveAPIModel } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'us-central1',
});

export async function createInteractiveDemo() {
  const liveModel = new LiveAPIModel({
    model: 'gemini-live-2.5-flash-preview-native-audio',
    systemInstruction: `
      You are the Signal Studio AI assistant demonstrating 
      Decision Velocity capabilities. 
      
      Respond conversationally to questions about:
      - 11-second insight delivery
      - Audit trail explainability
      - Compliance-aware recommendations
      
      Voice: Professional, warm, confident
      Tone: Helpful without being sales-y
    `,
  });
  
  // Connect for real-time audio interaction
  const session = await liveModel.connect({
    tools: [
      {
        name: 'getInsight',
        description: 'Demonstrate Signal Studio insight generation',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
      },
    ],
  });
  
  return session;
}
```

---

# CLAUDE CODE INTEGRATION

## Advanced Copy Generation via Anthropic

Claude Code provides superior long-form copywriting capabilities for Narrative Reactor, particularly for:
- Complex narrative scripts
- Character dialogue
- Thought leadership content
- LinkedIn long-form posts

### Installation

```bash
npm install @anthropic-ai/sdk
```

### Configuration

```typescript
// claude-code.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model options
const CLAUDE_MODELS = {
  opus: 'claude-opus-4-5-20251101',     // Most advanced
  sonnet: 'claude-sonnet-4-5-20250929', // Balanced
  haiku: 'claude-haiku-4-5-20251001',   // Fast
};
```

### Copy Generation Flow

```typescript
// claude-copy-generation.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function generateEpisodeCopy(
  episodeId: string,
  platform: 'twitter' | 'linkedin' | 'threads',
  storyBibleContext: string,
  brandGuidelines: string
) {
  const platformConfigs = {
    twitter: {
      maxTokens: 100,
      systemPrompt: `You are a social media copywriter for Signal Studio. 
        Generate punchy, engaging Twitter copy. Max 280 characters.
        Include 2-3 relevant hashtags.`,
    },
    linkedin: {
      maxTokens: 1000,
      systemPrompt: `You are a thought leadership writer for Signal Studio.
        Generate executive-level LinkedIn content that establishes 
        Signal Studio as a category leader in Decision Velocity.
        Tone: Strategic, visionary, credible.`,
    },
    threads: {
      maxTokens: 200,
      systemPrompt: `You are a community manager for Signal Studio.
        Generate warm, conversational Threads content.
        Tone: Authentic, approachable, human.`,
    },
  };
  
  const config = platformConfigs[platform];
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: config.maxTokens,
    system: `${config.systemPrompt}
    
    BRAND GUIDELINES:
    ${brandGuidelines}
    
    MESSAGING HIERARCHY:
    Level 1 (Emotional): "What if the answer was 11 seconds away?"
    Level 2 (Rational): "Signal Studio delivers AI-powered insights with full explainability..."
    
    STORY BIBLE CONTEXT:
    ${storyBibleContext}`,
    messages: [
      {
        role: 'user',
        content: `Generate ${platform} copy for Episode ${episodeId}. 
          Maintain narrative continuity and character voice.`,
      },
    ],
  });
  
  return response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
}
```

### Cinematic Script Generation

```typescript
// claude-script-generation.ts
export async function generateCinematicScript(
  episodeId: string,
  storyBibleContext: string
) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101', // Use Opus for complex creative
    max_tokens: 4096,
    system: `You are the Narrative Reactor, a creative director generating 
    cinematic scripts for Signal Studio's social media campaign.
    
    Your scripts should include:
    1. SCENE descriptions with specific settings
    2. CAMERA directions (WIDE, CLOSE-UP, TRACKING, etc.)
    3. LIGHTING notes (color temperature, direction, mood)
    4. SOUND design (ambient, music, effects)
    5. ACTION descriptions
    6. DIALOGUE with character-specific voice
    7. AI IMAGE PROMPTS for each key frame
    
    BRAND COLORS:
    - Authority Navy: #1E3A5F
    - Innovation Cyan: #00B4D8
    - Velocity Orange: #FF6B35
    - Midnight: #0D1B2A
    - Achievement Gold: #FFD700
    
    VISUAL LANGUAGE:
    - "Before" state: Cold blue, claustrophobic, dashboard prison
    - "After" state: Warm light, open framing, decision velocity
    - Signature: Cyan glow for Signal Studio activation`,
    messages: [
      {
        role: 'user',
        content: `Generate a complete cinematic script for Episode ${episodeId}.
        
        STORY BIBLE CONTEXT:
        ${storyBibleContext}
        
        Output a production-ready script with all required elements.`,
      },
    ],
  });
  
  return response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
}
```

### Character Dialogue Generation

```typescript
// claude-dialogue.ts
export async function generateCharacterDialogue(
  character: 'maya' | 'marcus' | 'elena' | 'jamie' | 'helen',
  context: string,
  situation: string
) {
  const characterVoices = {
    maya: {
      traits: 'Precise, thoughtful, builds to conclusions',
      avoids: '"Trust me" (she shows, doesn\'t tell)',
      example: '"I knew the answer three weeks before I could prove it. By then, it didn\'t matter."',
    },
    marcus: {
      traits: 'Warm, story-driven, references history',
      avoids: '"Cutting edge" (tech jargon feels foreign)',
      example: '"My father built this firm on relationships, not algorithms."',
    },
    elena: {
      traits: 'Direct, evidence-based, regulatory language',
      avoids: '"Approximately" (she needs precision)',
      example: '"If I can\'t explain it to a regulator, it doesn\'t exist."',
    },
    jamie: {
      traits: 'Fast, casual, question-driven',
      avoids: '"That\'s how it\'s always been" (they question everything)',
      example: '"Why are we still doing things the way my grandfather would have done them?"',
    },
    helen: {
      traits: 'Demanding, sophisticated, no-nonsense',
      avoids: 'Small talk, pleasantries without substance',
      example: '"I don\'t care how you found the insight. I care that you found it before it cost me money."',
    },
  };
  
  const voice = characterVoices[character];
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    system: `You are writing dialogue for ${character.toUpperCase()} in the Signal Studio campaign.
    
    CHARACTER VOICE:
    - Speech traits: ${voice.traits}
    - Never says: ${voice.avoids}
    - Example line: ${voice.example}
    
    Generate dialogue that sounds authentic to this character.
    Keep responses concise and impactful.`,
    messages: [
      {
        role: 'user',
        content: `Context: ${context}
        
        Situation: ${situation}
        
        Generate 2-3 lines of dialogue for ${character}.`,
      },
    ],
  });
  
  return response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
}
```

### Hybrid Genkit + Claude Flow

```typescript
// hybrid-flow.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import Anthropic from '@anthropic-ai/sdk';

const ai = genkit({
  plugins: [googleAI()],
});

const anthropic = new Anthropic();

// Use Gemini for context/research, Claude for copy
export const hybridContentFlow = ai.defineFlow(
  {
    name: 'hybridContent',
    inputSchema: z.object({
      episodeId: z.string(),
      platform: z.string(),
    }),
  },
  async (input) => {
    // Step 1: Use Gemini for Story Bible retrieval and context building
    const { text: context } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt: `Retrieve and summarize Story Bible context for Episode ${input.episodeId}.
        Include: scene description, characters involved, emotional arc, key moments.`,
    });
    
    // Step 2: Use Gemini for brand guideline verification
    const { text: guidelines } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt: `Extract relevant brand guidelines for ${input.platform} content.
        Include: colors, tone, messaging hierarchy, visual language.`,
    });
    
    // Step 3: Use Claude for final copy generation
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      system: `You are the Narrative Reactor copywriter.
        
        CONTEXT: ${context}
        GUIDELINES: ${guidelines}`,
      messages: [
        {
          role: 'user',
          content: `Generate ${input.platform} copy for Episode ${input.episodeId}.`,
        },
      ],
    });
    
    // Step 4: Use Gemini for brand compliance verification
    const { text: compliance } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt: `Verify this content against Signal Studio brand guidelines:
        
        Content: ${claudeResponse.content[0].text}
        Guidelines: ${guidelines}
        
        Return JSON: { passed: boolean, issues: string[] }`,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    return {
      copy: claudeResponse.content[0].text,
      context,
      compliance: JSON.parse(compliance),
    };
  }
);
```

---

# GOOGLE GEN AI SDK (Unified)

## Single SDK for All Google AI

The Google Gen AI SDK provides unified access to both Gemini Developer API and Vertex AI.

### Installation

```bash
# JavaScript/TypeScript
npm install @google/genai

# Python
pip install google-genai

# Go
go get google.golang.org/genai
```

### Unified Usage

```typescript
// Gemini Developer API (API key)
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Vertex AI (ADC)
const vertexAI = new GoogleGenAI({
  vertexai: true,
  project: 'narrative-reactor',
  location: 'us-central1',
});

// Same API for both!
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Generate Twitter copy for Signal Studio',
});

console.log(response.text);
```

### Python Example

```python
from google import genai
from google.genai.types import HttpOptions

# Gemini Developer API
client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])

# Vertex AI
vertex_client = genai.Client(
    vertexai=True,
    project='narrative-reactor',
    location='us-central1'
)

# Generate content
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='Generate LinkedIn copy for Episode 3.1'
)

print(response.text)
```

---

*Continue to Part 4: User Interaction Guide for Narrative Reactor*
