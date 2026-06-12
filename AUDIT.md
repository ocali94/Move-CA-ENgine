# Move CA Engine — Audit (Phase 1)

Date: 2026-06-11. Audited against `Move-CA-Engine-Overview.md` (product source of truth), the playbooks in `content/`, and the README (treated as claims, not truth).

## Build health

| Check | Result |
|---|---|
| `npm install` | Passes (npm audit reports vulnerabilities in transitive deps; none blocking) |
| `npm run lint` | Passes clean |
| `npm run build` | Passes clean (Next.js 16.2.9, Turbopack) |

The app compiles and boots. The problems are in what the code actually does, not whether it runs.

## Headline finding (BLOCKER)

**The LLM integration is a façade.** `generateWithLLM()` is called from exactly one place: `/api/llm/smoke-test`. Every one of the four modules generates its output with deterministic keyword matching and string templates:

- Lead Qualifier: `src/lib/workflows/lead-qualifier.ts` — keyword lists + point arithmetic.
- Call Prep: `src/lib/workflows/call-prep.ts` — keyword lists + canned questions.
- Proposal Studio: `src/lib/workflows/proposal.ts` — seven hardcoded section templates with a few interpolated facts. The "revision chat" matches `/short|warmer/` and otherwise appends `_Revision note: …_` to the text.
- Market Signals Campaign Signal: `src/lib/workflows/market.ts` — three canned angle sets selected by risk level.

The prompt files in `src/lib/prompts/` (proposal-section, lead-qualifier, call-prep, companion-email, discovery-extraction, section-revision, market-signal) are **dead code** — never imported by any route or workflow. The README's claim "Generated content uses deterministic fallback logic **unless an LLM key is configured**" is false: there is no LLM path to fall back from. Setting a key changes nothing except the smoke test.

This is the single biggest gap vs the overview doc ("uses AI where AI is actually useful: reading, scoring, drafting, and summarizing") and it would be exposed within seconds in a live demo: every brand pasted into Lead Qualifier returns near-identical boilerplate.

## Module-by-module

### 1. Lead Qualifier — verdict: REFACTOR

| Check | Result | Severity |
|---|---|---|
| Workflow end to end | Yes — form → POST `/api/lead-qualifier/analyze` → scored card, saved to localStorage | — |
| Calls LLM server-side | **No.** Pure keyword heuristics | Blocker |
| Fetches website server-side | **No.** URL field is only used to extract a brand name from the hostname. The UI placeholder even says "if website fetch is unavailable" — it is always unavailable | Major |
| Degrades visibly without key | No degradation concept exists; output never says it came from a heuristic | Major |
| Output matches spec | Shape matches (score, reasons, ICP checks, disqualifiers, hook, CRM summary) but content is generic; "personalization hook" is a fill-in-the-blank sentence, not a specific observation | Major |

Good bones: route validation (zod), result types, UI layout, localStorage history. Keep all of that; add the LLM path, the website fetch, and provenance labeling.

### 2. Call Prep — verdict: REFACTOR

| Check | Result | Severity |
|---|---|---|
| Workflow end to end | Yes — intake form → POST `/api/call-prep/generate` → battle card | — |
| Calls LLM server-side | **No** | Blocker |
| "Live scan of the brand's website" (overview claim) | **No fetch anywhere.** Website field only feeds hostname → company name | Major |
| Extracts website from pasted intake | No — separate field only | Minor |
| Degrades visibly | No provenance labeling | Major |
| Output matches spec | Sections all present (snapshot, pain map, 10 questions, service path, verify/avoid). Diagnostic questions are 10 static strings with one interpolated word — not "tailored" | Major |

### 3. Proposal Studio — verdict: REFACTOR (heavy)

| Check | Result | Severity |
|---|---|---|
| Workflow end to end | Yes — project → notes → extract → section-by-section generate/revise/approve/lock → unlock marks later sections for review → export MD/HTML → companion email. The approval state machine is genuinely implemented and worth keeping | — |
| Calls LLM | **No.** Sections are static templates; extraction is regex; revision chat is a sham | Blocker |
| Enforces proposal guide hard rules | **No validators of any kind.** Nothing checks pain bullet counts, table shapes, SLA columns, role names, pricing consistency, or Option 3 justification. Em-dash scrub exists (`withoutEmDash`) but only on generated section bodies | Major |
| Section structure matches overview | Partially. The overview promises "package options, transitional timeline table, recommendation, three-column SLA, scope pillars". Current templates have no package options table, no SLA table with KPI/Commitment/Metrics, and pillars without Objective/Approach/Expected Outcome. Note: `content/playbooks/move-proposal-rules.md` is a stub (section titles + lock rule only) — the full guide's rules exist only in the upgrade spec | Major |
| Companion email rules | Not enforced. Current subject is "{Client} proposal" (does **not** reference Move Supply Chain); no CTA count check; no banned-phrase check | Major |
| Export | HTML export converts only `#`, `##`, `-` and paragraphs — **markdown tables export as plain paragraph soup** | Major |
| Drive references | Google Picker integration (see Auth below) — dead weight | Major |

### 4. Market Signals — verdict: REFACTOR (best module; real data plumbing)

| Check | Result | Severity |
|---|---|---|
| Fetches real free APIs | **Partially real.** FRED CSV endpoint (`fredgraph.csv`) works today, no key needed — verified with curl (200, 13KB). Stooq (`stooq.com/q/d/l/?s=xly.us&i=m`) returns **404** — verified; the endpoint is dead | Blocker |
| Failure isolation | **None.** All six fetches run in one `Promise.all`, so the dead Stooq endpoint kills the entire live fetch on every refresh. Result: production shows "unavailable" forever (no cache is ever written); dev silently shows demo data | Blocker |
| Demo data labeled | Yes — `dataMode` badge ("demo values", "cached", "live") is shown. Good | — |
| Demand Pulse 0–100 composite | Yes — weighted normalized blend, history chart, drivers. Real math, keep it | — |
| Per-card "what it means" | Static per-series sentence, **not derived from the actual data direction** (e.g., Consumer Sentiment always says "lower reading means caution" even when rising) | Major |
| Campaign Signal 3 required blocks | No — has headline/summary/whatChanged/whatItMeansForDtc/channel angles. Missing the explicit "What Move should campaign on now" block; angle text is canned, only loosely tied to fetched numbers | Major |
| Invents numbers | No — only fetched values are referenced. Good | — |

### Auth / NextAuth + Drive Picker — verdict: REBUILD (replace, per upgrade spec)

| Check | Result | Severity |
|---|---|---|
| NextAuth v4 on Next 16 | Builds, but unverifiable at runtime without Google credentials, and NextAuth v4 predates Next 16's async-only `cookies()`/`headers()`. Could not confirm it works; it is removed in this upgrade regardless | Major |
| Route protection | **No middleware/proxy file exists.** Every API route individually calls `requireApiUser()`; dashboard layout calls `getCurrentUser()`. Works, but `DEV_AUTH_BYPASS` defaults to *on* in dev, and in production with no Google env vars the app is simply unusable (no login path) | Major |
| Google Drive Picker | Client-side script injection + `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` + Drive OAuth scopes requested at login. Never usable in this deployment (no OAuth configured). Three of four `/api/drive/*` routes are stubs returning static JSON | Major (dead weight) |
| `mammoth` dependency | In package.json, **never imported anywhere** | Minor (dead weight) |

### Branding / theme — REFACTOR

| Check | Result | Severity |
|---|---|---|
| Brand tokens | Wrong palette: app uses green `#55c86a`, navy `#071524`, coral `#ff7059`, plus off-brand blue `#78a7ff` and orange `#ffab38`. Spec: navy `#182454`, green `#3CA848`, coral `#F05448` | Major |
| Token usage | Hex values hardcoded in ~50+ places across TSX; CSS variables exist in globals.css but are barely used | Major |
| Light mode | **Cosmetically broken**: `.light .move-panel` keeps a dark navy panel (`rgba(12,31,52,.88)`) with white text on a light page background — "light mode" is dark cards on a light backdrop, and all text colors (`text-white`, `text-slate-300`) are hardcoded for dark | Major |
| Dark mode navy-based | Yes | — |
| Theme toggle persisted | Yes (localStorage), but applied in a `useEffect` → flash of wrong theme on load | Minor |
| Fake UI elements | Notification bell with hardcoded red dot, "Enterprise Plan" label — demo gloss that does nothing | Minor |

### Misc

- `src/app/setup/page.tsx` posts a bare HTML form to `/api/llm/smoke-test` — navigates the browser to raw JSON. Minor.
- Playwright smoke test exists (`tests/smoke.spec.ts`) but no test script in package.json. Minor.
- README describes Google OAuth/Drive/`DEV_AUTH_BYPASS` extensively — all to be rewritten in Phase 3.8. Major (docs vs reality).
- Next.js 16 notes for the rework: middleware is now `proxy.ts` (named export `proxy`, Node runtime); `cookies()`/`headers()`/`params`/`searchParams` are async-only; route handlers are uncached by default. Confirmed against `node_modules/next/dist/docs`.
- Replacement found for the dead Stooq source: Yahoo Finance chart API (`query1.finance.yahoo.com/v8/finance/chart/XLY`) — keyless, verified working with curl.

## Verdict summary

| Module | Verdict | Rationale |
|---|---|---|
| Lead Qualifier | REFACTOR | UI, route, types, storage all sound; swap the brain (LLM + fetch + fallback labeling) |
| Call Prep | REFACTOR | Same shape as Lead Qualifier |
| Proposal Studio | REFACTOR (heavy) | Keep project model + approve/lock/invalidate flow + UI; replace generation/extraction/revision with LLM + deterministic fallback; add validators; restructure section templates to the real guide format |
| Market Signals | REFACTOR | Real FRED plumbing and pulse math worth keeping; fix failure isolation, replace dead Stooq source, derive plain-English from data, restructure Campaign Signal |
| Auth | REBUILD | Replaced wholesale by access-code auth per spec; NextAuth v4 + Drive Picker is unverifiable dead weight here |

Nothing warrants a from-scratch rebuild of a module: the UI layer, types, and state management are consistently decent. The work is replacing fake brains with real ones and making degradation visible.
