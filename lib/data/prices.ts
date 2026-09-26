// NSE end-of-day prices (data/prices.json), built from the bhavcopy by scripts/fetch-prices.ts.
// Every per-symbol array is aligned to `sessions`; null marks a session the symbol didn't trade.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { lastCompletedSession } from "./calendar";

const nullableNonNegative = z.number().nonnegative().nullable();

const historySchema = z.object({
  series: z.string().min(1),
  close: z.array(nullableNonNegative),
  volume: z.array(nullableNonNegative),
  traded_value: z.array(nullableNonNegative),
});

const pricesFileSchema = z
  .object({
    schema_version: z.literal(1),
    as_of: z.iso.date(),
    sessions: z.array(z.iso.date()).min(1),
    symbols: z.record(z.string(), z.union([z.object({ missing: z.literal(true) }), historySchema])),
  })
  .superRefine((file, ctx) => {
    if (file.sessions.some((d, i) => i > 0 && d <= file.sessions[i - 1]!)) {
      ctx.addIssue({ code: "custom", path: ["sessions"], message: "sessions must be strictly ascending" });
    }
    if (file.sessions.at(-1) !== file.as_of) {
      ctx.addIssue({ code: "custom", path: ["as_of"], message: "as_of must equal the last session" });
    }
    for (const [symbol, h] of Object.entries(file.symbols)) {
      if ("missing" in h) continue;
      for (const key of ["close", "volume", "traded_value"] as const) {
        if (h[key].length !== file.sessions.length) {
          ctx.addIssue({ code: "custom", path: ["symbols", symbol, key], message: "must align with sessions" });
        }
      }
    }
  });

export type PriceHistory =
  | { missing: true }
  | {
      series: string;
      /** Rupees, aligned to sessions. */
      closes: (number | null)[];
      volumes: (number | null)[];
      /** Rupees, aligned to sessions. */
      tradedValues: (number | null)[];
    };

export type Prices = {
  asOf: string;
  sessions: string[];
  symbols: Record<string, PriceHistory>;
};

export type LoadPricesResult =
  | { status: "ok"; prices: Prices; stale: boolean; lastCompletedSession: string }
  | { status: "missing" }
  | { status: "invalid"; issues: string[] };

export function loadPrices(path: string, now: Date): LoadPricesResult {
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
  const parsed = pricesFileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }

  const file = parsed.data;
  const prices: Prices = {
    asOf: file.as_of,
    sessions: file.sessions,
    symbols: Object.fromEntries(
      Object.entries(file.symbols).map(([symbol, h]) => [
        symbol,
        "missing" in h
          ? { missing: true as const }
          : { series: h.series, closes: h.close, volumes: h.volume, tradedValues: h.traded_value },
      ]),
    ),
  };
  const last = lastCompletedSession(now);
  return { status: "ok", prices, stale: prices.asOf < last, lastCompletedSession: last };
}
