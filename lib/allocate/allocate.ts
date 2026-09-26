// Basket allocation (spec §6b). Pure and deterministic; all money in integer paise.
// Weight is measured against the bucket (qty × limit ÷ bucket), which is what reproduces the
// hand-run golden plan. See CONTEXT.md for vocabulary.

import { bandTickPaise, MIN_TICK_PAISE } from "./tick";

export type AllocCandidate = {
  rank: number;
  symbol: string;
  closePaise: number;
  upsideLowPct: number;
  upsideHighPct: number;
};

export type AllocateInput = {
  /** Candidates that passed the checks, in rank order. */
  passed: AllocCandidate[];
  bucketPaise: number;
  depth: number;
};

export type Position = {
  rank: number;
  symbol: string;
  closePaise: number;
  limitPaise: number;
  qty: number;
  amountPaise: number;
  upsideMidPct: number;
  targetWeight: number;
  weight: number;
};

export type Deferred = {
  rank: number;
  symbol: string;
  limitPaise: number;
  reason: string;
};

export const DEFERRED_UNAFFORDABLE = "one share costs more than 1.5× its allocation at this bucket";
export const DEFERRED_NO_FIT = "couldn't fit at this bucket";

export type AllocationResult = {
  positions: Position[];
  deferred: Deferred[];
  totals: {
    shares: number;
    committedPaise: number;
    unspentPaise: number;
  };
};

const LIMIT_MARKUP_PER_MILLE = 1015;

/** close × 1.015, rounded down to max(₹0.05, NSE band tick). */
export function buyLimitPaise(closePaise: number): number {
  const scaled = closePaise * LIMIT_MARKUP_PER_MILLE; // exact integer, paise × 1000
  const tick = Math.max(MIN_TICK_PAISE, bandTickPaise(closePaise), bandTickPaise(scaled / 1000));
  // A single correctly-rounded division of exact integers: floors cleanly on exact multiples.
  return Math.floor(scaled / (1000 * tick)) * tick;
}

const FEASIBILITY_MULTIPLE = 1.5;

type Leg = { c: AllocCandidate; limitPaise: number; upsideMidPct: number; targetWeight: number };

const upsideMid = (c: AllocCandidate) => (c.upsideLowPct + c.upsideHighPct) / 2;

/** Target weights for a selected set: each name's upside midpoint ÷ the set's sum. */
function withTargets(selected: AllocCandidate[]): Leg[] {
  const midSum = selected.reduce((sum, c) => sum + upsideMid(c), 0);
  return selected.map((c) => ({
    c,
    limitPaise: buyLimitPaise(c.closePaise),
    upsideMidPct: upsideMid(c),
    targetWeight: midSum > 0 ? upsideMid(c) / midSum : 0,
  }));
}

type Sized = Leg & { qty: number };

type Rejections = { rejected: Set<string>; deferred: Deferred[] };

function reject(r: Rejections, leg: Leg, reason: string) {
  r.rejected.add(leg.c.symbol);
  r.deferred.push({ rank: leg.c.rank, symbol: leg.c.symbol, limitPaise: leg.limitPaise, reason });
}

/**
 * Fixed point: take the top `depth` names not yet rejected; if any fails the 1.5× test,
 * reject the single worst (highest one-share cost ÷ target), recompute targets and repeat.
 * Rejected names are never re-offered, so the loop always terminates.
 */
function selectFeasible(passed: AllocCandidate[], bucketPaise: number, depth: number, r: Rejections): Leg[] {
  for (;;) {
    const legs = withTargets(passed.filter((c) => !r.rejected.has(c.symbol)).slice(0, depth));
    let worst: Leg | undefined;
    let worstRatio = FEASIBILITY_MULTIPLE;
    for (const leg of legs) {
      const ratio = leg.limitPaise / (leg.targetWeight * bucketPaise);
      if (ratio > worstRatio) {
        worst = leg;
        worstRatio = ratio;
      }
    }
    if (!worst) return legs;
    reject(r, worst, DEFERRED_UNAFFORDABLE);
  }
}

export function allocate({ passed, bucketPaise, depth }: AllocateInput): AllocationResult {
  const r: Rejections = { rejected: new Set(), deferred: [] };
  const weightOf = (qty: number, limitPaise: number) => (qty * limitPaise) / bucketPaise;
  const total = (legs: Sized[]) => legs.reduce((sum, l) => sum + l.qty * l.limitPaise, 0);

  let legs: Sized[];
  solve: for (;;) {
    legs = selectFeasible(passed, bucketPaise, depth, r).map((leg) => ({
      ...leg,
      qty: Math.max(1, Math.floor((leg.targetWeight * bucketPaise) / leg.limitPaise)),
    }));

    // Shave: while over the bucket, take a share from the leg furthest above its target
    // (ties → better rank). Seeds are floored, so only 1-share seeds can be overweight:
    // shaving one to zero defers the name and re-runs selection with fresh targets.
    while (total(legs) > bucketPaise) {
      let worst: Sized | undefined;
      let worstExcess = -Infinity;
      for (const leg of legs) {
        const excess = weightOf(leg.qty, leg.limitPaise) - leg.targetWeight;
        if (excess > worstExcess) {
          worst = leg;
          worstExcess = excess;
        }
      }
      if (!worst) break;
      if (worst.qty === 1) {
        reject(r, worst, DEFERRED_NO_FIT);
        continue solve;
      }
      worst.qty -= 1;
    }
    break;
  }

  // Greedy add: one share to the most-underweight leg, while it fits and reduces its error.
  for (;;) {
    const room = bucketPaise - total(legs);
    let best: Sized | undefined;
    let bestGap = -Infinity;
    for (const leg of legs) {
      if (leg.limitPaise > room) continue;
      const now = Math.abs(weightOf(leg.qty, leg.limitPaise) - leg.targetWeight);
      const after = Math.abs(weightOf(leg.qty + 1, leg.limitPaise) - leg.targetWeight);
      if (after >= now) continue;
      const gap = leg.targetWeight - weightOf(leg.qty, leg.limitPaise);
      if (gap > bestGap) {
        best = leg;
        bestGap = gap;
      }
    }
    if (!best) break;
    best.qty += 1;
  }

  const positions: Position[] = legs.map((l) => ({
    rank: l.c.rank,
    symbol: l.c.symbol,
    closePaise: l.c.closePaise,
    limitPaise: l.limitPaise,
    qty: l.qty,
    amountPaise: l.qty * l.limitPaise,
    upsideMidPct: l.upsideMidPct,
    targetWeight: l.targetWeight,
    weight: weightOf(l.qty, l.limitPaise),
  }));
  const committedPaise = total(legs);
  return {
    positions,
    deferred: r.deferred,
    totals: {
      shares: positions.reduce((s, p) => s + p.qty, 0),
      committedPaise,
      unspentPaise: bucketPaise - committedPaise,
    },
  };
}
