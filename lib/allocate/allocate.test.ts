import { describe, expect, it } from "vitest";
import { allocate, buyLimitPaise, depthForBucket, type AllocCandidate } from "./allocate";

const rupees = (r: number) => Math.round(r * 100);

// The 24 Sep 2026 hand-run ₹1,00,000 plan (spec §8). Six names passed the live checks.
const SEP24: AllocCandidate[] = [
  { rank: 1, symbol: "ELLEN", closePaise: rupees(361.0), upsideLowPct: 20, upsideHighPct: 40 },
  { rank: 2, symbol: "KMEW", closePaise: rupees(2956.1), upsideLowPct: 18, upsideHighPct: 35 },
  { rank: 3, symbol: "MARKSANS", closePaise: rupees(342.55), upsideLowPct: 18, upsideHighPct: 32 },
  { rank: 4, symbol: "PRECWIRE", closePaise: rupees(496.5), upsideLowPct: 15, upsideHighPct: 30 },
  { rank: 5, symbol: "GPPL", closePaise: rupees(163.67), upsideLowPct: 15, upsideHighPct: 28 },
  { rank: 6, symbol: "USHAMART", closePaise: rupees(523.5), upsideLowPct: 10, upsideHighPct: 20 },
];

describe("allocate", () => {
  it("reproduces the 24 Sep 2026 ₹1,00,000 golden plan exactly", () => {
    const plan = allocate({ passed: SEP24, bucketPaise: rupees(100_000), depth: 12 });

    expect(plan.positions.map((p) => [p.symbol, p.limitPaise, p.qty, p.amountPaise])).toEqual([
      ["ELLEN", rupees(366.4), 58, rupees(21_251.2)],
      ["KMEW", rupees(3000.4), 6, rupees(18_002.4)],
      ["MARKSANS", rupees(347.65), 51, rupees(17_730.15)],
      ["PRECWIRE", rupees(503.9), 32, rupees(16_124.8)],
      ["GPPL", rupees(166.1), 92, rupees(15_281.2)],
      ["USHAMART", rupees(531.35), 20, rupees(10_627.0)],
    ]);
    expect(plan.totals.shares).toBe(259);
    expect(plan.totals.committedPaise).toBe(rupees(99_016.75));
    expect(plan.totals.unspentPaise).toBe(rupees(983.25));
    expect(plan.deferred).toEqual([]);
  });
});

describe("buyLimitPaise", () => {
  it("rounds close × 1.015 down to max(₹0.05, NSE band tick)", () => {
    // Below ₹250 the NSE tick is ₹0.01, but ₹0.05 is the floor (ADR 0003): 166.125 → 166.10
    expect(buyLimitPaise(rupees(163.67))).toBe(rupees(166.1));
    // ₹1,000–5,000 band: ₹0.10 tick. 1253.0885 → 1253.00
    expect(buyLimitPaise(rupees(1234.57))).toBe(rupees(1253.0));
    // ₹5,000–10,000 band: ₹0.50 tick. 6090.335 → 6090.00
    expect(buyLimitPaise(rupees(6000.33))).toBe(rupees(6090.0));
    // ₹10,000–20,000 band: ₹1 tick. 12530.175 → 12530
    expect(buyLimitPaise(rupees(12_345))).toBe(rupees(12_530));
    // ₹20,000+ band: ₹5 tick. 25375.558 → 25375
    expect(buyLimitPaise(rupees(25_000.55))).toBe(rupees(25_375));
  });

  it("uses the higher band when the markup crosses a band edge", () => {
    // close 990 is in the ₹0.05 band but the limit 1004.85 is in the ₹0.10 band → 1004.80
    expect(buyLimitPaise(rupees(990))).toBe(rupees(1004.8));
  });
});

const cand = (rank: number, symbol: string, close: number, low: number, high: number): AllocCandidate => ({
  rank,
  symbol,
  closePaise: rupees(close),
  upsideLowPct: low,
  upsideHighPct: high,
});

describe("feasibility (one share at limit ≤ 1.5 × target allocation)", () => {
  it("defers an unaffordable name with a reason and backfills from deeper in the ranking", () => {
    // ₹5,000 bucket, depth 4. EXPN's target is 10/100 × 5,000 = ₹500, but one share is ₹2,030.
    const passed = [
      cand(1, "AAA", 100, 20, 40),
      cand(2, "EXPN", 2000, 10, 10),
      cand(3, "CCC", 100, 20, 40),
      cand(4, "DDD", 100, 20, 40),
      cand(5, "EEE", 100, 20, 40),
    ];
    const plan = allocate({ passed, bucketPaise: rupees(5000), depth: 4 });

    expect(plan.positions.map((p) => p.symbol)).toEqual(["AAA", "CCC", "DDD", "EEE"]);
    expect(plan.deferred).toEqual([
      {
        rank: 2,
        symbol: "EXPN",
        limitPaise: rupees(2030),
        reason: "one share costs more than 1.5× its allocation at this bucket",
      },
    ]);
  });

  it("never re-offers a deferred name, so swaps cannot loop", () => {
    // Depth 2. {BIGX, YYY}: BIGX fails → {YYY, BIGZ}: BIGZ fails. Re-offering BIGX here would
    // swap forever; instead YYY stands alone with both big names deferred.
    const passed = [cand(1, "BIGX", 9000, 10, 10), cand(2, "YYY", 100, 30, 50), cand(3, "BIGZ", 9000, 10, 10)];
    const plan = allocate({ passed, bucketPaise: rupees(10_000), depth: 2 });

    expect(plan.positions.map((p) => p.symbol)).toEqual(["YYY"]);
    expect(plan.deferred.map((d) => d.symbol)).toEqual(["BIGX", "BIGZ"]);
  });
});

describe("integer solve", () => {
  it("shaves an over-bucket seed by deferring the most-overweight name and re-targets the rest", () => {
    // ₹1,000, depth 2, equal midpoints → targets ₹500 each. HEAVY passes 1.5× (₹710.50 ≤ ₹750)
    // but seeds at 1 share; with LITE's 4 × ₹101.50 the seed is ₹1,116.50 > bucket.
    // HEAVY is furthest above target, so it is shaved out; LITE is re-targeted to 100%.
    const passed = [cand(1, "HEAVY", 700, 20, 40), cand(2, "LITE", 100, 20, 40)];
    const plan = allocate({ passed, bucketPaise: rupees(1000), depth: 2 });

    expect(plan.positions.map((p) => [p.symbol, p.qty])).toEqual([["LITE", 9]]);
    expect(plan.totals.committedPaise).toBe(rupees(913.5));
    expect(plan.deferred).toEqual([
      { rank: 1, symbol: "HEAVY", limitPaise: rupees(710.5), reason: "couldn't fit at this bucket" },
    ]);
  });
});

describe("integer solve: greedy add", () => {
  it("adds a share to the most-underweight name only while it fits and reduces its error", () => {
    // ₹1,000; targets 75% / 25%. Seeds: AAA 73 × ₹10.15 = ₹740.95, BBB 8 × ₹30.45 = ₹243.60 → ₹984.55.
    // AAA's 74th share (₹751.10, error 0.0011 < 0.00905) fits in the ₹15.45 left; BBB's doesn't.
    const passed = [cand(1, "AAA", 10, 20, 40), cand(2, "BBB", 30, 5, 15)];
    const plan = allocate({ passed, bucketPaise: rupees(1000), depth: 2 });

    expect(plan.positions.map((p) => [p.symbol, p.qty])).toEqual([["AAA", 74], ["BBB", 8]]);
    expect(plan.totals.committedPaise).toBe(rupees(994.7));
  });
});

describe("plan totals", () => {
  it("reports weight error and weighted upside for the golden plan", () => {
    const plan = allocate({ passed: SEP24, bucketPaise: rupees(100_000), depth: 12 });
    // Worked from the spec's golden table: weight = amount ÷ ₹1,00,000, target = mid ÷ 140.5.
    expect(plan.totals.meanAbsWeightError).toBeCloseTo(0.0020073, 6);
    expect(plan.totals.worstAbsWeightError).toBeCloseTo(0.0085881, 6);
    expect(plan.totals.weightedUpsideMidPct).toBeCloseTo(24.3253, 3);
  });

  it("reports N of M names and never pads when fewer pass than the depth", () => {
    const passed = [cand(1, "AAA", 100, 20, 40), cand(2, "BBB", 100, 10, 20)];
    const plan = allocate({ passed, bucketPaise: rupees(5000), depth: 4 });

    expect(plan.positions.map((p) => p.symbol)).toEqual(["AAA", "BBB"]);
    expect(plan.names).toEqual({ selected: 2, depth: 4 });
  });

  it("returns an empty plan when nothing passed", () => {
    const plan = allocate({ passed: [], bucketPaise: rupees(5000), depth: 4 });
    expect(plan.positions).toEqual([]);
    expect(plan.totals).toMatchObject({ shares: 0, committedPaise: 0, unspentPaise: rupees(5000) });
    expect(plan.names).toEqual({ selected: 0, depth: 4 });
  });
});

describe("depthForBucket", () => {
  it("maps each bucket to its depth", () => {
    expect([5_000, 10_000, 20_000, 50_000, 100_000, 200_000].map((r) => depthForBucket(rupees(r)))).toEqual([
      4, 6, 8, 10, 12, 14,
    ]);
  });

  it("rejects amounts that are not a bucket", () => {
    expect(() => depthForBucket(rupees(7_500))).toThrow();
  });
});
