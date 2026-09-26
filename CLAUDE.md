# Zerodha Basket Planner

A single-user, **read-only** Next.js app: Kite login → bucket & horizon → basket plan. It sizes a basket from the daily ranked list (`data/latest.json`) and NSE end-of-day prices (`data/prices.json`).

## Hard rules
- **Never** call a Kite order, GTT or basket endpoint, and never add the `kiteconnect` SDK. The Kite client only allows the endpoints listed in `lib/kite/endpoints.ts`, and `tests/no-order-code.test.ts` enforces this.
- The Kite `api_secret` and `access_token` stay server-side. Never log them, return them in errors, or save them in plans.
- Money math is integer paise. `Σ qty × limit ≤ bucket` is asserted before a plan is shown.
- Domain vocabulary is in `CONTEXT.md`. Decisions are in `docs/adr/`.

## Commands
- `npm test` — Vitest
- `npm run build` — validates the data files (prebuild), then `next build`
- `npm run dev` — local dev (`KITE_MOCK=1` uses the mock Kite client)

## Agent skills

### Issue tracker

Issues and specs live in this repo's GitHub Issues (via `gh`). The board is a GitHub Projects (v2) board. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
