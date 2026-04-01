# NarrativeReactor — Final Comprehensive Test Plan

**Date:** 2026-04-01  
**Branch:** `feat/tdd-coverage-push`  
**Current Score:** 7.8/10  
**Target Score:** 9.5/10  
**Author:** Automated Deep Dive Analysis

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NarrativeReactor                                  │
│                   (Node.js 22 + Express 4 + TypeScript)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Dashboard    │  │   API Key    │  │  Tenant Auth │  │   Webhook   │  │
│  │  Auth (JWT)   │  │  Middleware  │  │  + Quota     │  │   Secret    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                  │                  │                  │         │
│  ┌──────┴──────────────────┴──────────────────┴──────────────────┴──────┐ │
│  │                         Express App                                  │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ /api/*  │ │/api/pipe-│ │/api/billing│ │/webhooks │ │  /docs   │ │ │
│  │  │(71 endp)│ │line/*    │ │            │ │          │ │(Swagger) │ │ │
│  │  └────┬────┘ └────┬─────┘ └─────┬──────┘ └────┬─────┘ └──────────┘ │ │
│  └───────┼───────────┼─────────────┼─────────────┼─────────────────────┘ │
│          │           │             │             │                        │
│  ┌───────┴───────────┴─────────────┴─────────────┴──────────────────────┐│
│  │                        Services Layer (40+ services)                  ││
│  │                                                                       ││
│  │  Content:           Social:            Business:         AI/Media:    ││
│  │  ─ contentPipeline  ─ blotatoPublisher ─ billing         ─ tts       ││
│  │  ─ contentLibrary   ─ publisher        ─ meteredBilling  ─ podcast   ││
│  │  ─ captionGenerator ─ postingScheduler ─ tenants         ─ dialogue  ││
│  │  ─ campaigns        ─ postingOptimizer ─ costTracker     ─ videoStitch││
│  │  ─ approvalWorkflow ─ calendar         ─ strategyReport  ─ thumbnail ││
│  │  ─ brandManager     ─ linkedin         ─ teamCollab      ─ subtitles ││
│  │  ─ brandVoice       ─ competitorTracker                  ─ voiceCloner││
│  │  ─ brandScorer      ─ hashtagDiscovery                              ││
│  │  ─ personaBuilder   ─ audiencePersona                               ││
│  └───────────────────────────────────────────────────────────────────────┘│
│          │           │             │             │                        │
│  ┌───────┴───────────┴─────────────┴─────────────┴──────────────────────┐│
│  │                     External Integrations                             ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ││
│  │  │ Google   │ │ Anthropic│ │ fal.ai   │ │ Blotato  │ │  Stripe   │ ││
│  │  │ Genkit   │ │ Claude   │ │ (images/ │ │ (social  │ │ (billing) │ ││
│  │  │ (Gemini) │ │          │ │  video)  │ │  posts)  │ │           │ ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘ ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                           ││
│  │  │ Twitter  │ │ LinkedIn │ │ Sentry   │                           ││
│  │  │ API v2   │ │ OAuth2   │ │ (errors) │                           ││
│  │  └──────────┘ └──────────┘ └──────────┘                           ││
│  └───────────────────────────────────────────────────────────────────────┘│
│          │                                                               │
│  ┌───────┴──────────────────────────────────────────────────────────────┐│
│  │                SQLite (node:sqlite, WAL mode)                         ││
│  │  Tables: content_drafts, agent_messages, campaigns, workflows,       ││
│  │          scheduled_posts, content_library, tenants, brands,          ││
│  │          schema_versions                                              ││
│  │  Migration system: 3 versions applied                                 ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  Deployment: Railway (Dockerfile, multi-stage build, non-root user)      │
│  Genkit Dev Server: separate port (3402) for flow UI                     │
│  Scheduler: 60s interval checking for due posts                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key Stats:**
- **93 total API endpoints** across 5 route files
- **40+ service modules** in `src/services/`
- **14 lib modules** in `src/lib/`
- **5 middleware modules** in `src/middleware/`
- **4 Genkit flows** in `src/flows/`
- **6 external API integrations** (Google Genkit, Anthropic, fal.ai, Blotato, Stripe, Twitter)

---

## 2. Current Test Health

### 2.1 Test Results (as of 2026-04-01)

| Metric | Value |
|--------|-------|
| **Test files** | 57 total |
| **Tests** | 649 total |
| **Passing** | 646 (99.5%) |
| **Failing** | 3 (0.5%) |
| **Duration** | ~3.2s |

**Failing Tests:**
1. `brandManager.test.ts` → `listBrands > includes created brands` — state isolation issue (brand created in one test not visible in list due to in-memory map vs DB mismatch)
2. `brandVoice.test.ts` → 3 tests failing — `generateWithVoice` can't find brand because test creates brand in in-memory store but service reads from DB

**Root Cause:** These are test setup issues — the tests create brands via direct function calls but the service reads from a different store. Fix: ensure test setup uses the same persistence path.

### 2.2 Coverage Summary

| Metric | Current | Threshold | Status |
|--------|---------|-----------|--------|
| **Statements** | 74.89% | 70% | ✅ Pass |
| **Branches** | 66.47% | 60% | ✅ Pass |
| **Functions** | 80.00% | 70% | ✅ Pass |
| **Lines** | 75.14% | 70% | ✅ Pass |

### 2.3 Build Health

- ✅ **TypeScript compilation:** Clean (zero errors)
- ✅ **No deprecated API warnings**
- ✅ Multi-stage Docker build works (Node 22 slim)

---

## 3. Coverage Gap Analysis

### 3.1 CRITICAL GAPS (0% coverage)

| File | Stmts | Lines | Functions | Impact |
|------|-------|-------|-----------|--------|
| **`routes/index.ts`** | 0% | 0% | 0/71 funcs | **🔴 CRITICAL** — All 71 API routes untested |
| **`routes/linkedin.ts`** | 0% | 0% | 0/4 funcs | 🔴 LinkedIn OAuth flow untested |

### 3.2 LOW COVERAGE (< 60%)

| File | Stmts | Branches | Risk |
|------|-------|----------|------|
| `lib/social-providers.ts` | 43.2% | 31.3% | 🟠 Twitter/social OAuth + posting logic |
| `routes/pipeline.ts` | 40.2% | 22.9% | 🟠 Content pipeline + Blotato publishing routes |
| `services/brandVoice.ts` | 68.2% | 55.6% | 🟡 Brand voice generation |

### 3.3 MEDIUM COVERAGE (60-80%)

| File | Stmts | Branches | Note |
|------|-------|----------|------|
| `services/meteredBilling.ts` | 70.0% | 62.2% | Stripe metered billing logic |
| `services/agentComm.ts` | 73.7% | 73.7% | Agent-to-agent communication |
| `services/billing.ts` | 90.9% | 68.7% | Branch coverage needs work |
| `services/videoPredictor.ts` | 90.1% | 66.1% | Branch coverage low |

### 3.4 WELL COVERED (> 90%)

Most services and all middleware/lib modules are well covered:
- All flows: 100%
- All middleware: 100% 
- Most libs: 90%+
- Most services: 90%+

### 3.5 Explicitly Excluded from Coverage

These files are excluded in `vitest.config.ts` — intentional:
- `src/index.ts` (app bootstrap)
- `src/services/publisher.ts` (external API calls)
- `src/services/schedulerWorker.ts` (interval-based worker)
- `src/services/tts.ts` (external TTS API)
- `src/services/podcastGenerator.ts` (external API)
- `src/services/dialogue.ts` (external API)
- `src/services/videoStitcher.ts` (external ffmpeg)
- `src/services/thumbnailGenerator.ts` (external API)
- `src/services/subtitles.ts` (external API)
- `src/services/trendpilotBridge.ts` (external service)

---

## 4. Security Audit Findings

### 4.1 Strengths ✅

1. **Helmet.js** — Security headers applied first
2. **CORS** — Allowlist-based in production, permissive only in dev
3. **Rate limiting** — 100 req/15min on `/api/*` via `express-rate-limit`
4. **API key auth** — Fails closed in production (503 if API_KEY not set)
5. **Multi-tenant auth** — `smartAuth` middleware with quota enforcement
6. **Webhook secret** — Separate secret for webhook routes
7. **No hardcoded keys** — All secrets via environment variables
8. **Token encryption** — `tokenEncryption.ts` for social OAuth tokens (AES)
9. **Non-root Docker** — Production container runs as `appuser`
10. **Sentry integration** — Error reporting with DSN (optional)
11. **Zod** — Listed as dependency for input validation
12. **CSRF protection** — JWT-based dashboard auth with httpOnly cookies

### 4.2 Risks & Gaps ⚠️

1. **🟠 No input validation on most route handlers** — Routes check for field presence (`if (!field)`) but don't validate types, lengths, or formats. No Zod schemas applied to request bodies despite Zod being a dependency.

2. **🟠 SQLite parameterized queries look safe** — All DB operations use `prepare().run()` with parameters (not string concatenation), so SQL injection risk is low. But no explicit sanitization layer.

3. **🟠 `/api/admin/wipe` endpoint** — Destructive endpoint protected only by `apiKeyAuth`. No additional admin-level auth or confirmation. Uses `guardDestructive()` (blocks in production) but should have role-based access.

4. **🟡 CORS allows no-origin requests** — `if (!origin) return callback(null, true)` — allows server-to-server calls but also allows any non-browser client.

5. **🟡 Rate limiting only on `/api`** — Webhook endpoints (`/webhooks/*`) and dashboard routes are not rate-limited.

6. **🟡 JWT secret fallback** — `JWT_SECRET` falls back to `API_KEY` if not set. Should be independent.

7. **🟢 `TOKEN_ENCRYPTION_KEY`** — Required in production for social token encryption. Good.

---

## 5. Integration Point Audit

### 5.1 Google Genkit AI

- **Status:** Properly configured with `@genkit-ai/google-genai` and `@genkit-ai/vertexai`
- **Dual model support:** Gemini (Google) + Claude (Anthropic) via `genkitx-anthropic`
- **Fallback:** `useClaude` flag allows switching between providers per-request
- **Gap:** No circuit breaker or retry logic visible at the Genkit flow level
- **Gap:** No timeout configuration on AI generation calls

### 5.2 Blotato Publisher

- **Status:** Complete pipeline — `contentPipeline` → `blotatoPublisher` → `lib/blotato`
- **Supports:** Publish drafts, raw content, scheduled posts, queue management, account listing
- **Gap:** No retry on failed publishes
- **Gap:** No dead letter queue for failed posts

### 5.3 SQLite Database

- **Status:** Well-implemented using Node 22's built-in `node:sqlite`
- **WAL mode** enabled for concurrent reads
- **Foreign keys** enabled
- **Busy timeout** set (5000ms)
- **Migration system:** 3 versions, applied on startup
- **Gap:** No backup strategy
- **Gap:** No connection pool (single DatabaseSync instance — acceptable for SQLite)
- **Gap:** `resetDb()` exists but no graceful shutdown hook to close DB

### 5.4 Multi-Tenant

- **Status:** Tenant isolation via API key → tenant lookup → `req.tenant`
- **Quota enforcement** with per-tenant token limits
- **Usage tracking** with `incrementUsage()`
- **Gap:** Content drafts have `tenant_id` column but routes don't filter by tenant — **potential data leak**
- **Gap:** No tenant-scoped access control on campaigns, brands, or workflows

### 5.5 Stripe Billing

- **Status:** `routes/billing.ts` (93% covered) + `services/billing.ts` + `services/meteredBilling.ts`
- **Webhook handling** for Stripe events
- **Gap:** Metered billing only 70% covered

### 5.6 Social Providers (Twitter/LinkedIn)

- **Status:** OAuth2 PKCE flows for X/Twitter and LinkedIn
- **Token encryption** for stored tokens
- **Gap:** `lib/social-providers.ts` only 43% covered — critical auth flows untested
- **Gap:** LinkedIn routes at 0% coverage

---

## 6. Prioritized Test Plan

### P0 — CRITICAL (Must fix immediately) — Estimated: 3-4 days

#### P0.1: Fix Failing Tests (0.5 day)

```
Files to fix:
  - src/__tests__/services/brandManager.test.ts (1 failure)
  - src/__tests__/services/brandVoice.test.ts (3 failures)

Root cause: Brand creation in tests uses in-memory store but service
reads from DB. Fix: Use proper DB-backed setup/teardown in tests.
```

#### P0.2: Route Integration Tests — `routes/index.ts` (2-3 days)

**This is the #1 gap.** 71 API endpoints with 0% coverage.

Create `src/__tests__/routes/api.test.ts` using Express app directly (no supertest needed if using Vitest + direct handler calls, but supertest is recommended):

```
Install: pnpm add -D supertest @types/supertest

Test groups needed:
  1. Content Generation (4 endpoints)
     - POST /api/generate — valid request → 200
     - POST /api/generate — missing fields → 400
     - POST /api/compliance — valid → 200
     - POST /api/video — valid → 200
     - POST /api/chat — valid → 200

  2. Social Media (4 endpoints)
     - POST /api/social/post — valid → 200
     - GET  /api/social/integrations → 200
     - GET  /api/social/performance?provider=x → 200
     - GET  /api/social/mentions?provider=x → 200

  3. Calendar (3 endpoints)
     - GET  /api/calendar → 200
     - POST /api/calendar — valid → 201
     - DELETE /api/calendar/:id → 200 or 404

  4. Publishing (1 endpoint)
     - POST /api/publish — valid → 200

  5. Performance Tracking (4 endpoints)
     - POST /api/performance/track → 201
     - GET  /api/performance/:postId → 200
     - GET  /api/performance/best → 200
     - GET  /api/performance/optimal-times → 200

  6. Content Library (5 endpoints)
     - GET  /api/library → 200
     - GET  /api/library/search?q=test → 200
     - GET  /api/library/tag/:tag → 200
     - GET  /api/library/:id → 200 or 404
     - POST /api/library → 201

  7. Agent Communication (4 endpoints)
     - POST /api/agents/message → 200
     - GET  /api/agents/log → 200
     - POST /api/agents/send → 200
     - GET  /api/agents/registry → 200

  8. Trendpilot (3 endpoints)
     - GET  /api/trends → 200
     - POST /api/trends/brief → 200
     - POST /api/trends/auto-generate → 200

  9. Campaigns CRUD (5 endpoints)
     - GET  /api/campaigns → 200
     - GET  /api/campaigns/:id → 200 or 404
     - POST /api/campaigns → 201
     - POST /api/campaigns/:id/advance → 200
     - DELETE /api/campaigns/:id → 200 or 404

  10. Audio/Podcast (4 endpoints)
      - POST /api/audio/tts → 200
      - POST /api/audio/podcast → 200
      - POST /api/audio/dialogue → 200
      - GET  /api/audio/library → 200

  11. Competitors (5 endpoints)
      - GET  /api/competitors → 200
      - POST /api/competitors → 201
      - POST /api/competitors/:id/posts → 200
      - GET  /api/competitors/:id/activity → 200
      - GET  /api/competitors/:id/strategy → 200

  12. Hashtags (3 endpoints)
      - GET  /api/hashtags?topic=... → 200
      - POST /api/hashtags/recommend → 200
      - GET  /api/hashtags/:tag/performance → 200

  13. Optimal Times (2 endpoints)
      - GET  /api/optimal-times?platform=... → 200
      - GET  /api/optimal-times/next?platform=... → 200

  14. Personas (2 endpoints)
      - GET  /api/personas → 200
      - POST /api/personas/build → 200

  15. Video (4 endpoints)
      - POST /api/video/project → 200
      - POST /api/video/subtitles → 200
      - GET  /api/video/templates → 200
      - POST /api/video/thumbnail → 200

  16. Brands CRUD + Voice (8 endpoints)
      - GET  /api/brands → 200
      - GET  /api/brands/:id → 200 or 404
      - POST /api/brands → 201
      - PUT  /api/brands/:id → 200
      - DELETE /api/brands/:id → 200
      - POST /api/brands/:id/voice-analysis → 200
      - POST /api/brands/:id/generate → 200
      - POST /api/brands/:id/score → 200

  17. Content Review/Approval (5 endpoints)
      - POST /api/content/:id/review → 200
      - POST /api/content/:id/approve → 200
      - POST /api/content/:id/reject → 200
      - GET  /api/review-queue → 200
      - GET  /api/content/:id/review → 200

  18. Team Collaboration (4 endpoints)
      - POST /api/content/:id/comments → 200
      - GET  /api/content/:id/comments → 200
      - POST /api/tasks/assign → 200
      - GET  /api/tasks/:userId → 200

  19. Admin (1 endpoint)
      - POST /api/admin/wipe — blocked in production → 403

Strategy: Mock all external service calls (Genkit flows, Blotato,
social providers). Test request parsing, validation, auth, and
response shape. Use in-memory SQLite for DB-backed routes.
```

#### P0.3: Pipeline Route Tests (0.5 day)

```
File: src/__tests__/routes/pipeline.test.ts
Current coverage: 40.2% stmts, 22.9% branches

Additional tests needed:
  - POST /api/pipeline/generate — with tenant auth
  - POST /api/pipeline/generate — quota exceeded → 429
  - POST /api/pipeline/research — valid + tenant tracking
  - GET  /api/pipeline/drafts — list drafts
  - GET  /api/pipeline/drafts/:id — get/404
  - POST /api/pipeline/drafts/:id/approve — state transitions
  - POST /api/pipeline/drafts/:id/reject — state transitions
  - PUT  /api/pipeline/drafts/:id — update content
  - POST /api/pipeline/publish — Blotato integration
  - POST /api/pipeline/publish/content — raw content publish
  - GET  /api/pipeline/blotato/queue — list queue
  - GET  /api/pipeline/blotato/post/:id — post status
  - DELETE /api/pipeline/blotato/post/:id — cancel post
  - GET  /api/pipeline/blotato/accounts — list accounts
```

---

### P1 — HIGH PRIORITY (Next sprint) — Estimated: 2-3 days

#### P1.1: Social Provider Tests (1 day)

```
File: src/__tests__/lib/social-providers.test.ts
Current: 43.2% stmts, 31.3% branches

Tests needed:
  - XProvider.generateAuthUrl() — returns valid URL with PKCE params
  - XProvider.authenticate() — happy path + error handling
  - XProvider.post() — successful tweet + error cases
  - XProvider.getAnalytics() — returns mock data
  - XProvider.getMentions() — returns mock data
  - LinkedInProvider (same set)
  - Token encryption round-trip (encrypt → store → decrypt → use)
  - Missing env vars (X_CLIENT_ID, etc.) → graceful failure
```

#### P1.2: LinkedIn Route Tests (0.5 day)

```
File: src/__tests__/routes/linkedin.test.ts
Current: 0% coverage

Tests needed:
  - GET  /api/linkedin/callback — OAuth redirect handling
  - Error cases — missing code, invalid state
  - Token storage after successful auth
```

#### P1.3: Metered Billing Coverage (0.5 day)

```
File: src/__tests__/services/meteredBilling.test.ts
Current: 70% stmts, 62.2% branches

Additional tests:
  - Stripe meter event reporting
  - Usage aggregation edge cases
  - Billing period boundaries
  - Failed Stripe API calls
```

#### P1.4: Tenant Data Isolation Tests (1 day)

```
New file: src/__tests__/security/tenant-isolation.test.ts

Tests:
  - Tenant A cannot access Tenant B's drafts
  - Tenant A cannot access Tenant B's campaigns
  - Tenant A cannot access Tenant B's brands
  - Admin key bypasses tenant restrictions
  - Quota enforcement per tenant
  - Quota reset behavior
  - API key rotation
```

---

### P2 — MEDIUM PRIORITY (Following sprint) — Estimated: 3-4 days

#### P2.1: E2E Integration Tests (1.5 days)

```
File: src/__tests__/e2e/full-pipeline.test.ts

Full flow tests (with mocked external APIs):
  1. Content Creation Flow:
     POST /api/pipeline/generate (topic)
     → GET /api/pipeline/drafts/:id (verify draft)
     → POST /api/pipeline/drafts/:id/approve
     → POST /api/pipeline/publish (via Blotato)
     → Verify post appears in queue

  2. Campaign Lifecycle:
     POST /api/campaigns (create)
     → POST /api/campaigns/:id/advance (draft → scheduled)
     → POST /api/campaigns/:id/advance (scheduled → live)
     → GET /api/campaigns/:id (verify status)

  3. Brand Voice Pipeline:
     POST /api/brands (create brand)
     → POST /api/brands/:id/voice-analysis
     → POST /api/brands/:id/generate (with voice)
     → POST /api/brands/:id/score (consistency)

  4. Content Review Workflow:
     POST /api/library (save content)
     → POST /api/content/:id/review (submit)
     → GET /api/review-queue (appears)
     → POST /api/content/:id/approve
     → Verify state transition

  5. Multi-Tenant Pipeline:
     Create tenant A → generate content → verify isolation
     Create tenant B → generate content → verify isolation
     Verify A can't see B's content
```

#### P2.2: Security Tests (1 day)

```
File: src/__tests__/security/auth-bypass.test.ts

  - No API key → 401 on all /api/* routes
  - Invalid API key → 401
  - Missing API_KEY env in production → 503
  - Webhook without secret → 401
  - Rate limit enforcement (101st request → 429)
  - CORS rejection for unlisted origins
  - JWT expiration → 401 on /auth/me
  - Dashboard auth bypass attempts

File: src/__tests__/security/injection.test.ts

  - SQL injection in query params (e.g., /api/library/:id)
  - XSS in request bodies (content field)
  - Path traversal in file-related endpoints
  - Oversized request bodies
  - Malformed JSON bodies
```

#### P2.3: Error Handling Tests (0.5 day)

```
File: src/__tests__/middleware/globalErrors.test.ts

  - asyncHandler catches thrown errors → 500
  - globalErrorHandler formats error response
  - Sentry captureException called on errors
  - unhandledRejection handler behavior
  - uncaughtException handler exits after Sentry flush
```

#### P2.4: Database Edge Cases (0.5 day)

```
File: src/__tests__/lib/db-edge.test.ts

  - Migration idempotency (run migrations twice → no error)
  - Legacy JSON import (data/campaigns.json → SQLite)
  - Large payload handling (4MB draft content)
  - Concurrent writes (WAL mode validation)
  - resetDb() properly closes and re-initializes
  - Missing data directory → auto-created
  - MESSAGE_LOG max 200 enforcement
```

---

### P3 — LOW PRIORITY (Backlog) — Estimated: 2-3 days

#### P3.1: Load Tests (1 day)

```
Tool: k6 or autocannon

File: load-tests/api-load.test.js

Scenarios:
  1. Baseline: 50 concurrent users, 100 req/s for 60s
     - /health → < 10ms p99
     - /api/library → < 50ms p99
     - /api/brands → < 50ms p99

  2. AI Generation Load: 10 concurrent /api/generate calls
     - Verify no crashes, proper queuing
     - Measure response time distribution

  3. Pipeline Stress: 20 concurrent /api/pipeline/generate
     - Verify SQLite handles concurrent writes
     - Verify tenant quota enforcement under load

  4. Rate Limit Validation: 200 rapid requests
     - First 100 → 200
     - Next 100 → 429
```

#### P3.2: Excluded Service Tests (1 day)

```
These services are excluded from coverage but should have
basic smoke tests with mocked externals:

  - src/services/publisher.ts — mock all social API calls
  - src/services/schedulerWorker.ts — mock timer, verify scheduling logic
  - src/services/tts.ts — mock fal.ai calls
  - src/services/podcastGenerator.ts — mock AI calls
  - src/services/dialogue.ts — mock AI calls
  - src/services/videoStitcher.ts — mock ffmpeg
  - src/services/thumbnailGenerator.ts — mock fal.ai
  - src/services/subtitles.ts — mock external service
  - src/services/trendpilotBridge.ts — mock HTTP calls
```

#### P3.3: OpenAPI Spec Validation (0.5 day)

```
File: src/__tests__/openapi-validation.test.ts

  - All 93 endpoints documented in OpenAPI spec
  - Response schemas match actual responses
  - Request validation matches documented parameters
  - No undocumented endpoints
```

---

## 7. Path to Production Readiness

### 7.1 Currently Implemented ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Error monitoring | ✅ Sentry (lightweight HTTP) | No SDK, uses fetch to envelope endpoint |
| Healthcheck | ✅ `/health` endpoint | Configured in Dockerfile + Railway |
| Rate limiting | ✅ `express-rate-limit` | 100/15min on `/api/*` |
| Security headers | ✅ Helmet.js | CSP disabled (dashboard needs inline scripts) |
| Docker multi-stage | ✅ Non-root user | Node 22 slim base |
| Env validation | ✅ `validateEnv()` at startup | Throws in production if keys missing |
| DB migrations | ✅ Auto-run on startup | 3 versions |

### 7.2 Missing for Production 🔴

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **Structured logging** | P0 | 1 day | Replace `console.log/warn/error` with structured JSON logger (pino). Essential for Railway log aggregation and Sentry breadcrumbs. |
| **Graceful shutdown** | P0 | 0.5 day | Handle `SIGTERM`/`SIGINT` — close SQLite connection, drain HTTP server, flush Sentry. Currently `uncaughtException` does `setTimeout(() => process.exit(1), 2000)` but no graceful shutdown on normal signals. |
| **Database backups** | P1 | 1 day | SQLite WAL checkpoint + backup to S3/Railway volume. Cron job or startup snapshot. Data loss risk without this. |
| **Request ID tracing** | P1 | 0.5 day | Add `X-Request-ID` header to every request for log correlation. |
| **Input validation** | P1 | 2 days | Apply Zod schemas to all request bodies. Zod is already a dependency — just not used for route validation. |
| **Tenant data isolation** | P0 | 1 day | Routes currently don't filter by `tenant_id`. Need to add tenant scoping to all data queries. |
| **Circuit breaker** | P2 | 1 day | For Genkit AI, Blotato, and social API calls. Prevent cascade failures. |
| **Retry logic** | P2 | 0.5 day | Exponential backoff for external API calls (Blotato publish, AI generation). |
| **API versioning** | P3 | 0.5 day | Currently no versioning. Add `/api/v1/` prefix for future compatibility. |
| **OpenAPI completeness** | P2 | 1 day | Ensure all 93 endpoints are documented in the Swagger spec. |

---

## 8. Recommended CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, feat/*]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test:ci
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
      - name: Coverage threshold check
        run: |
          node -e "
            const s = require('./coverage/coverage-summary.json');
            const t = s.total;
            const checks = [
              ['Statements', t.statements.pct, 75],
              ['Branches', t.branches.pct, 65],
              ['Functions', t.functions.pct, 75],
              ['Lines', t.lines.pct, 75],
            ];
            let fail = false;
            for (const [name, actual, min] of checks) {
              const ok = actual >= min;
              console.log(\`\${ok ? '✅' : '❌'} \${name}: \${actual}% (min: \${min}%)\`);
              if (!ok) fail = true;
            }
            if (fail) process.exit(1);
          "

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level moderate
      - name: Check for hardcoded secrets
        run: |
          ! grep -rn 'sk-\|sk_live\|whsec_\|password.*=.*"[^"]\{8,\}"' src/ \
            --include='*.ts' --exclude-dir=__tests__
```

---

## 9. Effort Summary

| Priority | Category | Estimated Effort |
|----------|----------|-----------------|
| **P0** | Fix failing tests | 0.5 day |
| **P0** | Route integration tests (71 endpoints) | 2.5 days |
| **P0** | Pipeline route tests | 0.5 day |
| **P0** | Tenant data isolation | 1 day |
| **P0** | Graceful shutdown | 0.5 day |
| **P0** | Structured logging | 1 day |
| | **P0 Subtotal** | **6 days** |
| **P1** | Social provider tests | 1 day |
| **P1** | LinkedIn route tests | 0.5 day |
| **P1** | Metered billing coverage | 0.5 day |
| **P1** | Tenant isolation tests | 1 day |
| **P1** | DB backups | 1 day |
| **P1** | Input validation (Zod) | 2 days |
| | **P1 Subtotal** | **6 days** |
| **P2** | E2E integration tests | 1.5 days |
| **P2** | Security tests | 1 day |
| **P2** | Error handling tests | 0.5 day |
| **P2** | DB edge case tests | 0.5 day |
| | **P2 Subtotal** | **3.5 days** |
| **P3** | Load tests | 1 day |
| **P3** | Excluded service smoke tests | 1 day |
| **P3** | OpenAPI validation | 0.5 day |
| | **P3 Subtotal** | **2.5 days** |
| | **GRAND TOTAL** | **~18 days** |

---

## 10. Coverage Targets After Implementation

| Phase | Stmts Target | Branches Target | Functions Target |
|-------|-------------|-----------------|-----------------|
| After P0 | 85% | 75% | 88% |
| After P0+P1 | 90% | 80% | 92% |
| After P0+P1+P2 | 93% | 85% | 95% |
| After All | 95%+ | 88%+ | 97%+ |

---

## 11. Quick Wins (Can Do Today)

1. **Fix brandManager.test.ts** — ensure brand is created via DB-backed `createBrand()`, not in-memory
2. **Fix brandVoice.test.ts** — same root cause, fix setup to use persistent store
3. **Add `supertest` to devDependencies** — `pnpm add -D supertest @types/supertest`
4. **Create a test helper** to build an Express app instance for route testing without starting servers
5. **Raise coverage thresholds** in `vitest.config.ts` once P0 is complete:
   ```ts
   thresholds: {
     lines: 85,
     statements: 85,
     functions: 85,
     branches: 75,
   }
   ```

---

*Generated by automated architecture analysis on 2026-04-01. Review and adjust estimates based on team velocity.*
