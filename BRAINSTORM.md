# NarrativeReactor — Brainstorm & Prioritized Backlog

> Generated: 2026-03-05 (Judge Agent v2 refresh)
> State: 40 TS source files · 32 services · 287 tests · GitHub Actions CI · Docker+Railway · OpenAPI · React dashboard
> Scores: revenue=8 · strategic=9 · completeness=8 · urgency=6 · effort_remaining=7

---

## 1. New Features (Revenue/Value)

### 🔥 HIGH PRIORITY

**Multi-tenant SaaS billing layer**
- Add per-tenant API key management with usage quotas
- Integrate Stripe for subscription billing (Starter/Pro/Enterprise)
- Add usage dashboard showing token consumption, cost per tenant
- Effort: 5 days | Impact: DIRECT REVENUE

**Content performance feedback loop**
- Track published post engagement (likes, clicks, shares) via Blotato webhooks
- Feed performance data back into AI prompts to improve future generation
- A/B test content variants automatically
- Effort: 3 days | Impact: HIGH (stickiness, upsell)

**Brand voice learning**
- Allow brands to upload past content; extract style fingerprint via Claude
- Auto-calibrate generation prompts to match brand voice precisely
- Effort: 2 days | Impact: HIGH (differentiation)

### 📈 MEDIUM PRIORITY

**Template marketplace**
- Let users create/share content templates (blog, newsletter, social)
- Monetize premium templates
- Effort: 4 days

**Webhook-driven auto-posting**
- Trigger content generation + immediate publish from external events (RSS feeds, news APIs)
- Effort: 2 days

**Content repurposing pipeline**
- One-click: blog post → Twitter thread → LinkedIn post → newsletter snippet
- Effort: 1.5 days

---

## 2. Code Quality

### Issues Found

- **console.log pollution** — 30+ `console.log` calls in production service files; should use structured logger (pino/winston)
- **No structured logging** — no log levels, no JSON output, no request correlation IDs
- **Missing SQLite indexes** — `content_library`, `campaigns`, `schedules` tables lack indexes on common query columns (`brand_id`, `created_at`, `status`)
- **Type safety gaps** — several services use `any` type; zod schemas exist but aren't consistently applied
- **Dead imports** — `lodash` imported in multiple services but often only used for 1-2 functions; should use tree-shakable alternatives
- **Error swallowing** — several catch blocks do `console.log(err)` without rethrowing or reporting to Sentry
- **Missing request validation** — some API routes accept body params without zod validation

### Recommendations

1. Add `pino` logger with request correlation IDs (2h effort)
2. Add SQLite indexes migration script (1h effort)
3. Audit and replace `any` types with proper interfaces (3h effort)
4. Replace full `lodash` import with specific imports or native equivalents (1h effort)
5. Standardize error handling: all catch blocks must call `captureException` (2h effort)
6. Add zod middleware for all POST routes (3h effort)

---

## 3. Testing

### Current State
- 287 tests, all passing
- Coverage: ~83% statements, ~86% branches
- Unit tests strong for: auth, JWT, encryption, health, OpenAPI
- Gaps: E2E/integration tests for full Express app

### Missing Test Suites

**Critical Gaps**
- `supertest`-based E2E tests for every API route group (effort: 2 days)
- Integration tests for Blotato publisher with mock HTTP server (effort: 1 day)
- Integration tests for Fal.ai video pipeline with fixtures (effort: 1 day)
- Scheduler worker integration tests (currently mocked, need real SQLite db tests)

**Nice to Have**
- Load tests with `autocannon` to verify rate limiting under pressure
- Contract tests for Genkit flow inputs/outputs
- Snapshot tests for OpenAPI spec (prevent accidental breaking changes)

---

## 4. Integrations

### High Value

- **Slack notifications** — notify team on content approval/rejection, failed publishes
- **Zapier/Make.com webhook triggers** — allow external automation to trigger content gen
- **Google Analytics 4** — track content performance post-publish
- **LinkedIn Direct Publishing** — currently only via Blotato; add direct API
- **YouTube** — video upload pipeline from generated videos
- **Notion** — sync content library to Notion database for editorial review

### Medium Value

- **HubSpot CRM** — create/update contacts when content converts
- **Mailchimp** — direct newsletter publish (bypass Blotato)
- **Canva** — generate branded images alongside text content

---

## 5. Workflows (CI/CD)

### Improvements

1. **Pre-commit hooks** — husky + lint-staged: run `tsc --noEmit` + `eslint` on staged files
2. **PR preview environments** — Railway preview deployments on PRs
3. **Automated dependency updates** — Renovate bot for weekly dep bumps
4. **Code coverage enforcement** — fail CI if coverage drops below 83%
5. **Release automation** — semantic-release for auto-changelog + version bumps
6. **Staging environment** — separate Railway environment with sanitized test data
7. **Docker layer caching** — optimize Dockerfile for faster builds

---

## 6. Performance

### Issues

- **No response caching** — identical content generation requests (same prompt+brand) hit AI APIs every time; add Redis/in-memory cache with 5m TTL
- **Synchronous video pipeline** — video generation blocks HTTP response; should queue and return job ID
- **Missing DB connection pooling** — SQLite connection opened per-request in some services
- **Large bundle** — all services loaded at startup; consider lazy-loading for infrequently used services
- **No pagination** — content library, campaigns endpoints return all records; could be slow with large datasets

### Recommendations

1. Add in-memory LRU cache for content generation (same prompt within 5min) — 2h
2. Add job queue for video generation (Bull/BullMQ or simple SQLite queue) — 1 day
3. Add pagination middleware for list endpoints — 3h
4. Add SQLite WAL mode for better concurrent read performance — 30min

---

## 7. Security

### Current Strengths
- AES-256-GCM token encryption ✅
- JWT dashboard sessions ✅
- API key auth on all /api/* routes ✅
- CORS allowlist ✅
- Rate limiting ✅
- Production environment guards ✅
- Sentry error monitoring (sensitive data scrubbing) ✅

### Remaining Gaps

1. **No API key rotation** — single API_KEY env var; no mechanism to rotate without downtime
2. **No request signing for webhooks** — verify webhook payload signatures more robustly
3. **Missing CSP headers** — Content-Security-Policy not set on dashboard routes
4. **SQL injection risk** — some SQLite queries use string interpolation; should use parameterized queries consistently
5. **No audit log** — no record of who called what API when
6. **Session timeout** — dashboard JWT sessions don't expire (no `exp` claim)

### Recommendations

1. Add `helmet` middleware for security headers (CSP, HSTS, X-Frame-Options) — 1h
2. Add `exp` claim to JWT sessions (8h default) — 30min
3. Audit all SQLite queries for parameterization — 2h
4. Add API key versioning (key_v1, key_v2) for zero-downtime rotation — 1 day
5. Add request audit log to SQLite — 2h

---

## Priority Matrix

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| Multi-tenant billing | 🔴 Revenue | 5d | P0 |
| helmet + CSP headers | 🔴 Security | 1h | P0 |
| JWT session expiry | 🔴 Security | 30m | P0 |
| Structured logging (pino) | 🟡 Quality | 2h | P1 |
| SQLite indexes | 🟡 Performance | 1h | P1 |
| E2E tests (supertest) | 🟡 Quality | 2d | P1 |
| Content repurposing pipeline | 🟠 Revenue | 1.5d | P1 |
| Response caching | 🟡 Performance | 2h | P2 |
| Video job queue | 🟡 Performance | 1d | P2 |
| Slack notifications | 🟢 UX | 1d | P2 |
| Pre-commit hooks | 🟢 DX | 2h | P2 |
