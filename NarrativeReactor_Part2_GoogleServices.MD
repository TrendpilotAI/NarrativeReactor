# NARRATIVE REACTOR

## Part 2: Google Services Integration Guide

---

# GOOGLE ANTIGRAVITY

## Agent-First Development Platform

Google Antigravity is the foundation of Narrative Reactor's agentic workflow. Released November 2025, it enables multi-agent orchestration for complex content generation tasks.

### Key Features for Narrative Reactor

| Feature | Use Case |
|---------|----------|
| **Manager View** | Orchestrate multiple content agents working in parallel |
| **Editor View** | Traditional IDE for prompt engineering and code |
| **Artifacts** | Generate verifiable deliverables (scripts, images, walkthroughs) |
| **Browser Subagents** | Validate generated web content and previews |
| **Knowledge Base** | Store Story Bible elements for persistent context |
| **Multi-Model Support** | Switch between Gemini 3, Claude 4.5, and GPT-OSS |

### Configuration for Narrative Reactor

```json
// antigravity.config.json
{
  "workspace": {
    "name": "narrative-reactor",
    "type": "content-generation"
  },
  "agents": {
    "context": {
      "model": "gemini-3-pro",
      "role": "Story Bible parser and context provider"
    },
    "copy": {
      "model": "claude-sonnet-4.5",
      "role": "Copy generation for social media"
    },
    "visual": {
      "model": "gemini-3-flash",
      "role": "AI image prompt generation"
    },
    "review": {
      "model": "gemini-3-pro",
      "role": "Brand compliance verification"
    }
  },
  "artifacts": {
    "types": ["script", "image-prompt", "video-script", "social-copy"],
    "outputFormat": "markdown"
  },
  "knowledgeBase": {
    "sources": [
      "./story-bible/",
      "./brand-guidelines/",
      "./reference-images/"
    ]
  }
}
```

### Workflow Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ANTIGRAVITY MANAGER VIEW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Workspace: narrative-reactor                                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Agent 1: Context Loader                         [COMPLETE]   │    │
│  │ Task: Parse Episode 3.1 from Story Bible                    │    │
│  │ Model: gemini-3-pro | Tokens: 2,340                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Agent 2: Copy Generator                         [RUNNING]    │    │
│  │ Task: Generate LinkedIn post for Episode 3.1                │    │
│  │ Model: claude-sonnet-4.5 | Tokens: 1,890/3,000             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Agent 3: Visual Director                        [QUEUED]     │    │
│  │ Task: Generate Midjourney prompts for Maya character        │    │
│  │ Model: gemini-3-flash | Waiting on Agent 1                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Agent 4: Brand Compliance                       [STANDBY]    │    │
│  │ Task: Review all outputs against brand guidelines           │    │
│  │ Model: gemini-3-pro | Waiting on Agents 2, 3               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

# FIREBASE AI LOGIC

## Client-Side Model Access

Firebase AI Logic provides secure client-side access to Gemini models for mobile and web applications. For Narrative Reactor, this enables real-time content generation in user-facing tools.

### SDK Installation

```bash
# Web (JavaScript)
npm install firebase @anthropic-ai/sdk

# iOS (Swift)
# Add to Package.swift: .package(url: "https://github.com/firebase/firebase-ios-sdk.git")

# Android (Kotlin)
# Add to build.gradle: implementation 'com.google.firebase:firebase-ai-logic'

# Flutter (Dart)
flutter pub add firebase_ai
```

### Web Integration

```typescript
// firebase-ai-logic.ts
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel } from 'firebase/ai';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "narrative-reactor.firebaseapp.com",
  projectId: "narrative-reactor",
  storageBucket: "narrative-reactor.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const ai = getAI(app);

// Initialize Gemini model
const model = getGenerativeModel(ai, { 
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048,
  }
});

// Generate content from Story Bible context
export async function generateEpisodeContent(
  episodeId: string,
  platform: 'twitter' | 'linkedin' | 'threads'
): Promise<string> {
  const storyBibleContext = await loadStoryBibleContext(episodeId);
  
  const prompt = `
    You are the Narrative Reactor. Generate ${platform} content for:
    
    Episode: ${episodeId}
    Context: ${storyBibleContext}
    
    Follow brand guidelines and messaging hierarchy.
    Output platform-optimized copy with appropriate length and tone.
  `;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

### Hybrid Inference (On-Device + Cloud)

```typescript
// For Chrome desktop - experimental on-device inference
import { getAI, getGenerativeModel } from 'firebase/ai';

const ai = getAI(app, {
  backend: {
    // Try on-device first, fallback to cloud
    inference: 'hybrid'
  }
});

const model = getGenerativeModel(ai, {
  model: "gemini-2.5-flash",
  hybridParams: {
    // Prefer on-device for quick iterations
    preferOnDevice: true,
    // Fall back to cloud for complex generation
    cloudFallback: true
  }
});
```

---

# GENKIT SDK

## Server-Side AI Orchestration Framework

Genkit is Firebase's open-source framework for building production-ready AI applications. It provides the backbone for Narrative Reactor's content generation flows.

### Installation

```bash
# JavaScript/TypeScript
npm install genkit @genkit-ai/google-genai @genkit-ai/firebase

# Go
go get github.com/firebase/genkit/go

# Python (Alpha)
pip install genkit genkit-plugin-google-genai genkit-plugin-vertex-ai
```

### Core Configuration

```typescript
// genkit.config.ts
import { genkit } from 'genkit';
import { googleAI, vertexAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    // Gemini Developer API - for rapid prototyping
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    
    // Vertex AI - for enterprise features
    vertexAI({ 
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1' 
    }),
    
    // Firebase integration
    firebase({
      projectId: process.env.FIREBASE_PROJECT_ID,
    }),
  ],
  
  // Default model
  model: googleAI.model('gemini-2.5-flash'),
  
  // Telemetry and observability
  telemetry: {
    instrumentation: 'opentelemetry',
    exporter: 'cloud-trace',
  },
});
```

### Defining Flows for Narrative Reactor

```typescript
// flows/content-generation.ts
import { ai } from '../genkit.config';
import { z } from 'zod';

// Input schema for content generation
const ContentRequestSchema = z.object({
  episodeId: z.string(),
  platform: z.enum(['twitter', 'linkedin', 'threads']),
  contentType: z.enum(['copy', 'visual-prompt', 'video-script']),
  characterFocus: z.string().optional(),
});

// Output schema
const ContentOutputSchema = z.object({
  content: z.string(),
  metadata: z.object({
    characterCount: z.number(),
    hashtags: z.array(z.string()).optional(),
    visualPrompts: z.array(z.string()).optional(),
  }),
  brandCompliance: z.object({
    colorsPassed: z.boolean(),
    tonePassed: z.boolean(),
    messagingPassed: z.boolean(),
  }),
});

// Define the content generation flow
export const generateContentFlow = ai.defineFlow(
  {
    name: 'generateContent',
    inputSchema: ContentRequestSchema,
    outputSchema: ContentOutputSchema,
  },
  async (input) => {
    // Step 1: Load Story Bible context
    const storyBibleContext = await ai.run('loadStoryBible', {
      episodeId: input.episodeId,
    });
    
    // Step 2: Load brand guidelines
    const brandGuidelines = await ai.run('loadBrandGuidelines', {});
    
    // Step 3: Generate content based on type
    let content: string;
    
    if (input.contentType === 'copy') {
      content = await generateCopy(input, storyBibleContext, brandGuidelines);
    } else if (input.contentType === 'visual-prompt') {
      content = await generateVisualPrompt(input, storyBibleContext, brandGuidelines);
    } else {
      content = await generateVideoScript(input, storyBibleContext, brandGuidelines);
    }
    
    // Step 4: Verify brand compliance
    const compliance = await verifyBrandCompliance(content, brandGuidelines);
    
    return {
      content,
      metadata: {
        characterCount: content.length,
        hashtags: extractHashtags(content),
        visualPrompts: input.contentType === 'visual-prompt' ? [content] : undefined,
      },
      brandCompliance: compliance,
    };
  }
);

// Copy generation with Claude via Genkit
async function generateCopy(
  input: z.infer<typeof ContentRequestSchema>,
  storyBible: any,
  brandGuidelines: any
): Promise<string> {
  const platformConfig = {
    twitter: { maxLength: 280, tone: 'professional but accessible' },
    linkedin: { maxLength: 3000, tone: 'executive, strategic' },
    threads: { maxLength: 500, tone: 'warm, conversational' },
  };
  
  const config = platformConfig[input.platform];
  
  const { text } = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `
      Generate ${input.platform} content for Signal Studio campaign.
      
      Episode: ${input.episodeId}
      Story Context: ${JSON.stringify(storyBible)}
      
      Platform Requirements:
      - Max Length: ${config.maxLength} characters
      - Tone: ${config.tone}
      
      Brand Voice Guidelines:
      ${JSON.stringify(brandGuidelines.voice)}
      
      Messaging Hierarchy (use Level 1 or 2):
      Level 1: "What if the answer was 11 seconds away?"
      Level 2: "Signal Studio delivers AI-powered insights with full explainability..."
      
      Generate compelling copy that drives engagement and maintains narrative continuity.
    `,
    config: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });
  
  return text;
}
```

### Dotprompt Templates

```dotprompt
---
# prompts/episode-copy.prompt
model: googleai/gemini-2.5-flash
input:
  schema:
    episodeId: string
    platform: string
    storyContext: string
    characterFocus?: string
output:
  schema:
    copy: string
    hashtags: string[]
    callToAction: string
config:
  temperature: 0.7
---

You are the Narrative Reactor, a creative director for Signal Studio's cinematic social media campaign.

Generate {{platform}} content for Episode {{episodeId}}.

## Story Context
{{storyContext}}

{{#if characterFocus}}
## Character Focus
This post should highlight: {{characterFocus}}
- Use their signature visual elements
- Match their voice and speech patterns
{{/if}}

## Brand Requirements
- Primary message: "What if the answer was 11 seconds away?"
- Key metric: 11-second insight delivery
- Product: Signal Studio by ForwardLane
- Category: Decision Velocity

## Platform-Specific Guidelines
{{#if (eq platform "twitter")}}
- Maximum 280 characters
- Include 2-3 relevant hashtags
- Hook in first line
- Professional but accessible tone
{{/if}}
{{#if (eq platform "linkedin")}}
- Maximum 3000 characters
- First 140 characters must hook
- Executive, strategic tone
- Can include longer narrative
{{/if}}
{{#if (eq platform "threads")}}
- Maximum 500 characters
- Warm, conversational tone
- Behind-the-scenes feel welcome
{{/if}}

Generate the content now.
```

### Using Dotprompt in Code

```typescript
// Using the dotprompt template
import { ai } from '../genkit.config';
import { prompt } from '@genkit-ai/dotprompt';

const episodeCopyPrompt = prompt('episode-copy');

export async function generateEpisodeCopy(
  episodeId: string,
  platform: string,
  storyContext: string,
  characterFocus?: string
) {
  const result = await episodeCopyPrompt({
    episodeId,
    platform,
    storyContext,
    characterFocus,
  });
  
  return result.output();
}
```

---

# GENKIT PLUGINS

## Essential Plugins for Narrative Reactor

### Google GenAI Plugin (Unified)

```typescript
// The @genkit-ai/google-genai package provides unified access
import { genkit } from 'genkit';
import { googleAI, vertexAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [
    // Gemini Developer API (API key auth)
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    
    // Vertex AI (ADC or Express Mode)
    vertexAI({ location: 'us-central1' }),
  ],
});

// Use googleAI for prototyping
const prototypeResponse = await ai.generate({
  model: googleAI.model('gemini-2.5-flash'),
  prompt: 'Generate Twitter copy for Episode 3.1',
});

// Use vertexAI for production (enterprise features)
const productionResponse = await ai.generate({
  model: vertexAI.model('gemini-2.5-pro'),
  prompt: 'Generate LinkedIn thought leadership for Episode 5.3',
});
```

### Firebase Plugin

```typescript
import { firebase } from '@genkit-ai/firebase';

const ai = genkit({
  plugins: [
    firebase({
      projectId: 'narrative-reactor',
      // Enable Firestore vector search for RAG
      firestore: {
        collection: 'story-bible',
        vectorField: 'embedding',
      },
    }),
  ],
});

// Use Firestore as vector store for Story Bible
const retriever = ai.defineRetriever({
  name: 'storyBibleRetriever',
  configSchema: z.object({
    episodeId: z.string().optional(),
    character: z.string().optional(),
  }),
}, async (query, config) => {
  // Retrieve relevant Story Bible chunks
  const results = await firebase.vectorSearch({
    collection: 'story-bible',
    query: query,
    filters: {
      episodeId: config?.episodeId,
      character: config?.character,
    },
    limit: 5,
  });
  
  return results;
});
```

### MCP Plugin (Model Context Protocol)

```typescript
import { mcp } from '@genkit-ai/mcp';

const ai = genkit({
  plugins: [
    mcp({
      servers: [
        {
          name: 'story-bible-server',
          url: 'http://localhost:3001/mcp',
          tools: ['loadEpisode', 'loadCharacter', 'loadBrandGuidelines'],
        },
      ],
    }),
  ],
});

// MCP tools are now available in flows
const episode = await ai.runTool('loadEpisode', { id: '3.1' });
```

### Express Plugin (Web Server)

```typescript
import { express } from '@genkit-ai/express';
import { generateContentFlow } from './flows/content-generation';

const app = express();

// Expose Genkit flows as API endpoints
app.use('/api/generate', ai.expressHandler(generateContentFlow));

// Start server
app.listen(3000, () => {
  console.log('Narrative Reactor API running on port 3000');
});
```

---

# AVAILABLE GENKIT PLUGINS REFERENCE

## Official Google Plugins

| Package | Description | Use Case |
|---------|-------------|----------|
| `@genkit-ai/google-genai` | Unified Google AI access | Gemini models via Developer API or Vertex AI |
| `@genkit-ai/vertexai` | Vertex AI specific features | Vector Search, Model Garden, Evaluation |
| `@genkit-ai/firebase` | Firebase integration | Firestore, Auth, Cloud Functions |
| `@genkit-ai/express` | Express.js middleware | Web API endpoints |
| `@genkit-ai/mcp` | Model Context Protocol | External tool integration |
| `@genkit-ai/compat-oai` | OpenAI compatible APIs | Use OpenAI, Anthropic via OpenAI SDK |

## Community Plugins

| Package | Description | Use Case |
|---------|-------------|----------|
| `genkitx-ollama` | Ollama integration | Local LLM inference |
| `genkitx-langfuse` | Langfuse telemetry | Prompt management, analytics |
| `@auth0/ai-genkit` | Auth0 integration | Authentication, authorization |
| `genkitx-rxjs` | RxJS adapter | Reactive programming patterns |

## Go Plugins

```go
import (
  "github.com/firebase/genkit/go/plugins/googlegenai"
  "github.com/firebase/genkit/go/plugins/ollama"
)

// Initialize with Google AI
g := genkit.Init(ctx, genkit.WithPlugins(&googlegenai.GoogleAI{}))

// Or with Vertex AI
g := genkit.Init(ctx, genkit.WithPlugins(&googlegenai.VertexAI{
  ProjectID: "narrative-reactor",
  Location: "us-central1",
}))
```

## Python Plugins

```python
from genkit import Genkit
from genkit_plugin_google_genai import GoogleAI
from genkit_plugin_vertex_ai import VertexAI

ai = Genkit(plugins=[
    GoogleAI(),
    VertexAI(project_id="narrative-reactor", location="us-central1"),
])
```

---

*Continue to Part 3: Vertex AI APIs and Claude Code Integration*
