# Move CA Engine

Move CA Engine is an internal web app for Move Supply Chain's client acquisition workflow.

Product bible: `Move-CA-Engine-Overview.md` defines the north star. The app is not a chatbot and not a generic admin panel. Every screen is a workflow with a clear input, processing step, output, and next action.

## The four modules

- **Lead Qualifier** (`/dashboard/lead-qualifier`): paste a brand, URL, notes, or website copy. URLs are fetched live server-side; the lead is scored against Move's ICP with reasons, disqualifiers, a personalization hook, and a CRM-ready summary.
- **Call Prep Engine** (`/dashboard/call-prep`): paste booking form or intake answers. The website found in the intake is scanned live and combined into a battle card: brand snapshot, ranked pain map, 8 to 10 tailored diagnostic questions, probable service path, things to verify and avoid.
- **Proposal Studio** (`/dashboard/proposal-studio`): paste discovery notes, extract structured facts, draft seven sections in order with approve/lock gates, revise through chat, export Markdown or HTML, and draft a companion email. Every draft is checked against the Move proposal rules (see below).
- **Market Signals** (`/dashboard/market-signals`): six free public indicators (FRED macro series plus the XLY/XLP discretionary-vs-staples ratio from Yahoo Finance), each with current value, trend arrow, sparkline, and a plain-English "what it means" derived from the data direction. A 0-100 Demand Pulse gauge blends them, and the Campaign Signal writes a three-block weekly brief from the fetched numbers only.

## Setup

```bash
npm install
cp .env.example .env.local   # set ACCESS_CODE and one LLM key
npm run dev
```

Open `http://localhost:3000` and sign in with the access code.

The app needs exactly two environment variables to be fully functional:

- `ACCESS_CODE` — the shared team sign-in code. Without it, nobody can log in (there is no bypass).
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — one LLM key (select with `LLM_PROVIDER=anthropic|openai`).

The OpenAI provider also works with any OpenAI-compatible endpoint via `OPENAI_BASE_URL` (for example Google's Gemini compat layer at `https://generativelanguage.googleapis.com/v1beta/openai` with a Gemini API key and `OPENAI_MODEL=gemini-2.5-flash`). For reasoning models set `OPENAI_REASONING_EFFORT=none` so thinking tokens don't truncate JSON outputs.

A third provider, `LLM_PROVIDER=codex`, drives **gpt-5.5** through the ChatGPT/Codex backend (the Responses API) using a ChatGPT OAuth access token. Point `CODEX_AUTH_FILE` at a Codex or Hermes `auth.json` (the token is read fresh on every call so a re-auth is picked up without a restart), or pass `CODEX_ACCESS_TOKEN` directly. Note this depends on an undocumented ChatGPT endpoint and a short-lived token; if the token lapses, every module degrades visibly to fallback mode rather than breaking.

Market data needs no keys: FRED and Yahoo Finance are fetched from free public endpoints and cached in `.cache/market-signals.json`.

## Auth model

A minimal shared-access-code scheme:

- `POST /api/auth/login` checks the code and sets an httpOnly cookie (a hash derived from the code, so rotating `ACCESS_CODE` invalidates all sessions).
- `src/proxy.ts` (Next.js 16 middleware convention) protects `/dashboard/*`, `/setup`, and `/api/*`; pages redirect to `/login`, APIs return 401.
- Every API route additionally verifies the cookie itself (defense in depth).

There are no user accounts, no OAuth, and no Google integrations.

## Live AI vs fallback mode

All LLM calls run server-side. The header always shows a badge: green **Live AI** when a key is configured and the last call succeeded, amber **Fallback mode** otherwise. Every generated output carries a footer stating whether it came from the LLM or from deterministic local fallback logic. Nothing degrades silently:

- With a key: lead scoring, call prep, fact extraction, proposal sections, revisions, the companion email, and the Campaign Signal are LLM-generated, grounded in the playbooks under `content/`.
- Without a key (or when a call fails): the same workflows run on local keyword/template logic and every output is labeled "Local fallback logic, not the LLM".

## Website fetching

`POST /api/fetch-website` is the one shared fetcher: 10-second timeout, redirects followed, private/internal hosts blocked, readable text extracted (title, meta description, headings, body copy) and capped at ~8,000 characters. Lead Qualifier auto-fetches when the input looks like a URL; Call Prep extracts the website from the pasted intake. A failed fetch shows a visible "couldn't reach the site, using pasted text only" notice and never breaks the workflow.

## Proposal rules enforcement

The proposal guide's hard rules are encoded as post-generation validators in `src/lib/proposal-rules.ts` and run on every generated or revised section (LLM and fallback alike):

- Section 1: 5 to 8 specific pain bullets
- Section 2: package table with Name, Cost, Hours, Duration, and only official Move role names; Option 3 (Fractional Supply Chain Support) appears only when the extracted facts justify it
- Section 3: must render as a table
- Section 5: SLA table with exactly three columns (KPI, Commitment, Metrics) and 3 to 5 rows
- Section 6: each scope pillar contains Objective, Approach, Expected Outcome
- No em dashes anywhere (auto-replaced before display)
- Pricing and duration consistency across sections is checked, with mismatches flagged in the UI for human review, never silently corrected

The official Move role list lives in `MOVE_OFFICIAL_ROLES` in `src/lib/proposal-rules.ts` (it is not defined anywhere in `content/`); edit it there if the roster changes.

Companion email rules are enforced the same way: exactly one CTA, subject references Move Supply Chain, no "just checking in"/"wanted to follow up", max 3 to 4 bullets, no em dashes.

The approve/lock flow is unchanged: each section locks on approval and becomes context for the next; unlocking an earlier section marks later locked sections for review.

## Branding and theme

Design tokens in `src/app/globals.css`: navy `#182454`, green `#3CA848`, coral `#F05448`. Light mode plus a navy-based dark mode (default), toggled in the header and persisted in localStorage. All cards, buttons, badges, and charts read from the tokens.

## Content library

`content/` is the only reference library:

- `content/playbooks` — proposal rules, service paths, pricing benchmarks, ICP rules, tone
- `content/client-acquisition` — qualification, discovery, outreach, and email rules
- `content/market-signals` — Demand Pulse and Campaign Signal rules
- `content/proposal-library`, `content/email-examples`, `content/case-studies` — precedent folders (structure and tone only; client facts never carry over)

These files are loaded into LLM prompts server-side. One-off references can also be pasted into a proposal project (`POST /api/references/import`).

## Storage

Browser localStorage only (no database). Leads, battle cards, proposal projects, and the latest market snapshot live in the browser that created them. Saved Projects offers JSON export/import for backup.

## Quality checks

```bash
npm run lint
npm run build
```

The Playwright smoke test (`tests/smoke.spec.ts`) expects a dev server running with `ACCESS_CODE=move-demo`.

## Deployment

Deploy to Vercel (or any Node host) and set the same environment variables: `ACCESS_CODE`, `LLM_PROVIDER`, and one LLM key. The market data cache writes to `.cache/`; on serverless hosts this is best-effort per instance and the app degrades gracefully without it.

## Intentionally not included

- Database or shared team workspace
- Google OAuth, Drive sync, or Docs export
- CRM integrations or automatic sending
- Vector search, public accounts, role-based permissions
