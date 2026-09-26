import { describe, expect, it } from "vitest";
import type { Candidate } from "../data/list";
import type { PriceHistory, Prices } from "../data/prices";
import { evaluateCandidates } from "./evaluate";

const cand = (rank: number, symbol: string): Candidate => ({
  rank,
  symbol,
  name: `${symbol} Ltd`,
  upsideLowPct: 15,
  upsideHighPct: 30,
  rationale: "",
  flags: [],
});

/** Closes in rupees, oldest first; traded value defaults to ₹5 Cr a day. */
function history(closes: (number | null)[], tradedValueRupees = 5e7, series = "EQ"): PriceHistory {
  return {
    series,
    closes,
    volumes: closes.map((c) => (c === null ? null : tradedValueRupees / c)),
    tradedValues: closes.map((c) => (c === null ? null : tradedValueRupees)),
  };
}

function prices(symbols: Record<string, PriceHistory>): Prices {
  const length = Math.max(1, ...Object.values(symbols).map((h) => ("missing" in h ? 0 : h.closes.length)));
  return {
    asOf: "2026-09-24",
    sessions: Array.from({ length }, (_, i) => `s${i}`),
    symbols,
  };
}

const rising = (n: number, end = 100, stepPct = 0.2) =>
  Array.from({ length: n }, (_, i) => +(end * (1 - (stepPct / 100) * (n - 1 - i))).toFixed(2));

describe("evaluateCandidates: data and tradability", () => {
  it("reports a symbol absent from the price data as a data error, never dropping it", () => {
    const rows = evaluateCandidates([cand(1, "GHOST"), cand(2, "OK")], prices({ OK: history(rising(75)) }));
    expect(rows.map((r) => [r.symbol, r.status])).toEqual([
      ["GHOST", "data-error"],
      ["OK", "pass"],
    ]);
    expect(rows[0]!.reason).toBe("no NSE price data for this symbol");
  });

  it("reports a symbol the bhavcopy marked missing, or with no close on the as-of date, as a data error", () => {
    const rows = evaluateCandidates(
      [cand(1, "GONE"), cand(2, "HALTED")],
      prices({ GONE: { missing: true }, HALTED: history([...rising(74), null]) }),
    );
    expect(rows.map((r) => [r.status, r.reason])).toEqual([
      ["data-error", "no NSE price data for this symbol"],
      ["data-error", "no close on 2026-09-24"],
    ]);
  });

  it("marks non-EQ series as not tradable, naming the series", () => {
    const rows = evaluateCandidates([cand(1, "SMEX")], prices({ SMEX: history(rising(75), 5e7, "SM") }));
    expect(rows[0]).toMatchObject({ status: "not-tradable", reason: "series SM on NSE (only EQ is tradable here)" });
  });

  it("labels fewer than 50 sessions as insufficient data, not a rejection", () => {
    const rows = evaluateCandidates([cand(1, "NEWLIST")], prices({ NEWLIST: history(rising(49)) }));
    expect(rows[0]).toMatchObject({ status: "insufficient", reason: "insufficient data: 49 sessions (50 needed)" });
  });
});
