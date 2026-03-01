# NarrativeReactor

AI-powered content generation platform for Signal Studio — multi-format content creation, brand compliance, social publishing, and campaign management.

## Features

- **Multi-format content generation** — blog posts, social media, newsletters via Genkit flows (Gemini + Claude)
- **Brand compliance** — voice analysis, consistency scoring, automated compliance checks
- **Social publishing** — publish to platforms via Blotato integration
- **Campaign management** — create, advance, and track multi-stage campaigns
- **Video pipeline** — text-to-video generation via Fal.ai, subtitles, stitching, thumbnails, templates
- **Text-to-speech** — TTS via Fish Audio, podcast generation, multi-voice dialogue
- **Competitor tracking** — monitor competitor posts and analyze strategies
- **Scheduling** — calendar-based post scheduling with optimal time suggestions
- **Content library** — save, search, and tag generated content (SQLite)
- **Hashtag discovery** — recommend and track hashtag performance
- **Audience personas** — build and manage target audience profiles
- **Approval workflow** — submit, review, approve/reject content with team collaboration
- **Cost tracking** — per-call cost tracking for AI providers

## Architecture

```
Express API (port 3401) → Genkit Flows → 32 Services → SQLite
                                ↓
                    External APIs: Fal.ai, Fish Audio,
                    Blotato, Google Gemini, Anthropic Claude
```

- **Express** handles routing, auth, rate limiting, CORS
- **Genkit flows** orchestrate AI calls (content generation, compliance, video, chat)
- **32 services** cover everything from brand management to video stitching
- **SQLite** for persistence (content library, campaigns, brands, schedules)
- **Genkit dev UI** runs on a separate port (3402) for flow debugging

## Quick Start

```bash
git clone <repo-url>
cd NarrativeReactor
npm install
cp .env.example .env   # fill in your API keys
npm run dev             # starts Express + Genkit dev UI
```

The API runs on `http://localhost:3401` and the Genkit UI on `http://localhost:3402`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NR_PORT` | No | API server port (default: `3401`) |
| `GENKIT_PORT` | No | Genkit dev UI port (default: `3402`) |
| `API_KEY` | **Yes** | API key for authenticating `/api/*` requests |
| `CORS_ALLOWED_ORIGINS` | Prod | Comma-separated allowed origins (required in production) |
| `TOKEN_ENCRYPTION_KEY` | Prod | 64-char hex string for token encryption (required in production) |
| `DASHBOARD_PASSWORD` | Prod | Password for dashboard login (required in production) |
| `JWT_SECRET` | No | JWT signing secret (falls back to `API_KEY`) |
| `GOOGLE_GENAI_API_KEY` | **Yes** | Google Gemini API key |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic Claude API key |
| `FAL_KEY` | **Yes** | Fal.ai API key for video/image generation |
| `FAL_IMAGE_MODEL` | No | Override default fal.ai image model |
| `FAL_VIDEO_MODEL` | No | Override default fal.ai video model |
| `WEBHOOK_SECRET` | **Yes** | Secret for webhook signature verification |
| `COST_FAL_IMAGE` | No | Override fal.ai image cost per call (USD) |
| `COST_FAL_VIDEO` | No | Override fal.ai video cost per call (USD) |
| `COST_CLAUDE_CALL` | No | Override Claude cost per call (USD) |

Generate the encryption key with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API Overview

All `/api/*` routes require `X-API-Key` header. Rate limited to 100 req/15min/IP.

| Group | Endpoints | Description |
|-------|-----------|-------------|
| **Content** | `POST /api/generate`, `POST /api/compliance` | Generate content, check brand compliance |
| **Pipeline** | `/api/pipeline/*` | Content pipeline & Blotato publishing |
| **Campaigns** | `GET/POST /api/campaigns`, `POST /api/campaigns/:id/advance` | Campaign CRUD & progression |
| **Brands** | `GET/POST/PUT/DELETE /api/brands`, voice analysis, scoring | Brand management & voice consistency |
| **Video** | `POST /api/video`, `/api/video/project`, subtitles, templates, thumbnails | Video generation & post-production |
| **Audio** | `POST /api/audio/tts`, `/api/audio/podcast`, `/api/audio/dialogue` | TTS, podcasts, multi-voice dialogue |
| **Social** | `POST /api/social/post`, integrations, performance, mentions | Social publishing via Blotato |
| **Calendar** | `GET/POST/DELETE /api/calendar` | Post scheduling |
| **Performance** | `/api/performance/*` | Track post performance & optimal times |
| **Competitors** | `GET/POST /api/competitors`, activity, strategy analysis | Competitor monitoring |
| **Library** | `GET/POST /api/library`, search, tags | Content storage & search |
| **Hashtags** | `/api/hashtags`, recommend, performance | Hashtag discovery & tracking |
| **Personas** | `GET /api/personas`, `POST /api/personas/build` | Audience persona management |
| **Review** | `/api/content/:id/review`, approve, reject, comments | Approval workflow & collaboration |
| **Tasks** | `POST /api/tasks/assign`, `GET /api/tasks/:userId` | Team task assignment |
| **Costs** | `GET /api/costs` | Cost tracking summary |
| **Trends** | `GET /api/trends`, brief, auto-generate | Trending topics & content briefs |
| **Agents** | `/api/agents/*` | Inter-agent communication |
| **Health** | `GET /health` | Health check (no auth) |
| **Webhooks** | `POST /webhooks/*` | Webhook receivers (webhook secret auth) |

## Dashboard

A static dashboard is served from `/public` and protected by password authentication.

- **Login:** `GET /login` → enter `DASHBOARD_PASSWORD`
- **Logout:** `GET /logout`
- Session managed via JWT cookie (signed with `JWT_SECRET` or `API_KEY`)
- In production, `DASHBOARD_PASSWORD` must be set or the dashboard is inaccessible

## Docker

```bash
# Build
docker build -t narrative-reactor .

# Run
docker run -p 8080:8080 --env-file .env narrative-reactor
```

The Dockerfile uses a multi-stage build (node:20-slim), runs as non-root `appuser`, and includes a health check. In production, the `PORT` env var (default `8080`) is used instead of `NR_PORT`.

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

274 tests across 24 test files using Vitest.

## Security

- **CORS allowlist** — `CORS_ALLOWED_ORIGINS` enforced in production; wildcard blocked
- **API key auth** — all `/api/*` routes require `X-API-Key` header
- **Rate limiting** — 100 requests per 15 minutes per IP on `/api/*`
- **Token encryption** — `TOKEN_ENCRYPTION_KEY` (32 bytes) required in production
- **Dashboard auth** — password-protected with JWT sessions
- **Production guards** — destructive operations (e.g., `POST /api/admin/wipe`) are guarded
- **Webhook verification** — `WEBHOOK_SECRET` for inbound webhook auth
- **Non-root Docker** — production container runs as unprivileged user

## License

MIT
