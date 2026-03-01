# NarrativeReactor — Code Quality Audit

**Generated:** 2026-02-28  
**Auditor:** Honey (automated sub-agent)  
**Scope:** `src/` TypeScript source, `package.json`, test suite

---

## Executive Summary

| Category | Severity | Issues Found |
|---|---|---|
| Dead Code / Unused Imports | Medium | 6 |
| DRY Violations | High | 4 |
| Security Issues | High | 3 |
| Dependency Health | Low | 0 CVEs, 1 build error |
| Test Coverage | High | 31 of 33 services untested |
| Performance Bottlenecks | Medium | 3 |

---

## 1. Dead Code / Unused Imports

### 1.1 `getContentById` imported but never called
- **File:** `src/routes/index.ts`, line 22
- `getContentById` is imported from `../services/contentLibrary` but no route handler uses it.
- **Fix:** Remove from the import destructure.

### 1.2 Route-level shadow imports of competitorTracker, hashtagDiscovery, voiceCloner, videoStitcher, etc.
- **File:** `src/routes/index.ts`, lines 18–33
- `addCompetitor`, `getCompetitors`, `recordCompetitorPost`, `getCompetitorActivity`, `analyzeCompetitorStrategy`, `discoverHashtags`, `getRecommendedHashtags`, `getHashtagPerformance` are imported *again* in `routes/index.ts` even though the exact same functions are already imported and fully wired in `src/api/index.ts`.  The `routes/index.ts` version registers duplicate route paths (see §2.1).
- **Fix:** Remove duplicate imports from `routes/index.ts` once duplicate routes are resolved.

### 1.3 `personalizeSchedule` re-exported but only used internally
- **File:** `src/services/postingScheduler.ts`, line 132
- `personalizeSchedule` is imported from `postingOptimizer` and immediately re-exported. No external consumer imports it from `postingScheduler`.
- **Fix:** Drop the re-export, or consolidate the two files.

### 1.4 Commented-out / placeholder body in `generateBriefFromTrend`
- **File:** `src/services/trendpilotBridge.ts`, line 36
- A comment says "In production, this would call a Genkit flow or LLM" followed by hand-crafted stub logic that is never replaced.
- **Fix:** Wire up a real Genkit flow call or mark explicitly as a feature stub with a TODO.

### 1.5 `debug-exports.js` at repo root
- **File:** `debug-exports.js`
- A loose debug/test script at the project root with no `package.json` reference. Likely leftover development artifact.
- **Fix:** Delete or move to `scripts/`.

### 1.6 Duplicate `vitest.config.ts` and `genkit.config.js` at repo root
- **Files:** `genkit.config.js` (root), `src/genkit.config.ts` (src)
- Root `genkit.config.js` appears to duplicate the TypeScript config inside `src/`. Only the `src/` version is imported by application code.
- **Fix:** Remove the root `genkit.config.js` or clarify which one is canonical.

---

## 2. DRY Violations (Duplicated Logic)

### 2.1 Full Brand CRUD route set duplicated across two routers
- **Files:** `src/routes/index.ts` (lines ~530–575) AND `src/api/index.ts` (lines ~200–270)
- Both files define **identical** route handlers for:
  - `GET /brands`
  - `GET /brands/:id`
  - `POST /brands`
  - `PUT /brands/:id`
  - `DELETE /brands/:id`
- Both routers are mounted under `/api` in `src/index.ts` (`app.use('/api', apiRoutes)` and potentially others), meaning the same path resolves twice with the first match winning — the second set is dead.
- **Fix:** Keep brand routes in only one router file (recommend `routes/index.ts` since it's the primary). Remove from `src/api/index.ts`.

### 2.2 Competitor Tracker routes duplicated
- **Files:** `src/routes/index.ts` (lines ~370–415) AND `src/api/index.ts` (lines ~35–80)
- Both register `GET /competitors`, `POST /competitors`, `POST /competitors/:id/posts`, `GET /competitors/:id/activity`, `GET /competitors/:id/strategy`.
- **Fix:** Same as 2.1 — consolidate to one file.

### 2.3 Hashtag routes duplicated
- **Files:** `src/routes/index.ts` (lines ~415–445) AND `src/api/index.ts` (lines ~80–110)
- `GET /hashtags`, `POST /hashtags/recommend`, `GET /hashtags/:tag/performance` appear in both.
- **Fix:** Consolidate.

### 2.4 Error-response pattern repeated ~120 times with no helper
- **Files:** `src/routes/index.ts`, `src/api/index.ts`, `src/routes/pipeline.ts`, `src/routes/webhooks.ts`
- Every route handler uses the same `try/catch` boilerplate:
  ```ts
  } catch (err: any) { res.status(500).json({ error: err.message }); }
  ```
- **Fix:** Extract a route-wrapper utility, e.g.:
  ```ts
  const handle = (fn: AsyncHandler) => async (req, res) => {
    try { await fn(req, res); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  };
  ```

---

## 3. Security Issues

### 3.1 CORS wildcard on main Express server (**HIGH**)
- **File:** `src/index.ts`, line 23
  ```ts
  app.use(cors({ origin: '*' }));
  ```
- Any origin can make credentialed requests to the API. Even with API-key auth, this is overly permissive for a production service.
- **Fix:** Restrict to known frontend origins via an environment variable:
  ```ts
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000' }));
  ```

### 3.2 CORS wildcard on Genkit flow server (**MEDIUM**)
- **File:** `src/index.ts`, lines 83–87
  ```ts
  startFlowServer({ ... cors: { origin: '*' } });
  ```
- The Genkit dev server is exposed with wildcard CORS. If port 3402 is reachable externally, flows are callable from any browser.
- **Fix:** Restrict to `localhost` or remove CORS entirely for the dev server; ensure port 3402 is not exposed in production firewall rules.

### 3.3 Hardcoded fallback Anthropic API key string (**MEDIUM**)
- **File:** `src/lib/claude.ts`, line 7
  ```ts
  apiKey: process.env.ANTHROPIC_API_KEY || 'mock-key',
  ```
- While `'mock-key'` is not a real key, the pattern will silently initialise the Anthropic client with an invalid key rather than throwing at startup. This masks misconfiguration.
- **Fix:** Remove the fallback entirely; let `validateEnv()` in `src/lib/env.ts` cover `ANTHROPIC_API_KEY` as a required variable (it currently only covers `API_KEY`).
  ```ts
  const REQUIRED_VARS = ['API_KEY', 'ANTHROPIC_API_KEY'];
  ```

---

## 4. Dependency Health

### 4.1 No known CVEs
- `npm audit` reports **zero vulnerabilities** across all installed packages. ✅

### 4.2 Wildcard versions for Genkit packages (**LOW**)
- **File:** `package.json`, multiple entries:
  ```json
  "@genkit-ai/dotprompt": "*",
  "@genkit-ai/firebase": "*",
  "@genkit-ai/google-genai": "*",
  "@genkit-ai/vertexai": "*",
  "genkit": "*",
  "genkitx-anthropic": "*"
  ```
- `"*"` pins no version whatsoever; a fresh `npm install` could pull in any breaking major release.
- **Fix:** Pin to explicit ranges (e.g. `"^1.27.0"`) consistent with the `@genkit-ai/express` pin already present.

### 4.3 `npm outdated` / `tsc --noEmit` fail with runtime error
- Running `npm outdated` and `npx tsc --noEmit` both crash with:
  ```
  Class extends value undefined is not a constructor or null
  ```
- This indicates at least one wildcard Genkit package installed with an incompatible version at the time of `npm install`.
- **Fix:** Pin Genkit versions and re-run `npm install`.

---

## 5. Test Coverage

### 5.1 Vast majority of service layer has zero tests

Coverage config requires **70% statement / 75% function** coverage over `src/lib/**` and `src/flows/**` only — `src/services/**` is **excluded from coverage requirements entirely**.

Of 32 service files, only **2 have test files**:

| Service | Test File |
|---|---|
| `services/audio` (tts) | `src/__tests__/services/audio.test.ts` ✅ |
| `services/contentPipeline` | `src/__tests__/services/contentPipeline.test.ts` ✅ |

**30 services with no test file:**
`agentComm`, `approvalWorkflow`, `audiencePersona`, `blotatoPublisher`, `brandManager`, `brandScorer`, `brandVoice`, `calendar`, `campaigns`, `captionGenerator`, `competitorTracker`, `contentLibrary`, `costTracker`, `dialogue`, `hashtagDiscovery`, `performanceTracker`, `personaBuilder`, `podcastGenerator`, `postingOptimizer`, `postingScheduler`, `publisher`, `strategyReport`, `subtitles`, `teamCollab`, `thumbnailGenerator`, `trendpilotBridge`, `tts` (duplicate of audio), `videoPredictor`, `videoStitcher`, `videoTemplates`, `voiceCloner`

### 5.2 Routes have no integration tests
- `src/routes/index.ts` and `src/api/index.ts` — which register ~120 endpoints combined — have no route-level tests.
- **Recommendation:** Add supertest-based integration tests for at least the critical paths: `/api/generate`, `/api/pipeline/generate`, `/api/brands`, `/api/video`.

### 5.3 Coverage excludes `src/services/**`
- **File:** `vitest.config.ts`, line 13
  ```ts
  include: ['src/lib/**', 'src/flows/**'],
  ```
- **Fix:** Expand coverage include to `src/**` and raise thresholds incrementally as tests are added.

---

## 6. Performance Bottlenecks

### 6.1 All data stores are in-memory with no persistence or indexing (**HIGH**)
- Multiple services use `Map` or plain arrays as their "database":
  - `src/services/videoStitcher.ts:42`: `const projects = new Map<string, VideoProject>()`
  - `src/services/campaigns.ts`, `competitorTracker.ts`, `contentLibrary.ts`, `approvalWorkflow.ts`, `teamCollab.ts`, etc. — all use module-level arrays/Maps
- These stores are **reset on every process restart**. There are no indexes, so lookups like `getCompetitorActivity(id, days)` perform full linear scans.
- **Fix (short term):** Add `Array.find` → `Map` lookups for ID-based access. **Fix (long term):** Replace with a persistent store (Firestore/Postgres already available per TOOLS.md).

### 6.2 Sequential awaits where parallel is possible in `contentPipeline.ts`
- **File:** `src/services/contentPipeline.ts` (multi-format draft generation)
- The pipeline calls AI generation for `xThread`, `linkedinPost`, and `blogArticle` sequentially rather than in parallel via `Promise.all`.
- **Fix:**
  ```ts
  const [xThread, linkedinPost, blogArticle] = await Promise.all([
    generateXThread(research),
    generateLinkedinPost(research),
    generateBlogArticle(research),
  ]);
  ```

### 6.3 `lodash` in `package.json` but unused in source (**LOW**)
- **File:** `package.json` — `"lodash": "^4.17.21"` and `"@types/lodash": "^4.17.23"` are listed as production dependencies.
- `grep -r "lodash" src/` returns no matches — lodash is never imported.
- This adds ~72 KB to the bundle for no benefit.
- **Fix:** Remove `lodash` and `@types/lodash` from `package.json`.

### 6.4 `console.log` debug output left in production code
- **File:** `src/lib/fal.ts`, line ~30
  ```ts
  console.log('[Fal.ai Debug] Image Result:', JSON.stringify(result, null, 2));
  ```
- Full JSON serialisation of large API responses on every generation call is expensive and leaks response data to logs.
- **Fix:** Wrap in `if (process.env.DEBUG)` or remove entirely.

---

## Recommended Fix Priority

| Priority | Item |
|---|---|
| 🔴 P0 | §3.1 — Restrict CORS origin in production |
| 🔴 P0 | §4.3 — Fix broken `npm install` (pin Genkit versions) |
| 🔴 P0 | §2.1–2.3 — Remove duplicate route registrations |
| 🟠 P1 | §3.3 — Remove `'mock-key'` Anthropic fallback, add to `validateEnv` |
| 🟠 P1 | §5.1 — Add unit tests for highest-risk services (campaigns, approvalWorkflow, calendar) |
| 🟡 P2 | §6.1 — Move to persistent data store |
| 🟡 P2 | §6.2 — Parallelise AI calls in contentPipeline |
| 🟡 P2 | §1.1–1.3 — Clean up dead imports |
| 🟢 P3 | §6.3 — Remove unused lodash dependency |
| 🟢 P3 | §6.4 — Remove debug `console.log` in fal.ts |
| 🟢 P3 | §4.2 — Pin Genkit wildcard versions |
