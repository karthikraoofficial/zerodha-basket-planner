// Chart geometry: turns a Plan into display data for the plan dashboard. Percentages here are for
// drawing only and never feed back into money math (ADR 0005).
import type { Plan, PlanCheckRow } from "./build";

/** How many positions get their own segment before the rest are grouped as "others". */
export const NAMED_SEGMENTS = 4;

export type AllocationSegment = { symbol: string; name: string; amountPaise: number; weight: number; pct: number };
export type Allocation = {
  named: AllocationSegment[];
  others: { count: number; amountPaise: number; weight: number; pct: number } | null;
};

/** The basket's composition: the heaviest positions by amount, then everything else, as % of committed. */
export function allocation(plan: Plan): Allocation {
  const committed = plan.positions.reduce((s, p) => s + p.amountPaise, 0);
  const pct = (paise: number) => (committed ? (paise / committed) * 100 : 0);
  const sorted = [...plan.positions].sort((a, b) => b.amountPaise - a.amountPaise || a.rank - b.rank);
  const named = sorted.slice(0, NAMED_SEGMENTS).map((p) => ({
    symbol: p.symbol,
    name: p.name,
    amountPaise: p.amountPaise,
    weight: p.weight,
    pct: pct(p.amountPaise),
  }));
  const rest = sorted.slice(NAMED_SEGMENTS);
  const restPaise = rest.reduce((s, p) => s + p.amountPaise, 0);
  return {
    named,
    others: rest.length
      ? { count: rest.length, amountPaise: restPaise, weight: rest.reduce((s, p) => s + p.weight, 0), pct: pct(restPaise) }
      : null,
  };
}

export type BucketBar = {
  committedPct: number;
  unspentPct: number;
  /** Available cash as % of the bucket, clamped to 100 (see cashOverBucket). */
  cashPct: number;
  cashOverBucket: boolean;
  /** Cash won't cover the amount committed at limits. */
  short: boolean;
};

/** The bucket as committed + unspent, with a marker for available cash. */
export function bucketBar(plan: Plan): BucketBar {
  const pct = (paise: number) => (plan.bucketPaise ? (paise / plan.bucketPaise) * 100 : 0);
  return {
    committedPct: pct(plan.totals.committedPaise),
    unspentPct: pct(plan.totals.unspentPaise),
    cashPct: Math.min(100, pct(plan.cash.availablePaise)),
    cashOverBucket: plan.cash.availablePaise > plan.bucketPaise,
    short: plan.cash.shortByPaise > 0,
  };
}

export type ChecksGroupKey = "in-plan" | "beyond-depth" | "deferred" | "excluded" | "other";
export type ChecksSummary = { total: number; groups: { key: ChecksGroupKey; label: string; count: number }[] };

const GROUPS: { key: ChecksGroupKey; label: string }[] = [
  { key: "in-plan", label: "In plan" },
  { key: "beyond-depth", label: "Passed, beyond depth" },
  { key: "deferred", label: "Deferred" },
  { key: "excluded", label: "Excluded" },
  { key: "other", label: "No data / not tradable" },
];

function group(row: PlanCheckRow, inPlan: Set<string>): ChecksGroupKey {
  if (row.status === "pass") return inPlan.has(row.symbol) ? "in-plan" : "beyond-depth";
  if (row.status === "deferred" || row.status === "excluded") return row.status;
  return "other";
}

/** Every candidate in the horizon, counted by where it ended up. Groups are always in funnel order. */
export function checksSummary(rows: PlanCheckRow[], inPlan: Set<string>): ChecksSummary {
  const counts = new Map<ChecksGroupKey, number>();
  for (const row of rows) {
    const key = group(row, inPlan);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { total: rows.length, groups: GROUPS.map((g) => ({ ...g, count: counts.get(g.key) ?? 0 })) };
}
