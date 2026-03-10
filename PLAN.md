# NarrativeReactor — Execution Plan

> Refreshed: 2026-03-10 (Judge Agent v2)
> Scores: revenue=8 · strategic=8 · completeness=8 · urgency=7 · effort_remaining=7

---

## Current State Assessment

```
COMPLETED (last 3 sprints):
  ✅ Multi-tenant Stripe billing (checkout/portal/webhooks/quota)
  ✅ SQLite singleton (db.ts, WAL mode)
  ✅ JWT sessions with exp claim (24h default)
  ✅ React dashboard auth (login/logout/session)
  ✅ GitHub Actions CI (typecheck + test + docker-build)
  ✅ Docker + Railway deployment
  ✅ OpenAPI/Swagger docs at /docs
  ✅ Sentry error monitoring
  ✅ Rate limiting (express-rate-limit)
  ✅ AES-256-GCM token encryption
  ✅ 287 tests passing

STILL OPEN (critical):
  ❌ SHA-256 API key hashing (→ scrypt)
  ❌ helmet middleware (security headers)
  ❌ tenants.ts bypasses db.ts singleton (uses better-sqlite3 directly)
  ❌ Wildcard genkit dependencies (breaking change risk)
  ❌ No ESLint in project root
  ❌ No pino logger (console.log in production)
  ❌ No SQLite indexes on hot columns
  ❌ No true HTTP E2E tests (only mocked unit tests)
  ❌ No content generation caching
  ❌ Synchronous video generation (blocks HTTP thread)
```

---

## Architecture Overview

```
Current:
  Express → [cors] → [rate-limit] → [apiKeyAuth | smartAuth] → Routes
         → SQLite (two connections! db.ts + tenants.ts own connection)
         → Genkit Flows → AI APIs (no caching)
         → Blotato → Social Platforms
         → Fal.ai → Video (synchronous, blocking)

Proposed (after this plan):
  Express → [helmet] → [cors] → [rate-limit] → [smartAuth (scrypt verify)] → Routes
         → SQLite (single WAL singleton — all services use getDb())
         → Genkit Flows → [LRU cache 5min] → AI APIs
         → Blotato → Social Platforms
         → Video Job Queue → Worker (async polling)
         → pino structured logger → stdout (Railway log drain)
```

---

## Dependency Graph

```
TODO-880 (DB singleton fix — tenants.ts → db.ts)
  └─ TODO-878 (scrypt hashing — needs db.ts migration for api_key_hash_v2)
  └─ TODO-883 (supertest E2E — needs clean DB isolation via db.ts)
  └─ TODO-885 (video queue — needs video_jobs table in db.ts)

TODO-879 (helmet) — standalone, 30min
TODO-881 (pin genkit deps) — standalone, 30min
TODO-882 (ESLint root) — standalone, 1h

TODO-883 (supertest E2E) — after TODO-880
TODO-884 (LRU content cache) — standalone
TODO-885 (video job queue) — after TODO-880
```

---

## Recommended Execution Order

### Sprint 1 — Security & Stability Foundation (Day 1-2)

| TODO | Task | Effort | Blocked By |
|------|------|--------|-----------|
| 881 | Pin wildcard genkit deps | 30m | None |
| 879 | helmet middleware | 30m | None |
| 880 | Fix tenants.ts → db.ts singleton | 2h | None |
| 878 | scrypt API key hashing + migration | 3h | 880 |
| 882 | ESLint root config | 1h | None |

### Sprint 2 — Quality & Coverage (Day 3-5)

| TODO | Task | Effort | Blocked By |
|------|------|--------|-----------|
| 599 | pino structured logger | 2h | None |
| 600 | SQLite indexes migration | 1h | 880 |
| 883 | True supertest E2E tests | 2d | 880 |
| 602 | Content repurposing pipeline | 1.5d | None |

### Sprint 3 — Performance (Day 6-8)

| TODO | Task | Effort | Blocked By |
|------|------|--------|-----------|
| 884 | LRU cache for content generation | 2h | None |
| 885 | Async video job queue | 1d | 880 |
| 603 | Pagination middleware | 3h | None |

### Sprint 4 — Revenue Features (Day 9+)

| TODO | Task | Effort | Blocked By |
|------|------|--------|-----------|
| 631 | Content performance feedback loop | 3d | None |
| API key rotation UI | 1d | None |
| Slack notifications | 1d | None |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| scrypt migration breaks existing API keys | Medium | High | Keep SHA-256 verify as fallback; rehash on login |
| tenants.ts migration causes data loss | Low | High | Test with copy of DB; run full test suite |
| Genkit wildcard dep breaks on next install | High | Medium | Pin immediately (30min task) |
| E2E tests conflict with production DB | Medium | Medium | Use `DATABASE_PATH=:memory:` for tests |
| LRU cache returns stale content | Low | Low | Short TTL (5min), invalidate on brand update |
| Video queue worker memory leak | Low | Medium | Limit concurrent jobs; add health check |

---

## Open TODO Status

### P0 (Critical — do immediately)
- 878: scrypt API key hashing ❌
- 879: helmet middleware ❌  
- 880: tenants.ts DB singleton fix ❌
- 881: pin genkit deps ❌

### P1 (High — this sprint)
- 597: JWT session expiry ✅ ALREADY DONE (jwt.ts has exp=86400)
- 599: pino logging ❌
- 600: SQLite indexes ❌
- 601 → 883: True supertest E2E ❌
- 602: content repurposing ❌
- 632: DB singleton ✅ ALREADY DONE (db.ts is singleton)
- 882: ESLint root config ❌

### P2 (Medium — next sprint)
- 603: LRU cache → 884 ❌
- 604: pin genkit deps → 881 ❌
- 633 → 885: video job queue ❌
- 631: engagement feedback loop ❌

### Completed (from prior plan)
- ✅ 630: Stripe billing layer
- ✅ 322: Web UI auth
- ✅ 321: Sentry error monitoring
- ✅ 320: Test coverage
- ✅ 318: OpenAPI/Swagger
- ✅ 354: GitHub Actions CI
- ✅ JWT exp claim (was in AUDIT as open but already implemented)
- ✅ SQLite DB singleton (was in TODO-632 but already implemented in db.ts)
