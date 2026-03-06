# NarrativeReactor — Execution Plan

> Refreshed: 2026-03-06 (Judge Agent v2)
> Scores: revenue=8 · strategic=9 · completeness=8 · urgency=6 · effort_remaining=7

---

## Architecture Overview of Proposed Changes

```
Current:
  Express → API Routes → 32 Services → SQLite (per-service connections)
                      → Genkit Flows → AI APIs (no caching)
                      → Blotato → Social Platforms

Proposed:
  Express → [helmet] → [tenant quota guard] → API Routes
         → Stripe Billing Layer → Tenant Management
         → Genkit Flows → [LRU cache] → AI APIs
         → Engagement Tracker ← Blotato webhooks
         → Video Job Queue → Background Worker → Fal.ai
         → src/lib/db.ts (singleton) → all services
```

---

## Dependency Graph

```
TODO-632 (DB singleton)
  └─ TODO-633 (video job queue) depends on 632
  └─ TODO-630 (billing) depends on 632

TODO-597 (JWT expiry) — standalone
TODO-598 (helmet) — standalone
TODO-599 (pino logging)
  └─ TODO-630 (billing) benefits from 599
  └─ TODO-631 (feedback loop) benefits from 599

TODO-600 (SQLite indexes) — merge into 632
TODO-601 (E2E supertest tests) — standalone
TODO-602 (content repurposing pipeline) — standalone
TODO-603 (LRU response cache) — standalone
TODO-604 (pin wildcard genkit deps) — standalone

TODO-630 (Stripe billing) — P0 revenue unlock
TODO-631 (performance feedback loop) — P1 stickiness
TODO-633 (video job queue) — P2 performance
```

---

## Recommended Execution Order

### Sprint 1 — Security & Foundation (Week 1)
| TODO | Task | Effort |
|------|------|--------|
| 597 | JWT session expiry (`exp` claim) | 30m |
| 598 | `helmet` middleware | 1h |
| 604 | Pin wildcard genkit deps | 30m |
| 632 | SQLite DB singleton + WAL + indexes | 2h |
| 599 | Pino structured logger | 2h |

### Sprint 2 — Quality & Coverage (Week 1-2)
| TODO | Task | Effort |
|------|------|--------|
| 601 | E2E supertest tests for all route groups | 2d |
| 602 | Content repurposing pipeline | 1.5d |
| 603 | LRU cache for content generation | 2h |

### Sprint 3 — Revenue & Performance (Week 2-3)
| TODO | Task | Effort |
|------|------|--------|
| 630 | Stripe multi-tenant billing layer | 5d |
| 633 | Async video job queue | 1d |
| 631 | Content performance feedback loop | 3d |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Stripe integration complexity | Medium | High | Use Stripe Checkout (hosted page) to reduce scope |
| SQLite singleton breaks services | Low | High | Run full test suite after TODO-632; canary deploy |
| Genkit wildcard dep breaking change | High | Medium | Pin immediately (TODO-604) before next npm install |
| Video queue SQLite lock contention | Low | Medium | Use WAL mode (included in TODO-632) |
| E2E tests flaky on CI | Medium | Low | Use test database fixture; reset between tests |

---

## Current TODO Status

### Open High-Priority Items
- 597: JWT expiry — P0 security
- 598: helmet headers — P0 security  
- 599: pino logging — P1
- 600: SQLite indexes — P1 (merge into 632)
- 601: E2E supertest tests — P1
- 602: content repurposing — P1
- 630: Stripe billing — **P0 revenue**
- 631: engagement feedback loop — P1
- 632: DB singleton — P1 foundation
- 633: video job queue — P2

### Completed (last sprint)
- ✅ GitHub Actions CI pipeline
- ✅ React dashboard auth
- ✅ Sentry error monitoring
- ✅ OpenAPI/Swagger docs
- ✅ Docker + Railway deployment
- ✅ JWT + CORS + rate limiting
- ✅ AES-256-GCM token encryption
- ✅ 287 tests passing
