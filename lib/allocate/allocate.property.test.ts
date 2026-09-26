import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocate, assertWithinBucket, BUCKET_DEPTHS, type AllocCandidate } from "./allocate";

const candidates = fc
  .array(
    fc.record({
      closePaise: fc.integer({ min: 100, max: 3_000_000 }), // ₹1 – ₹30,000
      low: fc.integer({ min: 0, max: 60 }),
      spread: fc.integer({ min: 0, max: 40 }),
    }),
    { maxLength: 22 },
  )
  .map((rows): AllocCandidate[] =>
    rows.map((r, i) => ({
      rank: i + 1,
      symbol: `S${i + 1}`,
      closePaise: r.closePaise,
      upsideLowPct: r.low,
      upsideHighPct: r.low + r.spread,
    })),
  );
const bucket = fc.constantFrom(...BUCKET_DEPTHS.keys());

describe("allocate (properties)", () => {
  it("never exceeds the bucket, respects feasibility and rank order, and is deterministic", () => {
    fc.assert(
      fc.property(candidates, bucket, (passed, bucketPaise) => {
        const depth = BUCKET_DEPTHS.get(bucketPaise)!;
        const plan = allocate({ passed, bucketPaise, depth });

        const committed = plan.positions.reduce((s, p) => s + p.qty * p.limitPaise, 0);
        expect(committed).toBeLessThanOrEqual(bucketPaise);
        expect(plan.totals.committedPaise).toBe(committed);
        expect(plan.positions.length).toBeLessThanOrEqual(depth);

        const ranks = plan.positions.map((p) => p.rank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

        for (const p of plan.positions) {
          expect(p.qty).toBeGreaterThanOrEqual(1);
          expect(p.limitPaise).toBeLessThanOrEqual(1.5 * p.targetWeight * bucketPaise + 1e-6);
        }

        const held = new Set(plan.positions.map((p) => p.symbol));
        for (const d of plan.deferred) expect(held.has(d.symbol)).toBe(false);
        expect(new Set(plan.deferred.map((d) => d.symbol)).size).toBe(plan.deferred.length);

        expect(allocate({ passed, bucketPaise, depth })).toEqual(plan);
      }),
      { numRuns: 500 },
    );
  });
});

describe("assertWithinBucket", () => {
  it("throws when positions at their limits exceed the bucket", () => {
    const over = [{ symbol: "X", qty: 3, limitPaise: 40_000 }];
    expect(() => assertWithinBucket(over, 100_000)).toThrow(/exceeds bucket/);
  });

  it("accepts positions that fit exactly", () => {
    expect(() => assertWithinBucket([{ symbol: "X", qty: 2, limitPaise: 50_000 }], 100_000)).not.toThrow();
  });
});
