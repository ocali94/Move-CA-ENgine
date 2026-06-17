# Move CA Engine — Handover

Date: 2026-06-12. This is the working handover for whoever picks the app up next (human or Claude). It supersedes `AUDIT.md` (Phase 1 findings, 2026-06-11) and `PLAN.md` (Phase 2 plan) — keep those for history, read this for current state.

## What this app is

Internal Next.js app for Move Supply Chain's client acquisition team. Four modules behind a shared access code:

1. **Lead Qualifier** — paste a brand/notes/URL, get a 0–100 fit score against Move's ICP with reasons and a CRM-ready summary.
2. **Call Prep Engine** — paste intake answers, get a one-page battle card (snapshot, pain map, 10 diagnostic questions, service path, things to verify/avoid).
3. **Proposal Studio** — the flagship. Paste discovery notes → extract facts (editable JSON) → generate 7 sections one at a time with approval gates → rule validators per section → companion email → export Markdown/HTML. Section format matches Move's real sent proposals (see `work/proposal-examples/`).
4. **Market Signals** — Demand Pulse (0–100) from free public data (FRED CSV, Yahoo Finance), sparkline cards, plain-English explanations, LLM-written Campaign Signal with a copy-paste tweet queue.

Product source of truth: `Move-CA-Engine-Overview.md`. Proposal format source of truth: the six extracted real proposals in `work/proposal-examples/`.

## Stack and conventions

- **Next.js 16.2.9** — read `node_modules/next/dist/docs/` before writing code; this version differs from training data. Middleware is `src/proxy.ts` (named export `proxy`, Node runtime). All `cookies()`/`headers()`/`params` are async-only.
- React 19, TypeScript, Tailwind v4 (`@theme inline` tokens in `src/app/globals.css`), Zod v4, Recharts, lucide-react.
- **No database.** Browser localStorage is the only persistence (`src/lib/client-storage.ts`, `useSyncExternalStore`). Server keeps only a market-data file cache (`.cache/market-signals.json`).
- LLM calls are server-side only. Components never see keys.
- No new dependencies without strong justification (project rule).
- Brand tokens: navy `#182454`, green `#3CA848`, coral `#F05448`. Light + navy dark mode, class-based (`.dark` on `<html>`), bootstrap script in `src/app/layout.tsx` prevents flash.

## Run it

```bash
npm install
cp .env.example .env.local   # set ACCESS_CODE + one LLM provider
npm run dev                  # http://localhost:3000
npm run lint && npm run build  # both clean as of 2026-06-12
npx playwright test          # tests/smoke.spec.ts, needs dev server + ACCESS_CODE=move-demo
```

Current `.env.local` (local dev): `ACCESS_CODE=move-demo`, `LLM_PROVIDER=codex`, `CODEX_AUTH_FILE=~/.hermes/auth.json`, `CODEX_MODEL=gpt-5.5`.

### LLM providers (`src/lib/llm/`)

- `anthropic` — `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`).
- `openai` — `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` (works with Gemini's OpenAI-compat endpoint), `OPENAI_REASONING_EFFORT=none` to stop reasoning models burning the token budget.
- `gemini` — `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `GEMINI_REASONING_EFFORT` (default `none`). Its own env slot (separate from `OPENAI_*`) so it can run as a backup alongside another provider. Implemented as a thin wrapper over the OpenAI provider pointed at Google's compat endpoint (`src/lib/llm/providers/gemini.ts`).
- `codex` — ChatGPT OAuth token read fresh per call from `CODEX_AUTH_FILE` (Hermes-style auth.json) or `CODEX_ACCESS_TOKEN`. Hits `chatgpt.com/backend-api/codex/responses` (SSE). Only `gpt-5.5` works with a ChatGPT account.
  - **Caveat:** ChatGPT Plus has a daily usage limit (429 `usage_limit_reached`) and the Hermes refresh flow is broken, so Codex goes unavailable roughly daily. This is now largely absorbed by automatic failover (below). Still unusable for hosted deploys (reads a file off the local machine) — for hosting, make the primary `anthropic`/`openai`/`gemini`.

### Multi-provider failover + switcher (added in `66cdf84`)

- **Chain.** `LLM_PROVIDER` is primary; `LLM_FALLBACK_PROVIDERS` (comma-separated) are backups. Current local config: `LLM_PROVIDER=codex`, `LLM_FALLBACK_PROVIDERS=gemini`. `getProviderChain()` in `src/lib/llm/index.ts` resolves the ordered list.
- **Automatic failover.** `generateWithLLM` tries each configured provider in order and returns the first success; a 429/timeout/bad-key moves to the next. So Codex hitting its limit transparently serves from Gemini instead of dropping to local fallback. `lastCall.skipped[]` records who was tried and why.
- **Visibility + manual switch.** Header badge (`LlmStatusBadge`, `src/components/llm-status.tsx`) is now a dropdown: shows the active provider, per-provider health (Live/Unavailable/No key), a failover notice, and lets the user force Auto/Codex/Gemini. `GET /api/llm/status` reports `chain`/`primary`/`override`/`lastCall`; `POST /api/llm/provider` sets the override (in-memory, per process, resets to Auto on restart; failover still applies to a forced choice). The badge/status report the provider that *actually served* (from `lastCall`), not just the first configured one.
- Every module calls `tryGenerateJson`/`tryGenerateText` (`src/lib/llm/index.ts`) which never throw; if the whole chain fails the module's deterministic fallback runs, labeled "Local fallback logic, not the LLM" in a `GenerationFooter`. **No module code changed for failover** — it all lives under `generateWithLLM`.

### Auth

`ACCESS_CODE` env var → `POST /api/auth/login` sets an httpOnly cookie containing a SHA-256-derived token (timing-safe compares in `src/lib/access.ts`). `src/proxy.ts` guards `/dashboard/*`, `/setup`, and `/api/*` (except login/health). Rotating the code signs everyone out. There is **no login rate limiting** (see Known issues).

## Where things live

- `src/lib/workflows/` — deterministic logic + fallbacks per module (`proposal.ts` also has `markdownToHtml`, shared by in-app preview and HTML export).
- `src/lib/proposal-rules.ts` — official role names (`MOVE_OFFICIAL_ROLES`), section titles, post-generation validators (5–8 pain bullets, package table columns, SLA 3-col table, Objective/Approach/Expected Outcome, Option 3 decision tree, cross-section pricing/duration consistency, email rules). Validators flag, never silently rewrite.
- `src/lib/proposal-llm.ts` — per-section generation requirements fed to the LLM; mirrors the validators.
- `src/lib/workflows/market.ts` — signal fetching (`Promise.allSettled`, per-signal `dataMode` live/cached/demo), Demand Pulse math, deterministic campaign signal + tweets. `src/lib/market-campaign.ts` — LLM campaign signal + tweets.
- `src/components/modules/*-client.tsx` — the four module UIs + dashboard overview + saved projects.
- `content/` — playbooks/rules markdown; the only reference library. Indexed at `/api/content/index`, searched at `/api/content/search`. **Do not edit `content/`** (user's source material).
- `tests/smoke.spec.ts` — Playwright E2E covering all four modules.

## State of play (commits)

- `fd9475a` — full audit + upgrade: access-code auth replacing NextAuth/Drive, real LLM pipeline with labeled fallbacks, market overhaul, validators, Move branding/theming.
- `566755c` — proposal format rebuilt against the six real sent proposals; rendered table preview (Edit/Preview toggle); tweet queue in Market Signals.
- `3c3af10` — clickable section navigation + unlock-to-edit for approved sections; review-recommended propagation; **fixed saved project not loading on page refresh** (render-phase adoption after localStorage hydration in `proposal-studio-client.tsx`).
- `ac17fdf` — Call Prep: tolerant Zod schema for `brandSnapshot.notes` (model sometimes returns an array; we were discarding the whole LLM response and silently falling back).
- `66cdf84` — multi-provider failover (Codex primary → Gemini backup, automatic) + header provider switcher; new `POST /api/llm/provider`, extended `GET /api/llm/status`, new `gemini` provider.

End-to-end verified 2026-06-17: login, all four modules; with Codex at its daily usage limit (429) the chain auto-failed-over to Gemini and the badge showed "Live AI · Gemini"; manual switch Auto/Codex/Gemini works; dropdown opaque in dark mode; lint + build clean.

## Known issues (open, ordered by value)

1. **Market Signals page pays a full LLM round-trip on every visit (~10–15s).** `GET /api/market-signals/latest` calls `generateCampaignSignal()` uncached even when the underlying pulse comes from the 24h file cache. Fix: cache the campaign signal alongside the market cache keyed by `pulse.updatedAt` (regenerate only when data refreshes or on explicit "Refresh market data"). Single-file change in `src/lib/market-campaign.ts` or the route.
2. **Saved Projects is view-only.** Export/Import JSON exists, but there's no Open/Delete/Switch per project, and Proposal Studio always loads `proposalProjects[0]` (most recently saved). Multiple concurrent deals are effectively unsupported. Fix: project picker in Proposal Studio + Open/Delete actions on Saved Projects.
3. **Generations take 15–35s with codex/gpt-5.5** (reasoning model on a slow backend). Loading spinners exist but nothing streams. Options: switch provider (Anthropic/OpenAI API keys are much faster), and/or stream partial output (SSE) into the UI.
4. **No login rate limiting** — fine on localhost, a brute-force risk once hosted. Add per-IP attempt throttling (even a 1s constant delay + small in-memory counter) in `/api/auth/login`.
5. **Settings page is static placard text** — says "Anthropic or OpenAI" while the app actually runs Codex; shows nothing live. Either make it show real status (provider/model from `/api/llm/status`, market cache age, storage size) or fold it into `/setup`, which already does this well.
6. **Recharts console warning spam** — "width(-1) and height(-1)" from chart containers measured at zero size on first paint. Cosmetic (dev console only). Fix: explicit `min-h`/fixed height on `ResponsiveContainer` wrappers in market components.
7. **Dashboard "Current active proposal" card copy** — fallback chain lands on "Extract discovery facts, then generate Section 1..." even mid-proposal, and otherwise shows raw markdown sliced to 390 chars. Should derive from progress ("3 of 7 sections approved — next: Key Differences and Recommendation").
8. **Naming drift** — sidebar says "Reference Library", the page heading says "Proposal Library", route is `/dashboard/proposal-library`. Pick one name.
9. **`content/` README.md files are indexed as references** (show up as "README" cards with category `case_study`). Exclude README files from the index in the content indexer.
10. **Static page title** — every route is titled "Move CA Engine"; add per-route `metadata` titles.
11. **Call Prep fallback pain map lists all 7 categories** including "no direct signal yet" ones — noisy. Only render detected pains (+ count of unverified areas). LLM mode already behaves well (5 relevant entries).

## Usability/polish ideas (not bugs)

- Generation progress: show elapsed time + which model is thinking ("gpt-5.5 is drafting Section 2, ~20s"), so the long waits feel intentional.
- "Client-ready view" toggle in Proposal Studio that hides validation chrome/status badges, plus a print stylesheet so Cmd+P produces something sendable.
- Copy button per proposal section (copy rendered text or markdown).
- After "Approve section", auto-scroll to the next section's Generate button.
- Mobile nav is horizontal-scrolling pills; works, but a hamburger/sheet would feel more deliberate.
- Tweet queue: add "Copied ✓" history or mark-as-posted state so the team doesn't double-post.

## V2 roadmap (bigger swings, in rough priority)

1. **Real persistence + multi-user.** localStorage means every browser is an island (the Activity Feed can't attribute who did what, proposals can't be shared). Smallest credible step: SQLite/Turso or Postgres via Drizzle, keyed by a per-person display name chosen at login. This unlocks shared proposals, team activity, and real handoffs.
2. **Hosting.** Vercel free tier works today with `LLM_PROVIDER=anthropic|openai` env vars (Codex provider is local-only). `npm run build` is clean. Needs: real ACCESS_CODE, login rate limiting (issue 4), and the campaign-signal cache (issue 1) so the Market page doesn't burn tokens per visit.
3. **PDF upload for discovery notes.** Server route that accepts a PDF and extracts text (`pdftotext` is not on servers — use a JS lib like `pdf-parse`, single dependency) and fills the discovery textarea. The user explicitly asked about this; copy-paste was the V1 answer.
4. **Branded document export.** Generate the proposal as a styled PDF/DOCX matching Move's template (cover page, logo, fonts) instead of bare HTML/Markdown. `docx` lib or headless Chrome print-to-PDF.
5. **Streaming generations** (SSE from the LLM through the route to the client) — transforms perceived speed for proposal sections.
6. **Lead list bulk scoring** — CSV/paste a list, score all rows, sortable table, export. The UI already hints at it ("Optional short lead list — V1 scores the primary pasted brand").
7. **Scheduled market refresh** — cron (Vercel Cron) refreshes market cache + campaign signal daily, so the page is always instant and tweets are always fresh.
8. **CRM hooks** — push qualified leads / battle cards to HubSpot/Close via API, or at minimum a webhook.
9. **Proposal quality evals** — golden-set tests that run section generation against the validators across N sample discoveries, catching prompt/model regressions before the team does.

## Gotchas for the next session

- The dev server and `npm run build` fight over `.next/` — running a build kills the running dev server. Restart dev after building.
- Preview-browser localStorage holds seeded test data ("Bright Bottle Co" project, Peak Paddle lead/battle card) — harmless, user's own browser has their real data.
- Codex goes unavailable roughly daily (usage limit / broken refresh). With the failover chain configured this now self-heals to Gemini — the badge shows "Live AI · Gemini" and the switcher's Codex row reads "Unavailable". Only if *both* providers are down does it drop to fallback mode. `/setup` and the header dropdown both show live per-provider status.
- React 19 hydration: the localStorage store serves an empty server snapshot during hydration; any component that snapshots store state into `useState` at mount has the stale-init bug fixed in `3c3af10` — copy that pattern (render-phase adopt once `loaded` flips) if you add similar components.
- Em dashes are banned in generated copy (auto-scrubbed via `scrubEmDashes`); validators warn if any survive.
