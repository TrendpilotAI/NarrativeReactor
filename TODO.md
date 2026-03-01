# NarrativeReactor — TODO

## ✅ Completed

### Security Hardening Sprint (2026-02-27 → 2026-03-01)
- [x] **Health endpoint** — `GET /health` exempt from auth
- [x] **Production guard** — `guardDestructive()` blocks destructive ops in prod
- [x] **Fail-closed auth** — API rejects all requests when API_KEY unset in production
- [x] **CORS hardening** — wildcard `*` replaced with env-configurable allowlist (CORS_ALLOWED_ORIGINS)
- [x] **In-memory persistence** — SQLite (node:sqlite) replaces all in-memory Maps/arrays
- [x] **Token encryption** — AES-256-GCM at-rest encryption for OAuth tokens (TOKEN_ENCRYPTION_KEY)
- [x] **Scheduler worker** — polls every 60s, auto-publishes due posts
- [x] **Dashboard auth** — JWT cookie sessions, DASHBOARD_PASSWORD, login/logout flow
- [x] **Sentry error monitoring** — zero-dep HTTP reporter, sensitive data scrubbing
- [x] **OpenAPI/Swagger** — full spec at /docs/openapi.json, Swagger UI at /docs
- [x] **README** — comprehensive project documentation
- [x] **Docker + Railway** — multi-stage Dockerfile, railway.json, healthcheck
- [x] **Tests** — 26 files, 287 tests, all passing

### Test Coverage
- 10 health/guard tests
- 6 auth middleware tests
- 19 JWT + dashboard auth tests
- 6 error reporter tests
- 7 OpenAPI spec tests
- 13 token encryption tests
- 3 scheduler worker tests
- 8 social providers tests
- 18 multi-brand tests
- ...and 197 more across content gen, flows, services, compliance, etc.

## 🔲 Open Items

- [ ] Coverage measurement (npm test --coverage) — target ≥70%
- [ ] Web UI auth integration (wire React dashboard login to /login endpoint)
- [ ] Set up CI pipeline (GitHub Actions) to run `npm run test:ci` on PRs
- [ ] Add supertest-based E2E tests for the full Express app
- [ ] Add `/api/health` alias for load balancer compatibility
