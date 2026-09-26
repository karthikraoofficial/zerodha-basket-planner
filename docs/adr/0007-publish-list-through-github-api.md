# 7. The daily list is published by committing it through the GitHub API

**Status:** accepted (2026-09-26)

The screen runs outside the app: the owner runs it by hand in Claude Cowork, often from a phone. The ranked list then has to reach `data/latest.json`, where the build validates it and the price job reads its symbols. Editing a JSON file on GitHub from a phone is slow and error-prone.

**Decision:**
- An owner-only **Update list** page (`/upload`) takes the pasted list and validates it with the same schema and staleness rules the build uses. If it passes, the page commits `data/latest.json` to `main` through the GitHub contents API (`lib/github/publish.ts`, `lib/github/publishList.ts`).
- The commit is the trigger. It starts the price job for any new symbols and a Vercel redeploy, so a list is only ever live after the build has validated it.
- The list is not kept in Redis: the repo stays the one source of truth, and every list has a git audit trail.
- The app holds a fine-grained `GITHUB_TOKEN` scoped to this repo's contents. It stays server-side. GitHub's error messages are scrubbed of it before they reach the page. The target repo comes from `GITHUB_REPO`, or else from the repo Vercel deployed from.
- `/api/health` reports whether publishing is configured (`publishing: true/false`), by variable name only.

**Consequences:**
- This is the app's only write path, and it writes to GitHub, not to Zerodha. "Read-only" in this project means read-only toward Kite: no orders, GTTs or baskets (ADR 0004, `tests/no-order-code.test.ts`).
- A leaked `GITHUB_TOKEN` could rewrite repo contents, so it must be limited to this repo and to contents only.
- The repo is public, so every published list is public too. See the SEBI note in PRD #1's Further Notes.
- Publishing is optional. Without `GITHUB_TOKEN`, the page explains what to set up, and lists can still be committed by hand.
