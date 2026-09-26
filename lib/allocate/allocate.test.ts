import { describe, expect, it } from "vitest";
import { allocate, buyLimitPaise, type AllocCandidate } from "./allocate";

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
