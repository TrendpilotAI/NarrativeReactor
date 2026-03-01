# NarrativeReactor — Optimization Brainstorm

> Generated: 2026-02-28  
> Scope: Revenue, quality, testing, integrations, workflows, performance, security  
> Priority scale: 🔴 High · 🟡 Medium · 🟢 Low  
> Effort scale: S (< 1 day) · M (1–3 days) · L (3–7 days) · XL (> 1 week)

---

## 1. New Features — Revenue & Value

### 🔴 Usage-Based Billing & Metering `[M]`
The platform has a `costTracker` service but no customer-facing billing. Adding Stripe metered billing with per-generation pricing would unlock direct monetization.
- Hook `costTracker.recordCost()` events to Stripe usage records
- Provide per-tenant usage dashboard (credits consumed, $ spent)
- Add hard caps + soft warnings before hitting limits

### 🔴 Multi-Tenant / Workspace Isolation `[L]`
Currently auth is a single shared `API_KEY`. Supporting multiple Signal Studio tenants (teams, brands) with isolated data and billing is the clearest path to revenue at scale.
- Add `workspace_id` column to all in-memory stores → Postgres
- Scoped API keys per workspace with RBAC roles
- Admin panel for workspace management

### 🟡 Content Approval Workflow — Human-in-the-Loop UI `[M]`
`contentPipeline` tracks `status: draft | approved | rejected` but there's no frontend approval experience. A simple review UI (diff view, approve/reject/edit) turns this into a proper editorial tool.
- Build React approval queue in dashboard
- Add email/Slack notifications on pending drafts
- Webhook callbacks when approval state changes

### 🟡 Scheduled Content Calendar with Auto-Publish `[M]`
`postingScheduler` and `postingOptimizer` exist but lack a visual calendar UI. An interactive drag-and-drop schedule view (FullCalendar or custom) with auto-publish triggers would complete the GTM story.
- Visual calendar → connect to Blotato publish API
- Optimal time prediction from `postingOptimizer` surfaced in UI
- Recurring post series / campaign cadences

### 🟡 Brand Voice Score & Compliance Report `[S]`
`brandScorer` and `brandVoice` are live. Package this into a shareable PDF compliance report per content piece.
- Score breakdown (tone, vocabulary, CTA alignment)
- Red/yellow/green compliance badges in approval UI
- Weekly brand consistency digest email

### 🟢 AI-Powered Repurposing Engine `[M]`
Given a long-form piece (blog, podcast transcript), auto-generate all derivative assets: X thread, LinkedIn, short-form clips, email newsletter. Closes the "write once, publish everywhere" loop already implied by the multi-format pipeline.

### 🟢 Competitor Intelligence Digest `[S]`
`competitorTracker` fetches data but no automated digest output exists. Schedule a weekly Slack/email report with top competitor content, engagement deltas, and recommended counter-moves.

---

## 2. Code Quality — DRY, Type Safety, Dead Code

### 🔴 Replace In-Memory Stores with Persistent Storage `[L]`
`contentPipeline`, `videoStitcher`, `campaigns`, `contentLibrary` all use `Map<string, T>` in-memory stores. Data is lost on restart — a critical bug for any production use.
- Migrate to Postgres (Railway already provisioned in Signal Studio project)
- Use Prisma or Drizzle ORM with proper schema migrations
- Keep in-memory as cache layer, not source of truth

### 🔴 Centralize Error Handling `[S]`
Each route/service has ad-hoc try/catch. Create a global Express error middleware + typed `AppError` class with `statusCode`, `code`, and `isOperational` fields.

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(public message: string, public statusCode: number, public code: string) { super(message); }
}
// src/middleware/errorHandler.ts — single place, consistent JSON shape
```

### 🔴 Strict TypeScript — Enable `noUncheckedIndexedAccess` `[S]`
`tsconfig.json` likely has `strict: true` but enabling `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` will surface bugs at compile time that currently fail at runtime.

### 🟡 Consolidate AI Client Instantiation `[S]`
Multiple services import `ai` from `genkit.config` and separately instantiate Claude/Gemini clients. Create a single `src/lib/ai.ts` registry that exports configured clients, avoiding drift between services.

### 🟡 Remove/Audit `debug-exports.js` `[S]`
Root-level `debug-exports.js` is a red flag — likely scaffolding left behind. Audit and remove or move to `scripts/`.

### 🟡 Standardize Response Envelope `[S]`
Some routes return `{ data: ... }`, others return raw objects. Define a typed `ApiResponse<T>` envelope used everywhere:
```typescript
{ success: boolean; data?: T; error?: string; meta?: { requestId: string; timestamp: string } }
```

### 🟢 Extract Magic Strings to Constants `[S]`
Service names, model IDs (`gemini-2.0-flash`, `fal-ai/seedance-v1`), and status strings appear across files. Centralize in `src/lib/constants.ts`.

---

## 3. Testing — Coverage Gaps

### 🔴 Service Unit Tests — 28 Services Untested `[L]`
Only `contentPipeline` and `audio` have service-level tests. The other 30 services have zero coverage.
**Priority order:**
1. `blotatoPublisher` — external API, needs mock + retry coverage
2. `brandVoice` / `brandScorer` — core value prop
3. `campaigns` — business logic
4. `competitorTracker` — side-effect heavy
5. `tts` / `voiceCloner` — Fish Audio integration

### 🔴 Integration Tests for Routes `[M]`
No route-level integration tests exist. Use `supertest` + `vitest` to test full request/response cycles including auth middleware, rate limiting, and error shapes.

```typescript
// Scaffold: tests/integration/api.test.ts
import request from 'supertest';
import { app } from '../../src/index';

describe('POST /api/pipeline/generate', () => {
  it('rejects missing API key with 401', async () => { ... });
  it('returns content draft on valid input', async () => { ... });
});
```

### 🔴 Webhook Signature Verification Tests `[S]`
`webhookRoutes` likely validates HMAC signatures. Needs tests for valid/invalid/missing signatures to prevent regression.

### 🟡 E2E Tests for Content Pipeline `[M]`
The full flow: `researchTopic → generateContent → approve → publish` should have a Playwright or Vitest E2E test against a staging environment.

### 🟡 Coverage Threshold Enforcement `[S]`
Add to `vitest.config.ts`:
```typescript
coverage: {
  thresholds: { lines: 70, functions: 70, branches: 60 }
}
```
CI fails if coverage drops — prevents regression from new untest code.

### 🟢 Snapshot Tests for AI Prompt Templates `[S]`
Prompt strings in `prompts/` directory drift silently. Snapshot tests catch unintended changes to prompts that would alter AI output behavior.

---

## 4. Integrations

### 🔴 Webhook Outbound Events `[M]`
NarrativeReactor consumes webhooks but doesn't emit them. Customers need to be notified when:
- Content draft is ready
- Video generation completes (Fal.ai jobs are async)
- Post is published successfully
- Generation fails

Implement a webhook delivery system with retry, signature (HMAC-SHA256), and a delivery log.

### 🔴 Fal.ai Job Polling → Webhook-Based `[M]`
Video generation with Fal.ai Seedance is likely polling-based. Fal.ai supports `webhook_url` callbacks — switch to push-based to eliminate timeout risk on long renders.

### 🟡 Zapier / Make.com Native Integration `[M]`
Expose a Zapier app or Make.com connector so non-technical Signal Studio users can trigger content generation from external events (new CRM deal, product launch, etc.).

### 🟡 Slack Integration for Approvals `[S]`
Post draft previews to a Slack channel with approve/reject buttons (Block Kit interactive components). Eliminates need to open dashboard for quick approvals.

### 🟡 Analytics Ingestion → BigQuery or Postgres `[M]`
`performanceTracker` collects data but where does it go? Implement a time-series store (Postgres + TimescaleDB, or BigQuery) for historical performance analytics and trend reports.

### 🟢 HubSpot / Salesforce CRM Sync `[L]`
Trigger content campaigns from CRM deal stages. A closed deal → auto-generate case study draft. New contact in segment → personalized nurture sequence.

### 🟢 RSS / Newsletter Integration `[S]`
Pull from competitor RSS feeds into `competitorTracker` for richer trend signals without manual URL monitoring.

---

## 5. Workflows — CI/CD & Developer Experience

### 🔴 Add CI Pipeline (GitHub Actions) `[S]`
No `.github/workflows/` exists. Minimum viable CI:
```yaml
# .github/workflows/ci.yml
- Install deps
- TypeScript type-check (tsc --noEmit)
- Lint (ESLint)
- Test with coverage
- Build (tsc)
```

### 🔴 Add ESLint + Prettier `[S]`
No linter configured. Add:
```json
"@typescript-eslint/eslint-plugin": "^7",
"@typescript-eslint/parser": "^7",
"eslint-plugin-import": "^2",
"prettier": "^3"
```
With `.eslintrc.json` + `.prettierrc`. Pre-commit hook via `husky` + `lint-staged`.

### 🔴 README.md — Project is Missing One `[S]`
`src/README.md` exists but root `README.md` is absent. This is the first thing any new developer or Signal Studio engineer sees. Needs:
- What it is, how to run it locally
- Environment variables reference
- API endpoint overview
- Architecture diagram

### 🟡 Docker + docker-compose for Local Dev `[S]`
`docker-compose.yml` with Postgres + Redis + app container. Eliminates "works on my machine" and enables one-command local setup.

### 🟡 Deployment Config — Railway / Fly.io `[S]`
No `railway.toml`, `fly.toml`, or `Dockerfile` present. Since Signal Studio runs on Railway (per TOOLS.md), add:
```toml
# railway.toml
[build]
builder = "nixpacks"
[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
```

### 🟢 Semantic Release / Conventional Commits `[S]`
`generate-changelog.js` exists but is manual. Wire up `semantic-release` or `standard-version` so CHANGELOG is auto-generated from conventional commit messages on merge to main.

---

## 6. Performance

### 🔴 Persist Draft Store — Eliminate Memory Leak `[L]`
(Overlaps with Code Quality §1.) In-memory `Map` stores grow unbounded. High-volume content generation will OOM the process. Database persistence is the fix.

### 🔴 Fal.ai / Fish Audio Response Caching `[M]`
Identical TTS strings or video prompts are likely regenerated on every call. Add Redis-backed content-addressed cache (SHA256 of prompt → cached asset URL).
- Reduces API costs (Fish Audio at $0.015/min adds up)
- Dramatically faster response for repeated content

### 🟡 Streaming Responses for Long AI Generations `[M]`
Long content generation (blog articles, podcast scripts) blocks the HTTP connection. Implement Server-Sent Events (SSE) streaming so the dashboard shows live progress.

### 🟡 Bundle Size Audit — Dashboard & Web-UI `[S]`
React/Vite dashboard and Next.js web-ui likely have no bundle analysis configured. Add:
- `vite-bundle-visualizer` to dashboard
- `@next/bundle-analyzer` to web-ui
Target: identify and eliminate heavy dependencies, enable code splitting.

### 🟢 Rate Limiter Per-User vs Per-IP `[S]`
Current rate limiter is per-IP (proxy-safe with `trust proxy`?). For authenticated multi-tenant use, rate limit should be per API key, not per IP — prevents tenant A from throttling tenant B behind a shared NAT.

### 🟢 DB Connection Pooling (when Postgres added) `[S]`
Use `pg-pool` or Prisma's built-in pooler. Set `max: 10` connections, add query timeout of 30s.

---

## 7. Security

### 🔴 CORS Wildcard → Allowlist `[S]`
```typescript
// BEFORE (current)
app.use(cors({ origin: '*' }));

// AFTER
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));
```
Critical before exposing to the public internet.

### 🔴 Secrets Management — Move from .env to Vault `[M]`
API keys (Fish Audio, Fal.ai, Blotato, Anthropic) in `.env` files are a breach risk. Migrate to:
- **Railway** secret management (already using Railway for Signal Studio)
- Or **Doppler** / **1Password Secrets Automation**
- Audit: ensure `.env` is in `.gitignore` and no secrets are in git history

### 🔴 Dependency Vulnerability Audit `[S]`
```bash
npm audit --audit-level=moderate
```
Run immediately. Add `npm audit` to CI so new vulns fail the build. Consider `socket.dev` for supply-chain risk scoring.

### 🟡 Request ID Tracing `[S]`
Add `express-request-id` middleware. Log `requestId` on every request. Correlate errors in logs, critical for debugging production issues.

### 🟡 Webhook HMAC Verification — Audit & Harden `[S]`
Ensure all inbound webhooks (Fal.ai job complete, Blotato callbacks) verify HMAC signatures. Missing signature validation = unauthenticated code execution via webhook injection.

### 🟡 Helmet.js Security Headers `[S]`
```typescript
import helmet from 'helmet';
app.use(helmet()); // Adds CSP, HSTS, X-Frame-Options, etc.
```
One line, significant security improvement.

### 🟢 Rotate API Keys — Automated Reminder `[S]`
Add a cron or startup check that warns if `API_KEY` or external keys haven't been rotated in 90 days (compare against a `KEY_CREATED_AT` env var).

### 🟢 Input Sanitization for AI Prompts `[S]`
User-supplied content flows into AI prompts. Add basic prompt injection defenses:
- Strip `<system>`, `[INST]`, `###` markers from user input
- Length limits on all text inputs (max 10,000 chars)
- Zod validation on all API request bodies (already using Zod — enforce it on every route)

---

## Prioritized Execution Roadmap

| # | Item | Priority | Effort | Category |
|---|------|----------|--------|----------|
| 1 | CORS wildcard → allowlist | 🔴 | S | Security |
| 2 | Add ESLint + Prettier + husky | 🔴 | S | Workflow |
| 3 | GitHub Actions CI pipeline | 🔴 | S | Workflow |
| 4 | README.md (root) | 🔴 | S | Workflow |
| 5 | npm audit + fix critical vulns | 🔴 | S | Security |
| 6 | Helmet.js security headers | 🟡 | S | Security |
| 7 | Centralize error handling | 🔴 | S | Code Quality |
| 8 | Strict TypeScript flags | 🔴 | S | Code Quality |
| 9 | Route integration tests | 🔴 | M | Testing |
| 10 | Service unit tests (top 5) | 🔴 | L | Testing |
| 11 | Postgres persistence (replace Maps) | 🔴 | L | Code Quality / Perf |
| 12 | Railway deployment config | 🟡 | S | Workflow |
| 13 | Redis caching for AI/TTS | 🟡 | M | Performance |
| 14 | Fal.ai webhook-based polling | 🔴 | M | Integrations |
| 15 | Outbound webhook system | 🔴 | M | Integrations |
| 16 | Multi-tenant workspace isolation | 🔴 | L | Features |
| 17 | Usage billing (Stripe) | 🔴 | L | Features |
| 18 | Content approval UI | 🟡 | M | Features |
| 19 | SSE streaming for long generations | 🟡 | M | Performance |
| 20 | Slack approval integration | 🟡 | S | Integrations |

---

## Quick Wins (Do These First — All < 1 Day)

1. `app.use(cors({ origin: allowedOrigins }))` — 5 minutes
2. `npm audit` + patch — 30 minutes
3. `app.use(helmet())` — 2 minutes
4. Root `README.md` — 2 hours
5. `.github/workflows/ci.yml` — 1 hour
6. ESLint + Prettier config — 1 hour
7. Coverage thresholds in `vitest.config.ts` — 5 minutes
8. `AppError` class + global error middleware — 2 hours

**Combined impact:** Secures the API, unblocks team onboarding, enforces quality gates — all before writing a single new feature.

---

## Open Questions for Next Planning Session

1. **Database target** — Postgres (Signal Studio Railway instance) or a new isolated NarrativeReactor DB?
2. **Multi-tenancy timeline** — Is this needed for the next customer or 6 months out?
3. **Billing model** — Per-generation credits, monthly seat pricing, or platform fee?
4. **Fal.ai Seedance costs** — What's current $ per video? Cache hit rate could justify Redis investment.
5. **Who owns approvals?** — Is the approval workflow Signal Studio advisor-facing or ForwardLane internal?

---

*Next step: Run `/workflows:plan` on the Quick Wins batch to get implementation steps.*
