# Domain glossary

**Ranked list**: the daily output of the external screen, in `data/latest.json`. One ranked list per horizon. The app never picks stocks.

**Screen date**: the date the ranked list was produced. The list is **stale** when the screen date is more than 2 NSE trading days before today (IST).

**Horizon**: the profit timeframe the user chooses: `3-6m`, `6-12m`, `12-18m` or `18-24m`. Each horizon has its own ranked list.

**Candidate**: one entry in a ranked list: rank, symbol, name, upside range, rationale, flags.

**Publish (a list)**: commit a pasted ranked list to `data/latest.json` from the Update list page, after validating it. The screen itself still runs outside the app (in Cowork); the app only publishes its output. See ADR 0007.

**Upside range / midpoint**: `upside_low_pct`–`upside_high_pct` from the ranked list. The midpoint is their mean. It drives target weights.

**Bucket**: the rupee amount to plan for: ₹5,000, ₹10,000, ₹20,000, ₹50,000, ₹1,00,000 or ₹2,00,000.

**Depth**: how many names a bucket holds at most (4, 6, 8, 10, 12, 14).

**Beyond depth**: a candidate that passed the checks but wasn't needed, because the plan was already filled to depth by higher-ranked names. It is not deferred and not excluded.

**Close**: the last NSE end-of-day close, from the bhavcopy. It is the reference price. There is no live LTP.

**Prices as-of**: the session date of the latest close in `data/prices.json`.

**Checks**: the per-candidate evaluation. A candidate ends in one of these check statuses:
- `pass` — eligible for allocation.
- `excluded` — failed a technical rule (falling MA, extended, illiquid). Always shown with numbers and a reason.
- `insufficient` — fewer than 50 sessions of history. Not a rejection, but not eligible.
- `not-tradable` — series is not `EQ` on NSE.
- `data-error` — the symbol is missing from the price data or has no close on the as-of date. Never dropped silently.
- `deferred` — passed the checks, but was rejected by the feasibility test for this bucket.

**Limit (buy limit)**: close × 1.015, rounded down to `max(₹0.05, NSE band tick)`.

**Target weight**: a name's upside midpoint ÷ the sum of midpoints across the selected set. **Target amount** = target weight × bucket.

**Feasibility test**: a name is admitted only if one share at its limit ≤ 1.5 × its target amount.

**Weight** (of a position): qty × limit ÷ **bucket** (not ÷ total committed). **Weight error** = weight − target weight.

**Plan (basket plan)**: the positions (symbol, qty, limit, amount, weight vs target), totals, unspent balance, deferred names, and the full check table.

**Saved plan**: an immutable snapshot of a plan in the user's history.

**Holdings overlap**: existing quantity and average price from Kite for a candidate already held.

**Kite session**: the owner's logged-in state. It holds the encrypted access token server-side, plus the chosen bucket and horizon. It expires at the next 06:00 IST, when Kite invalidates the token, and the owner goes back to Step 1.

**Mock Kite client**: an in-memory Kite with sample holdings and cash, used by tests, local development (`KITE_MOCK=1`) and tour screenshots. Production refuses to start with it.

## Avoid
- "Recommendation" or "advice" for a plan. It is a screen output sized to a bucket.
- "LTP" for the reference price. This app uses the last **close**.
