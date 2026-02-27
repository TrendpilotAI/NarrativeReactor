# NarrativeReactor — Execution Plan

**Created:** 2026-02-27  
**Status:** Active  
**Scope:** Deployment hardening, auth, testing, caching, CI/CD, publisher consolidation

---

## Architecture Overview

NarrativeReactor is a TypeScript/Express/Genkit AI content generation platform with:

```
┌──────────────────────────────────────────────────────────────┐
│                     Current Architecture                      │
├──────────────────────────────────────────────────────────────┤
│  Express API (port 3401)                                      │
│    ├── Middleware: CORS, rate-limit, apiKeyAuth (single key)  │
│    ├── Routes: /api, /api/pipeline, /webhooks                 │
│    └── Static: /public (dashboard)                           │
│                                                               │
│  Genkit Flows (4)                                             │
│    ├── content-generation  ← main LLM flow                   │
│    ├── orchestration       ← video + agentic chat             │
│    ├── integrations        ← social platform publish          │
│    └── compliance          ← brand compliance checks          │
│                                                               │
│  Services (32)                                                │
│    ├── Publishers: blotatoPublisher, publisher (overlap!)     │
│    ├── Media: tts, videoStitcher, thumbnailGenerator          │
│    ├── Brand: brandManager, brandVoice, brandScorer           │
│    ├── Social: postingScheduler, performanceTracker           │
│    └── AI: contentPipeline, costTracker, captionGenerator     │
│                                                               │
│  LLM Backends                                                 │
│    ├── Gemini (Google AI / Vertex AI)                         │
│    ├── Claude (Anthropic)                                     │
│    └── Fal.ai (image/video gen)                               │
│                                                               │
│  Infrastructure (MISSING)                                     │
│    ├── ❌ No Docker / container config                        │
│    ├── ❌ No CI/CD pipeline                                   │
│    ├── ❌ No Redis caching                                    │
│    ├── ❌ No structured logging                               │
│    ├── ❌ No env validation                                   │
│    └── ⚠️  Weak auth (single key, bypass if unset)           │
└──────────────────────────────────────────────────────────────┘
```

### Proposed Target Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Target Architecture                      │
├──────────────────────────────────────────────────────────────┤
│  GitHub Actions CI/CD                                         │
│    ├── PR gate: lint → typecheck → test                       │
│    ├── Deploy: build Docker → push → Railway deploy           │
│    └── Nightly: npm audit + security scan                     │
│                                                               │
│  Docker Container (multi-stage, non-root)                     │
│    └── Railway / Cloud Run deployment                         │
│                                                               │
│  Express API (hardened)                                       │
│    ├── Env validation at startup (Zod)                        │
│    ├── Structured logging (pino + request IDs)                │
│    ├── Auth: API key OR JWT w/ scopes (fail-closed)           │
│    └── Rate limiting (existing, improved)                     │
│                                                               │
│  Redis Caching Layer                                          │
│    ├── Brand profiles (1hr TTL)                               │
│    ├── Trend data (30min TTL)                                 │
│    ├── Generated content (24hr TTL, keyed by input hash)      │
│    └── Social metrics (15min TTL)                             │
│                                                               │
│  Unified Publisher Service                                    │
│    ├── BlotatoAdapter                                         │
│    └── ExtensibleAdapter (Buffer, Later, etc.)                │
│                                                               │
│  Test Suite (70%+ coverage)                                   │
│    └── 10+ service test files                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Task Inventory

| TODO | Title | Priority | Effort | Status |
|------|-------|----------|--------|--------|
| 223 | Docker Deployment Hardening | high | 3–4h | pending |
| 224 | Auth Improvements (JWT + Scoped Keys) | **critical** | 4–5h | pending |
| 225 | Redis Caching Layer | high | 5–6h | pending |
| 226 | CI/CD GitHub Actions | high | 4–5h | pending |
| 227 | Publisher Service Consolidation | medium | 6–8h | pending |
| 228 | Test Coverage Expansion | high | 8–10h | pending |
| 229 | Env Config Validation | medium | 3–4h | pending |
| 230 | Observability — Structured Logging | medium | 4–5h | pending |

**Total estimated effort:** ~37–47 hours

---

## Dependency Graph

```
224 (Auth)
 └── 225 (Redis) ── 227 (Publisher)
 └── 228 (Tests)

229 (Env Validation)
 └── 230 (Logging)

223 (Docker)
 └── 226 (CI/CD)

(No cross-dependency between auth/env tracks)
```

### Detailed Dependencies

- **224 → 225**: Cache admin endpoints need scoped JWT auth
- **225 → 227**: Publisher consolidation uses cache for rate limiting
- **224 → 228**: Auth tests should be written as part of auth implementation
- **229 → 230**: Logger reads `LOG_LEVEL` from validated env
- **223 → 226**: CI/CD deploy workflow needs Docker image to build/push

---

## Recommended Execution Order

### Phase 1 — Foundation (Week 1) 
_No dependencies, can be parallelised_

1. **229** — Env validation (3–4h) — Fast wins, prevents silent failures
2. **224** — Auth hardening (4–5h) — Critical security fix, fail-closed

### Phase 2 — Infrastructure (Week 1–2)
_Depends on Phase 1_

3. **223** — Docker (3–4h) — Enables CI/CD deploy
4. **230** — Logging (4–5h) — Depends on 229 env validation

### Phase 3 — Reliability (Week 2)
_Depends on Phase 1_

5. **225** — Redis caching (5–6h) — Depends on 224 auth (for admin endpoints)
6. **226** — CI/CD pipeline (4–5h) — Depends on 223 Docker

### Phase 4 — Quality (Week 2–3)
_Depends on earlier phases_

7. **228** — Test expansion (8–10h) — Depends on 224 auth tests
8. **227** — Publisher consolidation (6–8h) — Depends on 225 caching

### Suggested Sprint Plan

| Day | Tasks | Agent |
|-----|-------|-------|
| 1 | 229 (env) + 224 (auth) | 2 parallel agents |
| 2 | 223 (docker) + 230 (logging) | 2 parallel agents |
| 3 | 225 (redis) + 226 (CI/CD) | 2 parallel agents |
| 4 | 228 (tests) | 1 agent |
| 5 | 227 (publisher) | 1 agent |

---

## Risk Assessment

### 🔴 High Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Auth bypass currently in production | HIGH | CRITICAL | 224 is first priority; auth disabled = app exposed |
| Missing env vars causing silent bugs | HIGH | HIGH | 229 startup validation catches this |
| LLM API costs unbounded (no cache) | MEDIUM | HIGH | 225 Redis cache with TTL reduces repeat calls |

### 🟡 Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Publisher refactor breaks integrations | MEDIUM | MEDIUM | Deprecate old files, don't delete; keep backward compat |
| Redis unavailable in production | LOW | MEDIUM | Cache lib has no-op fallback — app degrades gracefully |
| CI/CD deploy breaks prod | LOW | HIGH | Use Railway preview environments before prod |

### 🟢 Low Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Docker image too large | LOW | LOW | Multi-stage build + .dockerignore |
| Test coverage regression | LOW | LOW | Enforce thresholds in vitest config |
| Logging performance overhead | LOW | LOW | Pino is fastest Node.js logger; async transport |

---

## Success Metrics

After all 8 tasks complete:

- **Security:** Zero auth bypass paths; JWT scopes enforced on sensitive routes
- **Performance:** 60%+ cache hit rate on repeated content flows; LLM latency < 100ms for cached results
- **Reliability:** CI blocks deploys on test failure; Docker healthcheck auto-restarts unhealthy pods
- **Observability:** Every request has correlation ID; every LLM call logs cost + tokens
- **Quality:** 70%+ test coverage; all PRs require passing CI
- **Maintainability:** Single publisher interface; env vars documented and validated

---

## Notes

- Redis credentials available in TOOLS.md (Railway Redis, external proxy)
- Blotato API key: `blt_rcytWk1X4BNvUZ3l0cIWHg44AZP9v15RwhW2bd3TSfw=`
- Target deploy: Railway (preferred) or Firebase Cloud Run
- Genkit version should be pinned in package.json (avoid minor breakage)
