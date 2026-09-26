// Saved once in the Claude Cowork project (or pasted after a screen run) so results come back in
// the exact format the Update list page accepts (data/latest.json, schema v2). No literal dates:
// it must stay correct when reused day after day.
export function coworkInstruction(): string {
  return `When a screen run finishes, end your reply with the results as ONE JSON object and nothing after it: no code fences.

Use exactly this shape:
{
  "schema_version": 2,
  "screen_date": "<today's date in India (IST), YYYY-MM-DD>",
  "generated_at": "<the current time, ISO 8601 in UTC, e.g. 2026-09-28T03:10:00Z>",
  "horizons": {
    "3-6m":   { "candidates": [ ... ] },
    "6-12m":  { "candidates": [ ... ] },
    "12-18m": { "candidates": [ ... ] },
    "18-24m": { "candidates": [ ... ] }
  }
}

Each candidate:
{ "rank": 1, "symbol": "ELLEN", "exchange": "NSE", "name": "Ellenbarrie Industrial Gases",
  "upside_low_pct": 20, "upside_high_pct": 40,
  "rationale": "PEG 1.03; OCF 128% of profit; debt 247 -> 184 Cr", "flags": [] }

Rules:
- A separate ranked list for each horizon (3-6, 6-12, 12-18, 18-24 months). Leave out a horizon only if you have no picks for it.
- Rank 20 names per horizon where possible (at least 14): the app backfills when names fail its checks.
- rank runs 1, 2, 3, … with no gaps, best first. No symbol twice within a horizon.
- symbol is the exact NSE trading symbol in capitals (as on nseindia.com), exchange is always "NSE". Mainboard EQ stocks only: no SME, BE or BSE-only names.
- upside_low_pct ≤ upside_high_pct, as plain numbers (20, not "20%"), for that horizon.
- rationale: one short line of the key reasons. flags: short warnings as strings, or [].`;
}
