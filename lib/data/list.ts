// Ranked lists published daily by the external screen (data/latest.json, schema v2).
import { readFileSync } from "node:fs";
import { z } from "zod";
import { istDate, tradingDaysAfter } from "./calendar";

export const HORIZONS = ["3-6m", "6-12m", "12-18m", "18-24m"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const HORIZON_LABELS: Record<Horizon, string> = {
  "3-6m": "3–6 months",
  "6-12m": "6–12 months",
  "12-18m": "12–18 months",
  "18-24m": "18–24 months",
};

/** A list older than this many NSE trading days blocks Step 3. */
export const MAX_LIST_AGE_TRADING_DAYS = 2;
/** The largest bucket holds 14 names; fewer leaves nothing to backfill from. */
const RECOMMENDED_DEPTH = 14;

const candidateSchema = z
  .object({
    rank: z.int().positive(),
    symbol: z.string().regex(/^[A-Z0-9&\-]+$/, "NSE trading symbol"),
    exchange: z.string(),
    name: z.string().min(1),
    instrument_token: z.int().positive().optional(),
    upside_low_pct: z.number(),
    upside_high_pct: z.number(),
    rationale: z.string(),
    flags: z.array(z.string()),
  })
  .refine((c) => c.upside_low_pct <= c.upside_high_pct, { message: "upside_low_pct exceeds upside_high_pct" });

const horizonListSchema = z
  .object({ candidates: z.array(candidateSchema).min(1) })
  .superRefine(({ candidates }, ctx) => {
    candidates.forEach((c, i) => {
      if (c.rank !== i + 1) ctx.addIssue({ code: "custom", message: `ranks must run 1..n in order (got ${c.rank} at position ${i + 1})` });
    });
    const seen = new Set<string>();
    for (const c of candidates) {
      if (seen.has(c.symbol)) ctx.addIssue({ code: "custom", message: `duplicate symbol ${c.symbol}` });
      seen.add(c.symbol);
    }
  });

const listFileSchema = z.object({
  schema_version: z.literal(2),
  screen_date: z.iso.date(),
  generated_at: z.iso.datetime(),
  horizons: z
    .partialRecord(z.enum(HORIZONS), horizonListSchema)
    .refine((h) => Object.keys(h).length > 0, { message: "at least one horizon is required" }),
});

export type Candidate = {
  rank: number;
  symbol: string;
  name: string;
  upsideLowPct: number;
  upsideHighPct: number;
  rationale: string;
  flags: string[];
};

export type RankedLists = {
  screenDate: string;
  generatedAt: string;
  horizons: Partial<Record<Horizon, Candidate[]>>;
};

export type LoadListResult =
  | { status: "ok"; list: RankedLists; availableHorizons: Horizon[]; tradingDaysOld: number; warnings: string[] }
  | { status: "stale"; list: RankedLists; availableHorizons: Horizon[]; tradingDaysOld: number }
  | { status: "missing" }
  | { status: "invalid"; issues: string[] }
  | { status: "non-nse"; symbols: string[] };

export function loadList(path: string, now: Date): LoadListResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { status: "missing" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { status: "invalid", issues: [`not valid JSON: ${(e as Error).message}`] };
  }

  const parsed = listFileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }

  const file = parsed.data;
  const nonNse = Object.values(file.horizons).flatMap((h) => h.candidates.filter((c) => c.exchange !== "NSE"));
  if (nonNse.length) return { status: "non-nse", symbols: [...new Set(nonNse.map((c) => c.symbol))] };

  const list: RankedLists = {
    screenDate: file.screen_date,
    generatedAt: file.generated_at,
    horizons: Object.fromEntries(
      Object.entries(file.horizons).map(([h, { candidates }]) => [
        h,
        candidates.map((c) => ({
          rank: c.rank,
          symbol: c.symbol,
          name: c.name,
          upsideLowPct: c.upside_low_pct,
          upsideHighPct: c.upside_high_pct,
          rationale: c.rationale,
          flags: c.flags,
        })),
      ]),
    ),
  };
  const availableHorizons = HORIZONS.filter((h) => list.horizons[h]);
  const tradingDaysOld = tradingDaysAfter(list.screenDate, istDate(now));
  if (tradingDaysOld > MAX_LIST_AGE_TRADING_DAYS) {
    return { status: "stale", list, availableHorizons, tradingDaysOld };
  }
  const warnings = availableHorizons
    .filter((h) => list.horizons[h]!.length < RECOMMENDED_DEPTH)
    .map((h) => `${h} has only ${list.horizons[h]!.length} names (${RECOMMENDED_DEPTH} recommended for backfill)`);
  return { status: "ok", list, availableHorizons, tradingDaysOld, warnings };
}
