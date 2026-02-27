# NarrativeReactor — TODO

## ✅ Completed

### Health Guardrails (2026-02-27)
- [x] **Health endpoint** — `GET /health` returns `{status:"ok", service:"NarrativeReactor", timestamp:<ISO>}` — already in `src/index.ts`, exempt from auth
- [x] **Production guard** — `src/lib/productionGuard.ts` with `guardDestructive()` / `isProduction()` helpers
- [x] **Admin wipe route** — `POST /api/admin/wipe` wired with production guard (403 in prod, 200 in dev)
- [x] **Tests** — 10 new tests in `src/__tests__/health-and-guards.test.ts` (all passing)
  - Health endpoint 200 + shape check
  - Health endpoint unaffected by auth middleware
  - `guardDestructive()` throws `ProductionGuardError` in production
  - `guardDestructive()` no-ops in development/test
  - Error message includes operation name
  - `isProduction()` returns correct boolean
  - `/api/admin/wipe` returns 403 in production
  - `/api/admin/wipe` returns 200 in development
- [x] **TDD_PLAN.md** — marked completed items with ✅ section appended

## 🔲 Open Items

- [ ] Add supertest-based E2E tests for the full Express app (requires mocking heavy deps)
- [ ] Add production guard to any future batch-delete / data-purge endpoints
- [ ] Set up CI pipeline to run `npm run test:ci` on PRs
- [ ] Consider adding `/api/health` alias (some load balancers prefer that path)
