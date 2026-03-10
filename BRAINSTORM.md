# NarrativeReactor — Brainstorm & Prioritized Backlog

> Refreshed: 2026-03-10 (Judge Agent v2 — Brainstorming Pass)
> State: 80+ TS files · 35 services · 287 tests · GitHub Actions CI · Docker+Railway · OpenAPI · React dashboard · Multi-tenant Stripe billing
> Scores: revenue=8 · strategic=8 · completeness=8 · urgency=7 · effort_remaining=7

---

## 🔍 Key Findings vs Prior Audit (March 5 → March 10 Delta)

| Issue | Prior Audit | Current Reality |
|-------|------------|-----------------|
| JWT missing `exp` claim | ❌ CRITICAL | ✅ FIXED — jwt.ts has `expiresInSeconds=86400` default |
| SQLite DB singleton | ❌ Missing | ✅ DONE — src/lib/db.ts is a WAL singleton |
| E2E tests | ❌ Missing | ⚠️ EXISTS but mocked (src/__tests__/e2e/integration.test.ts — not real HTTP) |
| Stripe billing | ❌ TODO | ✅ DONE — full checkout/portal/webhook/quota enforcement |
| Tenant auth + quota | ❌ TODO | ✅ DONE — smartAuth + quotaGuard middleware |
| SHA-256 API key hashing | ❌ CRITICAL | ❌ STILL CRITICAL — tenants.ts line 131 |
| helmet middleware | ❌ Missing | ❌ STILL MISSING — not in src/index.ts |
| pino logger | ❌ Missing | ❌ STILL MISSING — 18+ console.log in services |
| Wildcard genkit deps | ❌ RISK | ❌ STILL RISK — 6 packages at `*` version |
| ESLint in root | ❌ Missing | ❌ STILL MISSING — only in /dashboard |
| **NEW**: `better-sqlite3` in tenants.ts | — | ❌ BUG: tenants.ts uses `better-sqlite3` directly, bypasses db.ts singleton |
| **NEW**: `@types/better-sqlite3` in dependencies | — | ❌ BUG: types package in prod `dependencies`, should be `devDependencies` |

---

## 1. New Features (Revenue/Value)

### 🔥 HIGH PRIORITY — Closest to shipping

**Content Repurposing Pipeline** (effort: 1.5d, impact: HIGH)
- One-click: blog post → Twitter thread → LinkedIn post → newsletter snippet
- Feed into existing Blotato publisher for scheduling
- Services to add: `contentRepurposing.ts` calling existing AI flows
- Revenue: Direct upsell feature for Pro+ plans

**Template Marketplace** (effort: 3d, impact: HIGH)
- Let users save/share content templates (blog, newsletter, social)
- Per-template monetization — premium templates unlock at Pro tier
- Simple CRUD: `videoTemplates.ts` already exists as scaffold

**API Key Rotation UI** (effort: 1d, impact: MEDIUM)
- `/api/tenants/:id/rotate-key` already exists in billing routes!
- Just need React dashboard UI and documentation
- Zero-downtime: new key issued, 24h grace period on old key

**Engagement Performance Dashboard** (effort: 2d, impact: MEDIUM)
- `performanceTracker.ts` already exists
- Wire Blotato webhook → engagement data → dashboard charts
- Shows ROI to tenant → drives upgrade conversions

### 📈 MEDIUM PRIORITY

**Slack Notification Integration** (effort: 1d)
- Notify team on content approval/rejection, failed publishes
- Uses existing approval workflow + publisher events
- High UX value for team plans (Enterprise tier upsell)

**Content A/B Testing** (effort: 3d)
- Generate 2 variants of same content
- Track which performs better via engagement webhooks
- Auto-learn: prefer winning variant style in future generation

**Webhook Trigger Engine** (effort: 2d)
- External events (RSS feeds, news API) trigger content generation
- `trendpilotBridge.ts` is scaffolded but has no confirmed route consumer — wire it up
- Zapier/Make.com integration via standard webhook format

---

## 2. Code Quality

### 🔴 CRITICAL BUG: `tenants.ts` bypasses DB singleton

```typescript
// src/services/tenants.ts — line 6 CURRENT (broken)
import Database from 'better-sqlite3';
// Creates its OWN DB connection — not the WAL singleton from db.ts!

// SHOULD BE:
import { getDb } from '../lib/db';
```

**Risk**: Two concurrent DB connections in WAL mode can cause lock contention. The billing path (quota enforcement on every API request) uses a different SQLite connection than all other services. Fix: migrate tenants.ts to use `getDb()` singleton.

### 🟡 MEDIUM Issues

**`@types/better-sqlite3` in prod `dependencies`** — should be in `devDependencies`
- Currently wastes prod Docker image space
- Fix: move in package.json

**Dead dependency: `better-sqlite3`** — once tenants.ts is migrated to `node:sqlite` / db.ts singleton, `better-sqlite3` can be removed entirely
- Eliminates one native module dependency (simpler builds)

**console.log in production services** (18 instances)
- `src/services/`: campaignIntelligence, scheduler, contentPipeline, trendpilotBridge, etc.
- Should use structured logger with log levels

**Unreachable service: `trendpilotBridge.ts`**
- No confirmed route in index.ts or routes/
- Either wire it up or remove it

**DRY: Repeated error catch pattern** across 8+ services
```typescript
} catch (err) {
  console.error('Failed to X', err);
  res.status(500).json({ error: 'Internal server error' });
}
```
→ Should use `asyncHandler` wrapper + `globalErrorHandler` already in place

**Missing Zod validation on some routes**
- POST endpoints in apiRoutes should validate body via zod schemas
- Several services accept `any` typed inputs

---

## 3. Testing

### Current Coverage
- 287 tests, all passing
- Coverage ~83% statements, ~86% branches
- ISSUE: `src/__tests__/e2e/integration.test.ts` (391 lines) uses `vi.mock` everywhere — it's a unit test that mocks the entire Express app, NOT a true HTTP integration test

### Missing Test Suites

**True HTTP E2E tests with `supertest`** (effort: 2d, P1)
```typescript
// Example of what's needed:
import request from 'supertest';
import { app } from '../../index';

describe('POST /api/pipeline/generate', () => {
  it('returns 401 without API key', async () => {
    const res = await request(app).post('/api/pipeline/generate').send({});
    expect(res.status).toBe(401);
  });
});
```

**Stripe webhook signature tests** (effort: 1d)
- Test valid/invalid/replayed webhook signatures
- Test each webhook event type (subscription created/updated/deleted)

**Rate limiting tests** (effort: 0.5d)
- Verify 100-req/15min enforced correctly under load

**Quota enforcement tests** (effort: 0.5d)
- Create tenant at limit → verify 429 response with quota details
- Test quota reset logic

**Load tests** (effort: 1d)
- Use `autocannon` or `k6` to verify performance under concurrent load
- Target: 50 concurrent users, <200ms p95 for non-AI endpoints

---

## 4. Integrations

### High Value
- **LinkedIn Direct Publishing** — via LinkedIn v2 API (currently only via Blotato)
- **YouTube upload** — post-production video upload from Fal.ai output
- **Google Analytics 4** — track post-publish content performance
- **Notion sync** — content library → Notion database for editorial review

### Medium Value
- **HubSpot CRM** — create/update contacts when content converts
- **Mailchimp** — direct newsletter publish (bypass Blotato for email content)
- **Canva** — branded image generation alongside text content

---

## 5. Workflows (CI/CD)

### Improvements

1. **ESLint in project root** — currently only in `/dashboard` (effort: 1h)
   ```bash
   npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
   ```

2. **Pre-commit hooks** — husky + lint-staged (effort: 1h)
   ```json
   { "lint-staged": { "*.ts": ["eslint --fix", "tsc --noEmit"] } }
   ```

3. **Renovate bot** — weekly dependency updates (effort: 2h setup)
   - Resolves wildcard genkit deps permanently
   - Config: `.github/renovate.json`

4. **PR preview environments** — Railway preview deploys on PRs (effort: 2h)

5. **Semantic-release** — auto-changelog + version bumps on merge to main (effort: 3h)

6. **Coverage ratchet** — CI fails if coverage drops below 83% (already configured in vitest, verify CI enforces it)

---

## 6. Performance

### 🔴 HIGH Impact

**No response caching for AI generation** ($$$)
- Every identical prompt+brand hits AI APIs at full cost
- Fix: LRU cache keyed on `hash(prompt + brandId)`, 5min TTL
- File: `src/flows/content-generation.ts`
- Savings: 30-50% AI API cost reduction in production

**Synchronous video generation blocks HTTP thread**
- Video jobs take 30-120s and block the request thread
- Fix: SQLite-backed job queue + polling endpoint
- New file: `src/services/videoQueue.ts`

### 🟡 MEDIUM Impact

**Missing SQLite indexes on hot columns**
- `content_drafts`: no index on `brand_id`, `created_at`
- `schedules`: no index on `scheduled_at`, `status`
- `campaigns`: no index on `brand_id`, `phase`
- `tenants`: no index on `api_key_hash` (CRITICAL — called on every API request!)

**No pagination on list endpoints**
- `/api/content`, `/api/campaigns`, `/api/schedules` return ALL rows
- Fix: add `?page=1&limit=50` pagination middleware

**Full lodash import** — ~70KB unnecessary
- Only `_.merge` used in contentPipeline.ts
- Fix: `import merge from 'lodash/merge'`

---

## 7. Security

### 🔴 CRITICAL

**SHA-256 for API key hashing** — `src/services/tenants.ts` line 131
```typescript
// CURRENT (INSECURE):
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// SHOULD BE (scrypt — brute-force resistant):
export async function hashApiKey(rawKey: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(rawKey, salt, 64, (err, derived) => err ? reject(err) : resolve(derived));
  });
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
```
Risk: SHA-256 is fast — an attacker with DB access can brute-force API keys offline. scrypt adds memory hardness.

**No helmet middleware** — `src/index.ts`
```typescript
// Add after imports:
import helmet from 'helmet';
app.use(helmet()); // CSP, HSTS, X-Frame-Options, X-Content-Type-Options
```

### 🟡 MEDIUM

**No API key rotation mechanism** — `/api/tenants/:id/rotate-key` route exists, but no grace period for old key
- Fix: store `api_key_hash_previous` + `key_rotated_at`; accept old key for 24h after rotation

**No request audit log** — no record of which tenant called what API when
- Fix: middleware that logs to `request_audit` SQLite table
- Essential for debugging, fraud detection, usage disputes

**No webhook signature rotation** — STRIPE_WEBHOOK_SECRET is a single static value
- Acceptable now, but add rotation documentation

**SQL injection audit needed** — tenants.ts uses parameterized queries correctly, but verify all services do

---

## Priority Matrix (Updated)

| Item | Impact | Effort | Priority | Status |
|------|--------|--------|----------|--------|
| SHA-256 → scrypt API key hashing | 🔴 CRITICAL Security | 2h | P0 | ❌ Open |
| helmet middleware | 🔴 Security | 30m | P0 | ❌ Open |
| Fix tenants.ts DB singleton (better-sqlite3 → db.ts) | 🔴 Stability | 2h | P0 | ❌ Open |
| Index on `api_key_hash` column | 🔴 Performance | 30m | P0 | ❌ Open |
| Pin wildcard genkit deps | 🟡 Stability | 30m | P0 | ❌ Open |
| ESLint config in root | 🟡 DX | 1h | P1 | ❌ Open |
| pino structured logger | 🟡 Ops | 2h | P1 | ❌ Open |
| SQLite indexes (brand_id, status, etc.) | 🟡 Perf | 1h | P1 | ❌ Open |
| True supertest E2E tests | 🟡 Quality | 2d | P1 | ❌ Open |
| Content repurposing pipeline | 🟠 Revenue | 1.5d | P1 | ❌ Open |
| LRU cache for content gen | 🟡 Cost | 2h | P2 | ❌ Open |
| Video job queue | 🟡 Perf | 1d | P2 | ❌ Open |
| Pagination middleware | 🟡 Perf | 3h | P2 | ❌ Open |
| Request audit log | 🟢 Security | 2h | P2 | ❌ Open |
| Pre-commit hooks | 🟢 DX | 1h | P2 | ❌ Open |
| Slack notifications | 🟢 UX | 1d | P3 | ❌ Open |
| Wire trendpilotBridge or remove it | 🟢 Quality | 3h | P3 | ❌ Open |
| Webhook engagement feedback loop | 🟢 Stickiness | 2d | P3 | ❌ Open |
