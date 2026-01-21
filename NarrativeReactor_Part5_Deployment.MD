# NARRATIVE REACTOR

## Part 5: Deployment & Production Guide

---

# DEPLOYMENT ARCHITECTURE

## Production Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NARRATIVE REACTOR PRODUCTION                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                         ┌─────────────┐                             │
│                         │   USERS     │                             │
│                         └──────┬──────┘                             │
│                                │                                     │
│                         ┌──────▼──────┐                             │
│                         │   FIREBASE   │                             │
│                         │ APP HOSTING │                             │
│                         └──────┬──────┘                             │
│                                │                                     │
│              ┌─────────────────┼─────────────────┐                  │
│              │                 │                 │                   │
│       ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐          │
│       │   GENKIT    │   │   CLOUD     │   │   CLOUD     │          │
│       │   FLOWS     │   │  FUNCTIONS  │   │   RUN       │          │
│       └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│              │                 │                 │                   │
│              └─────────────────┼─────────────────┘                  │
│                                │                                     │
│              ┌─────────────────┼─────────────────┐                  │
│              │                 │                 │                   │
│       ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐          │
│       │  VERTEX AI  │   │   CLAUDE    │   │  FIRESTORE  │          │
│       │   GEMINI    │   │    API      │   │  VECTORS    │          │
│       └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

# FIREBASE APP HOSTING DEPLOYMENT

## Setup

```bash
# Initialize Firebase in your project
firebase init hosting

# Select App Hosting for Next.js/web frameworks
firebase init apphosting

# Configure for Genkit
firebase init functions
```

## Configuration

```yaml
# apphosting.yaml
runConfig:
  minInstances: 1
  maxInstances: 10
  cpu: 2
  memoryMiB: 1024
  concurrency: 80

env:
  - variable: GOOGLE_CLOUD_PROJECT
    secret: projects/narrative-reactor/secrets/gcp-project
  - variable: GEMINI_API_KEY
    secret: projects/narrative-reactor/secrets/gemini-api-key
  - variable: ANTHROPIC_API_KEY
    secret: projects/narrative-reactor/secrets/anthropic-api-key
```

## Deploy

```bash
# Deploy to Firebase App Hosting
firebase deploy --only hosting

# Deploy Genkit functions
firebase deploy --only functions
```

---

# CLOUD RUN DEPLOYMENT

## For Genkit Flows as API

```dockerfile
# Dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
```

```typescript
// server.ts
import express from 'express';
import { ai, generateContentFlow } from './genkit.config';

const app = express();
app.use(express.json());

// Expose Genkit flows as API endpoints
app.post('/api/generate', async (req, res) => {
  try {
    const result = await generateContentFlow(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Narrative Reactor API running on port ${PORT}`);
});
```

```bash
# Deploy to Cloud Run
gcloud run deploy narrative-reactor \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=narrative-reactor"
```

---

# CLOUD FUNCTIONS DEPLOYMENT

## For Event-Driven Workflows

```typescript
// functions/src/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { ai, generateContentFlow } from './genkit.config';

// HTTP trigger for content generation
export const generateContent = onRequest(
  { 
    cors: true,
    secrets: ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'],
  },
  async (req, res) => {
    const { episodeId, platform } = req.body;
    
    const result = await generateContentFlow({
      episodeId,
      platform,
      contentType: 'copy',
    });
    
    res.json(result);
  }
);

// Firestore trigger for automatic content generation
export const onEpisodeScheduled = onDocumentCreated(
  'scheduled-content/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    
    const content = await generateContentFlow({
      episodeId: data.episodeId,
      platform: data.platform,
      contentType: 'copy',
    });
    
    // Save generated content
    await event.data?.ref.update({
      generatedContent: content,
      status: 'ready',
    });
  }
);
```

```bash
# Deploy functions
firebase deploy --only functions
```

---

# FIRESTORE SETUP

## Story Bible Storage Schema

```typescript
// Firestore collections structure
/*
story-bible/
├── foundation/
│   ├── brand-guidelines
│   ├── messaging-hierarchy
│   └── visual-language
├── characters/
│   ├── maya-chen
│   ├── marcus-thompson
│   ├── elena-vasquez
│   ├── jamie-park
│   └── helen-murdoch
├── episodes/
│   ├── 1.1
│   ├── 1.2
│   └── ... (30 episodes)
└── reference-images/
    ├── maya-primary
    ├── marcus-primary
    └── ...
*/
```

## Vector Embeddings for RAG

```typescript
// firestore-setup.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

initializeApp();
const db = getFirestore();
const ai = genkit({ plugins: [googleAI()] });

// Generate and store embeddings for Story Bible chunks
export async function indexStoryBible() {
  const episodes = await db.collection('episodes').get();
  
  for (const doc of episodes.docs) {
    const episodeData = doc.data();
    
    // Generate embedding
    const { embeddings } = await ai.embed({
      embedder: googleAI.embedder('text-embedding-004'),
      content: `${episodeData.title}\n${episodeData.script}`,
    });
    
    // Store with embedding
    await doc.ref.update({
      embedding: FieldValue.vector(embeddings[0]),
      indexedAt: FieldValue.serverTimestamp(),
    });
  }
}

// Vector search for relevant context
export async function searchStoryBible(query: string, limit: number = 5) {
  const { embeddings } = await ai.embed({
    embedder: googleAI.embedder('text-embedding-004'),
    content: query,
  });
  
  const results = await db
    .collection('episodes')
    .findNearest('embedding', embeddings[0], {
      limit,
      distanceMeasure: 'COSINE',
    })
    .get();
  
  return results.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}
```

---

# SECRETS MANAGEMENT

## Google Cloud Secret Manager

```bash
# Create secrets
gcloud secrets create gemini-api-key --replication-policy="automatic"
echo -n "your-api-key" | gcloud secrets versions add gemini-api-key --data-file=-

gcloud secrets create anthropic-api-key --replication-policy="automatic"
echo -n "your-api-key" | gcloud secrets versions add anthropic-api-key --data-file=-

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

## Accessing Secrets in Code

```typescript
// secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

export async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/narrative-reactor/secrets/${name}/versions/latest`,
  });
  
  return version.payload?.data?.toString() || '';
}

// Usage
const geminiKey = await getSecret('gemini-api-key');
const anthropicKey = await getSecret('anthropic-api-key');
```

---

# AUTOMATION INTEGRATION

## n8n Workflow Integration

```json
// n8n workflow for automated content generation
{
  "name": "Narrative Reactor Content Pipeline",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{ "field": "hours", "hour": 8 }]
        }
      }
    },
    {
      "name": "Get Today's Episodes",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://narrative-reactor.run.app/api/schedule/today",
        "method": "GET"
      }
    },
    {
      "name": "Generate Content",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://narrative-reactor.run.app/api/generate",
        "method": "POST",
        "body": {
          "episodeId": "{{ $json.episodeId }}",
          "platform": "{{ $json.platform }}"
        }
      }
    },
    {
      "name": "Post to GoHighLevel",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.gohighlevel.com/v1/social/post",
        "method": "POST",
        "body": {
          "content": "{{ $json.content }}",
          "scheduledAt": "{{ $json.scheduledTime }}"
        }
      }
    }
  ]
}
```

## GoHighLevel Integration

```typescript
// gohighlevel-integration.ts
import axios from 'axios';

const GHL_API_KEY = process.env.GOHIGHLEVEL_API_KEY;
const GHL_LOCATION_ID = process.env.GOHIGHLEVEL_LOCATION_ID;

export async function schedulePost(
  content: string,
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter',
  scheduledAt: Date
) {
  const response = await axios.post(
    'https://services.leadconnectorhq.com/social-media-posting/post/',
    {
      locationId: GHL_LOCATION_ID,
      content,
      platforms: [platform],
      scheduledAt: scheduledAt.toISOString(),
    },
    {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
    }
  );
  
  return response.data;
}
```

---

# MONITORING & OBSERVABILITY

## Cloud Monitoring Setup

```typescript
// monitoring.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
  telemetry: {
    instrumentation: 'opentelemetry',
    exporter: 'cloud-trace',
  },
});

// All Genkit operations automatically traced
```

## Custom Metrics

```typescript
// metrics.ts
import { Metrics } from '@google-cloud/monitoring';

const monitoring = new Metrics.MetricServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT;

export async function recordContentGeneration(
  platform: string,
  episodeId: string,
  durationMs: number,
  success: boolean
) {
  const dataPoint = {
    interval: {
      endTime: { seconds: Date.now() / 1000 },
    },
    value: { doubleValue: durationMs },
  };
  
  await monitoring.createTimeSeries({
    name: `projects/${projectId}`,
    timeSeries: [{
      metric: {
        type: 'custom.googleapis.com/narrative_reactor/generation_duration',
        labels: { platform, episodeId, success: String(success) },
      },
      resource: {
        type: 'global',
        labels: { project_id: projectId },
      },
      points: [dataPoint],
    }],
  });
}
```

## Alerting

```yaml
# alerting-policy.yaml
displayName: "Narrative Reactor Content Generation Failures"
conditions:
  - displayName: "High Error Rate"
    conditionThreshold:
      filter: 'metric.type="custom.googleapis.com/narrative_reactor/generation_duration" AND metric.labels.success="false"'
      comparison: COMPARISON_GT
      thresholdValue: 5
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
notificationChannels:
  - projects/narrative-reactor/notificationChannels/slack-alerts
```

---

# COST OPTIMIZATION

## Model Selection Strategy

```typescript
// model-router.ts
type ContentComplexity = 'simple' | 'moderate' | 'complex';

function selectModel(complexity: ContentComplexity, platform: string) {
  // Use cheaper models for simple tasks
  if (complexity === 'simple') {
    return {
      provider: 'googleai',
      model: 'gemini-2.5-flash',  // Cheapest
    };
  }
  
  // Use mid-tier for moderate complexity
  if (complexity === 'moderate') {
    return {
      provider: 'googleai',
      model: 'gemini-2.5-pro',
    };
  }
  
  // Use premium models only for complex tasks
  if (platform === 'linkedin' && complexity === 'complex') {
    return {
      provider: 'anthropic',
      model: 'claude-sonnet-4.5',  // Better for long-form
    };
  }
  
  return {
    provider: 'googleai',
    model: 'gemini-3-pro',
  };
}
```

## Caching Strategy

```typescript
// caching.ts
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();
const CACHE_TTL_HOURS = 24;

export async function getCachedContent(key: string) {
  const doc = await db.collection('content-cache').doc(key).get();
  
  if (!doc.exists) return null;
  
  const data = doc.data();
  const age = Date.now() - data?.createdAt.toMillis();
  
  if (age > CACHE_TTL_HOURS * 60 * 60 * 1000) {
    return null; // Cache expired
  }
  
  return data?.content;
}

export async function cacheContent(key: string, content: any) {
  await db.collection('content-cache').doc(key).set({
    content,
    createdAt: new Date(),
  });
}
```

---

# SECURITY BEST PRACTICES

## IAM Configuration

```bash
# Create service account for Narrative Reactor
gcloud iam service-accounts create narrative-reactor-sa \
  --display-name="Narrative Reactor Service Account"

# Grant minimum required roles
gcloud projects add-iam-policy-binding narrative-reactor \
  --member="serviceAccount:narrative-reactor-sa@narrative-reactor.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding narrative-reactor \
  --member="serviceAccount:narrative-reactor-sa@narrative-reactor.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding narrative-reactor \
  --member="serviceAccount:narrative-reactor-sa@narrative-reactor.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## API Security

```typescript
// middleware/auth.ts
import { getAuth } from 'firebase-admin/auth';

export async function verifyRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await getAuth().verifyIdToken(token);
  
  return decodedToken;
}
```

---

# QUICK REFERENCE

## Environment Variables

```bash
# Required
GOOGLE_CLOUD_PROJECT=narrative-reactor
GEMINI_API_KEY=your-gemini-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional
GOHIGHLEVEL_API_KEY=your-ghl-api-key
GOHIGHLEVEL_LOCATION_ID=your-location-id
FIREBASE_PROJECT_ID=narrative-reactor
```

## CLI Commands

```bash
# Local development
genkit start -- npx tsx src/server.ts

# Deploy to Firebase
firebase deploy

# Deploy to Cloud Run
gcloud run deploy narrative-reactor --source .

# View logs
gcloud logging read "resource.type=cloud_run_revision"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Generate content |
| `/api/schedule/today` | GET | Get today's episodes |
| `/api/episode/:id` | GET | Get episode details |
| `/api/character/:name` | GET | Get character profile |
| `/api/brand` | GET | Get brand guidelines |

---

# DOCUMENT COMPLETE

## Narrative Reactor Platform Documentation

| Part | Content | Words |
|------|---------|-------|
| Part 1 | System Prompt & Overview | ~2,500 |
| Part 2 | Google Services Integration | ~3,500 |
| Part 3 | Vertex AI & Claude Code | ~3,000 |
| Part 4 | User Interaction Guide | ~2,500 |
| Part 5 | Deployment & Production | ~2,000 |

**Total: ~13,500 words**

## Key Integrations

- **Google Antigravity** - Agent-first IDE
- **Firebase AI Logic** - Client-side Gemini access
- **Genkit SDK** - Server-side AI orchestration
- **Vertex AI** - Enterprise Gemini, Imagen, Veo
- **Claude Code** - Advanced copy generation
- **Firestore** - Vector search, storage
- **Cloud Run/Functions** - Serverless deployment

---

**© ForwardLane | Signal Studio | Narrative Reactor**

*Decision Velocity for Regulated Industries*
