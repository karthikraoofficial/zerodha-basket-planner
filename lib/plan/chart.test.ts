import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadList } from "../data/list";
import { loadPrices } from "../data/prices";
import { createMockKite } from "../kite/mock";
import { buildPlan } from "./build";
import { allocation, bucketBar, checksSummary } from "./chart";

const FIXTURES = join(import.meta.dirname, "../../tests/fixtures/data");
const now = new Date("2026-09-25T12:00:00+05:30");

async function goldenPlan() {
  const kite = createMockKite();
  const { accessToken } = await kite.auth.exchangeToken("x");
  const result = await buildPlan({
    account: kite.account(accessToken),
    list: loadList(join(FIXTURES, "latest.json"), now),
    prices: loadPrices(join(FIXTURES, "prices.json"), now),
    bucketPaise: 10_000_000,
    horizon: "6-12m",
    now,
  });
  if (result.status !== "ok") throw new Error(result.status);
  return result.plan;
}

describe("allocation", () => {
  it("names the four heaviest positions and groups the rest as others, as shares of the basket", async () => {
    const { named, others } = allocation(await goldenPlan());
    expect(named).toHaveLength(4);
    // ELLEN: ₹21,251.20 of ₹99,016.75 committed.
    expect(named[0]).toMatchObject({ symbol: "ELLEN", amountPaise: 2_125_120 });
    expect(named[0]!.pct).toBeCloseTo(21.462, 2);
    expect(others?.count).toBe(2);
    const total = named.reduce((s, x) => s + x.pct, 0) + (others?.pct ?? 0);
    expect(total).toBeCloseTo(100, 9);
  });

  it("has no others segment when there are four names or fewer", async () => {
    const plan = await goldenPlan();
    plan.positions = plan.positions.slice(0, 4);
    const { named, others } = allocation(plan);
    expect(named.map((s) => s.symbol)).toHaveLength(4);
    expect(others).toBeNull();
  });

  it("gives a single name the whole bar", async () => {
    const plan = await goldenPlan();
    plan.positions = plan.positions.slice(0, 1);
    expect(allocation(plan).named).toEqual([expect.objectContaining({ symbol: "ELLEN", pct: 100 })]);
  });

  it("draws nothing for an empty plan", async () => {
    const plan = await goldenPlan();
    plan.positions = [];
    expect(allocation(plan)).toEqual({ named: [], others: null });
  });
});

describe("bucketBar", () => {
  it("splits the bucket into committed and unspent", async () => {
    // ₹99,016.75 committed of a ₹1,00,000 bucket.
    const bar = bucketBar(await goldenPlan());
    expect(bar.committedPct).toBeCloseTo(99.01675, 9);
    expect(bar.unspentPct).toBeCloseTo(0.98325, 9);
  });

  it("marks cash as a share of the bucket and flags a shortfall", async () => {
    const plan = await goldenPlan();
    plan.cash = { availablePaise: 5_000_000, shortByPaise: 4_901_675 };
    expect(bucketBar(plan)).toMatchObject({ cashPct: 50, cashOverBucket: false, short: true });
  });

  it("clamps the cash marker at the bucket edge when cash exceeds the bucket", async () => {
    const plan = await goldenPlan();
    plan.cash = { availablePaise: 25_000_000, shortByPaise: 0 };
    expect(bucketBar(plan)).toMatchObject({ cashPct: 100, cashOverBucket: true, short: false });
  });

  it("puts cash exactly equal to the bucket at the edge without calling it over", async () => {
    const plan = await goldenPlan();
    plan.cash = { availablePaise: 10_000_000, shortByPaise: 0 };
    expect(bucketBar(plan)).toMatchObject({ cashPct: 100, cashOverBucket: false, short: false });
  });
});

describe("checksSummary", () => {
  it("counts the candidate funnel: in plan, passed beyond depth, deferred, excluded and other", async () => {
    const template = (await goldenPlan()).checks[0]!;
    const statuses = ["pass", "pass", "pass", "deferred", "excluded", "excluded", "insufficient", "not-tradable", "data-error"] as const;
    const rows = statuses.map((status, i) => ({ ...template, rank: i + 1, symbol: `S${i + 1}`, status }));
    const summary = checksSummary(rows, new Set(["S1", "S2"]));
    expect(summary.total).toBe(9);
    expect(summary.groups.map((g) => [g.key, g.count])).toEqual([
      ["in-plan", 2],
      ["beyond-depth", 1],
      ["deferred", 1],
      ["excluded", 2],
      ["other", 3],
    ]);
  });
});
