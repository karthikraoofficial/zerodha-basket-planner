// Basket allocation (spec §6b). Pure and deterministic; all money in integer paise.
// Weight is measured against the bucket (qty × limit ÷ bucket), which is what reproduces the
// hand-run golden plan. See CONTEXT.md for vocabulary.

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

export type AllocationResult = {
  positions: Position[];
  deferred: never[];
  totals: {
    shares: number;
    committedPaise: number;
    unspentPaise: number;
  };
};

const LIMIT_MARKUP_PER_MILLE = 1015;

export function buyLimitPaise(closePaise: number): number {
  const tick = 5;
  return Math.floor((closePaise * LIMIT_MARKUP_PER_MILLE) / (1000 * tick)) * tick;
}

export function allocate({ passed, bucketPaise, depth }: AllocateInput): AllocationResult {
  const selected = passed.slice(0, depth);
  const mids = selected.map((c) => (c.upsideLowPct + c.upsideHighPct) / 2);
  const midSum = mids.reduce((a, b) => a + b, 0);

  const legs = selected.map((c, i) => {
    const limitPaise = buyLimitPaise(c.closePaise);
    const targetWeight = mids[i]! / midSum;
    const qty = Math.max(1, Math.floor((targetWeight * bucketPaise) / limitPaise));
    return { c, limitPaise, targetWeight, upsideMidPct: mids[i]!, qty };
  });

  const total = () => legs.reduce((sum, l) => sum + l.qty * l.limitPaise, 0);
  const weightOf = (qty: number, limitPaise: number) => (qty * limitPaise) / bucketPaise;

  // Greedy add: one share to the most-underweight leg, while it fits and reduces its error.
  for (;;) {
    const room = bucketPaise - total();
    let best: (typeof legs)[number] | undefined;
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
  const committedPaise = total();
  return {
    positions,
    deferred: [],
    totals: {
      shares: positions.reduce((s, p) => s + p.qty, 0),
      committedPaise,
      unspentPaise: bucketPaise - committedPaise,
    },
  };
}
