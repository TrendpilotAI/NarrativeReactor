# NarrativeReactor — Code Quality Audit
_Refreshed by Judge Agent v2 | 2026-03-10_

## Summary
Core platform is solid. Multi-tenant billing, CI/CD, Docker+Railway, 287 tests, OpenAPI all in place. **Critical new finding**: `tenants.ts` uses `better-sqlite3` directly, bypassing the WAL singleton in `db.ts` — this can cause lock contention on every API auth call. SHA-256 API key hashing is a brute-force risk. No helmet middleware. Wildcard genkit deps are a breaking-change time bomb. JWT `exp` claim is correctly implemented (prior audit was wrong on this).

---

## 1. Dead Code / Unused Imports

### 🔴 HIGH — Unreachable Service

**`src/services/trendpilotBridge.ts`** — No route consumer found
```bash
grep -rn "trendpilotBridge\|TrendpilotBridge" src/index.ts src/routes/ src/flows/
# → 0 results
```
Either wire it up to a route or delete it.

### 🟡 MEDIUM — Redundant Dependency

**`better-sqlite3`** in `package.json` — only used in `tenants.ts`
- Once tenants.ts migrates to `db.ts` singleton (using `node:sqlite`), this can be removed entirely
- Eliminates native module, speeds up Docker builds, simplifies CI

**`@types/better-sqlite3`** in prod `dependencies` (should be `devDependencies`)
```json
// WRONG — in package.json:
"dependencies": {
  "@types/better-sqlite3": "^7.6.13",  // ← types in prod deps!
}
// CORRECT:
"devDependencies": {
  "@types/better-sqlite3": "^7.6.13",
}
```

### 🟢 LOW — Minor

**`lodash` full import** in `src/services/contentPipeline.ts`
```typescript
// Line 3: import _ from 'lodash';  // ~70KB
// Fix: import merge from 'lodash/merge';
```

---

## 2. DRY Violations

### 🔴 CRITICAL — Duplicate SQLite Connection in Billing Path

**`src/services/tenants.ts`** opens its own `better-sqlite3` connection:
```typescript
import Database from 'better-sqlite3';  // line 6
// vs src/lib/db.ts which exports getDb() using node:sqlite
```
This creates TWO concurrent SQLite connections:
1. `db.ts` singleton (WAL mode) — used by all content/campaign/scheduler services  
2. `tenants.ts` local connection (mode unknown) — used for every API auth check

**Fix**: Migrate `tenants.ts` to use `import { getDb } from '../lib/db'` and remove `better-sqlite3` import.

### 🟡 MEDIUM

**Repeated error catch pattern** across 8+ service files:
```typescript
} catch (err) {
  console.error('Failed to X', err);
  res.status(500).json({ error: 'Internal server error' });
}
```
→ Use `asyncHandler` wrapper utility or ensure all errors bubble to `globalErrorHandler`

**Manual auth header extraction** in some route handlers despite `apiKeyAuth` middleware existing

---

## 3. Security Issues

### 🔴 CRITICAL

**SHA-256 for API Key Hashing**
- File: `src/services/tenants.ts`, line 131–133
- Current:
  ```typescript
  export function hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
  ```
- SHA-256 is fast (billions of hashes/sec on GPU) → offline brute-force if DB leaked
- Fix: Replace with `crypto.scrypt()` (built-in, no new deps):
  ```typescript
  export async function hashApiKey(rawKey: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const hash = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(rawKey, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
        err ? reject(err) : resolve(key)
      );
    });
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }
  
  export async function verifyApiKey(rawKey: string, storedHash: string): Promise<boolean> {
    const [saltHex, hashHex] = storedHash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(rawKey, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
        err ? reject(err) : resolve(key)
      );
    });
    return crypto.timingSafeEqual(expected, actual);
  }
  ```
- Note: Migration needed — existing API keys were hashed with SHA-256. Strategy: rehash on next successful auth.

**No helmet middleware**
- File: `src/index.ts`
- No Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options
- Fix: `npm install helmet && app.use(helmet())` at line ~30 of index.ts
- 30min fix, significant XSS/clickjacking risk reduction

### 🟡 MEDIUM

**Missing SQLite index on `api_key_hash`**
- `tenants` table — `api_key_hash` column queried on EVERY API request
- No index = full table scan on auth check
- Fix in db.ts migration:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash ON tenants(api_key_hash);
  ```

**No request audit log**
- No record of which tenant called what endpoint when
- Risk: No forensic trail for abuse, fraud, or debugging
- Fix: Add `request_audit` table + middleware that logs tenant_id, endpoint, timestamp, response_code

**Wildcard genkit dep versions** — 6 packages at `*`:
```json
"genkit": "*",            // RISK: any major version on npm install
"@genkit-ai/vertexai": "*",
"@genkit-ai/google-genai": "*",
"@genkit-ai/firebase": "*",
"@genkit-ai/dotprompt": "*",
"genkitx-anthropic": "*",
```
- Fix: Run `npm ls genkit` to get current installed version, pin to that.

### 🟢 LOW

**DASHBOARD_PASSWORD in env as plaintext comparison**
- File: `src/middleware/dashboardAuth.ts`
- Acceptable for single-user dashboard, but worth documenting why bcrypt isn't used

---

## 4. Dependency Health

| Package | Version | Risk | Action |
|---------|---------|------|--------|
| `genkit` et al. | `*` (wildcard!) | 🔴 HIGH | Pin immediately |
| `express` | `^4.18.2` | 🟡 MEDIUM | Express 5 released, plan upgrade |
| `better-sqlite3` | `^12.6.2` | 🟡 MEDIUM | Remove after tenants.ts migration |
| `@types/better-sqlite3` | in `dependencies` | 🟡 MEDIUM | Move to devDependencies |
| `@anthropic-ai/sdk` | `^0.33.0` | 🟢 LOW | Check for latest (rapidly updated) |
| `firebase-admin` | `^12.0.0` | 🟢 LOW | Verify no security advisories |

**JWT Implementation Note**: jwt.ts correctly implements `exp` claim (24h default) and timing-safe comparison. Prior audit finding of "missing exp claim" was INCORRECT — this is RESOLVED.

---

## 5. Test Coverage Assessment

### Current State
- 287 tests across 26 test files, all passing
- Coverage: ~83% statements, ~86% branches

### ✅ Well Covered
- Health & guards: 10 tests
- Auth middleware: 6 tests  
- JWT + dashboard auth: 19 tests
- Error reporter: 6 tests
- OpenAPI spec: 7 tests
- Token encryption: 13 tests
- Scheduler worker: 3 tests
- Social providers: 8 tests
- Multi-brand: 18 tests
- Content gen flows: covered
- Billing service: covered

### ❌ Gaps

**True HTTP integration tests** (biggest gap)
- `src/__tests__/e2e/integration.test.ts` is a unit test using `vi.mock` — all Express handling is mocked
- Need `supertest`-based tests that spin up the full Express app and test actual HTTP responses
- File: `src/__tests__/e2e/http.test.ts` (new)

**Stripe webhook signature verification**
- No test for invalid/forged webhook payloads
- No test for replayed webhooks (timestamp check)

**Quota enforcement path**
- Need: create tenant at 100% quota → make API call → verify 429 with quota JSON

**Rate limit enforcement**
- No test that fires 101 requests and verifies 429 on the 101st

---

## 6. Performance Bottlenecks

### 🔴 HIGH

**No `api_key_hash` index** — called on EVERY API request, full table scan
- Tables likely small now, but will degrade as tenants grow
- Simple fix in schema migration

**No AI response caching**
- Every identical prompt hits AI API at full cost
- LRU cache (hash of prompt+brandId → response, 5min TTL)
- File: `src/flows/content-generation.ts` (add cache wrapper)
- Estimated savings: 30-50% API cost at scale

**Synchronous video generation**
- Fal.ai video generation takes 30-120s
- Currently blocks the HTTP response thread
- Fix: job queue + polling endpoint

### 🟡 MEDIUM

**Missing indexes on content/campaign tables**
- `content_drafts`: no index on `brand_id`, `created_at`
- `campaigns`: no index on `brand_id`, `phase`
- `schedules`: no index on `scheduled_at`, `status`

**No pagination on list endpoints**
- `/api/content`, `/api/campaigns`, `/api/schedules` return ALL rows with no limit

---

## Action Items Summary (Priority Order)

| Priority | Item | File | Effort | Status |
|----------|------|------|--------|--------|
| P0 | scrypt API key hashing + migration | `src/services/tenants.ts` | 3h | ❌ Open |
| P0 | helmet middleware | `src/index.ts` | 30m | ❌ Open |
| P0 | Fix tenants.ts → use db.ts singleton | `src/services/tenants.ts` | 2h | ❌ Open |
| P0 | Index on `api_key_hash` | `src/lib/db.ts` (migration) | 30m | ❌ Open |
| P0 | Pin wildcard genkit deps | `package.json` | 30m | ❌ Open |
| P1 | pino structured logger | `src/lib/logger.ts` (new) | 2h | ❌ Open |
| P1 | ESLint config for root | `eslint.config.js` (new) | 1h | ❌ Open |
| P1 | SQLite indexes (brand_id, status, etc.) | `src/lib/db.ts` (migration v2) | 1h | ❌ Open |
| P1 | True supertest E2E tests | `src/__tests__/e2e/http.test.ts` | 2d | ❌ Open |
| P1 | Move @types/better-sqlite3 to devDeps | `package.json` | 10m | ❌ Open |
| P2 | LRU cache for content generation | `src/flows/content-generation.ts` | 2h | ❌ Open |
| P2 | Video job queue | `src/services/videoQueue.ts` (new) | 1d | ❌ Open |
| P2 | Pagination middleware | `src/middleware/paginate.ts` (new) | 3h | ❌ Open |
| P2 | Request audit log | `src/middleware/audit.ts` (new) | 2h | ❌ Open |
| P2 | Remove trendpilotBridge or wire it | `src/services/trendpilotBridge.ts` | 1h | ❌ Open |
| P3 | Pre-commit hooks (husky) | `.husky/` (new) | 1h | ❌ Open |
| P3 | Renovate bot | `.github/renovate.json` (new) | 1h | ❌ Open |
