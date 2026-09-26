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

const range = (from: number, to: number) => {
  const step = from <= to ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => from + i * step);
};
const one = (closes: number[], tradedValue?: number) =>
  evaluateCandidates([cand(1, "X")], prices({ X: history(closes, tradedValue) }))[0]!;

describe("evaluateCandidates: technical rules", () => {
  it("excludes a close below a falling 20DMA", () => {
    // 100..164 then ten sessions at 140: MA20 149.75 (was 154.5), MA50 143.6 and rising.
    const row = one([...range(100, 164), ...Array(10).fill(140)]);
    expect(row).toMatchObject({ status: "excluded", reason: "below falling 20DMA" });
    expect(row.metrics).toMatchObject({ ma20: 149.75, ma50: 143.6, sessions: 75 });
  });

  it("excludes a close below a falling 50DMA", () => {
    // 164..100 then a rally 101..110: above MA20 (105) but below MA50 116.7 (was 124.5).
    const row = one([...range(164, 100), ...range(101, 110)]);
    expect(row).toMatchObject({ status: "excluded", reason: "below falling 50DMA" });
    expect(row.metrics).toMatchObject({ ma20: 105, ma50: 116.7 });
  });

  it("lists every failing rule", () => {
    // Flat 100 then a slide 99..85: MA20 94 (was 99.25), MA50 97.6 (was 99.7).
    const row = one([...Array(60).fill(100), ...range(99, 85)]);
    expect(row.reason).toBe("below falling 20DMA; below falling 50DMA");
    expect(row.metrics).toMatchObject({ ma20: 94, ma50: 97.6 });
  });

  it("excludes a close more than 15% above its 50DMA (KPL, 24 Sep: 15.8%)", async () => {
    const { loadPrices } = await import("../data/prices");
    const loaded = loadPrices(`${import.meta.dirname}/../../data/prices.json`, new Date("2026-09-25T06:30:00Z"));
    if (loaded.status !== "ok") throw new Error(loaded.status);
    const row = evaluateCandidates([cand(1, "KPL")], loaded.prices)[0]!;
    expect(row).toMatchObject({ status: "excluded", reason: "extended: 15.8% above 50DMA (15% max)" });
  });

  it("allows exactly 15% above the 50DMA", () => {
    // Last 50 closes: 85, 48 × 100, 115 → MA50 exactly 100, close 115.
    const row = one([...Array(25).fill(100), 85, ...Array(48).fill(100), 115]);
    expect(row.metrics?.dist50Pct).toBe(15);
    expect(row.status).toBe("pass");
  });

  it("excludes a median daily traded value under ₹2 Cr, and allows exactly ₹2 Cr", () => {
    expect(one(rising(75), 1.99e7)).toMatchObject({
      status: "excluded",
      reason: "illiquid: median ₹1.99 Cr/day (₹2 Cr minimum)",
    });
    expect(one(rising(75), 2e7).status).toBe("pass");
  });

  it("takes the liquidity median over the last 50 sessions only", () => {
    const h = history(rising(75));
    if ("missing" in h) throw new Error();
    h.tradedValues = [...Array(25).fill(1e9), ...Array(50).fill(1.5e7)];
    const row = evaluateCandidates([cand(1, "X")], prices({ X: h }))[0]!;
    expect(row.metrics?.medianTradedValueCr).toBe(1.5);
    expect(row.status).toBe("excluded");
  });

  it("calls a close below the 50DMA insufficient when there are too few sessions to know its slope", () => {
    // 55 sessions: 100..153 then 125. MA20 rising, close under MA50 128.92, slope needs 60 sessions.
    const row = one([...range(100, 153), 125]);
    expect(row).toMatchObject({ status: "insufficient", reason: "below 50DMA; its slope needs 60 sessions (have 55)" });
  });

  it("passes a steady uptrend and reports its numbers", () => {
    const row = one(rising(75), 5e7);
    expect(row.status).toBe("pass");
    expect(row.reason).toBe("");
    expect(row.metrics).toMatchObject({ sessions: 75, medianTradedValueCr: 5 });
    expect(row.metrics!.slope20).toBeGreaterThan(0);
  });
});
