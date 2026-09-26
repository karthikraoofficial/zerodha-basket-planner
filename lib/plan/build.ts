// Step 3: turn today's ranked list, NSE prices and the owner's Kite account into a basket plan.
// Pure apart from the two read-only Kite calls (holdings, equity margins).
import { allocate, depthForBucket, type AllocationResult, type Position } from "../allocate/allocate";
import { evaluateCandidates, type CheckRow, type CheckStatus } from "../checks/evaluate";
import type { Horizon, LoadListResult } from "../data/list";
import type { LoadPricesResult } from "../data/prices";
import { KiteSessionError, type KiteAccount } from "../kite/client";

export type PlanCheckRow = Omit<CheckRow, "status"> & { status: CheckStatus | "deferred" };

export type PlanPosition = Position & {
  name: string;
  rationale: string;
  flags: string[];
  upsideLowPct: number;
  upsideHighPct: number;
  holding?: { quantity: number; t1Quantity: number; averagePricePaise: number };
};

export type Plan = {
  screenDate: string;
  pricesAsOf: string;
  pricesStale: boolean;
  horizon: Horizon;
  bucketPaise: number;
  positions: PlanPosition[];
  checks: PlanCheckRow[];
  names: AllocationResult["names"];
  totals: AllocationResult["totals"];
  /** shortByPaise > 0 when available cash won't cover the amount committed at limits. */
  cash: { availablePaise: number; shortByPaise: number };
  accountFetchedAt: string;
};

export type BlockReason =
  | "list-missing"
  | "list-invalid"
  | "list-non-nse"
  | "list-stale"
  | "prices-missing"
  | "prices-invalid"
  | "horizon-unavailable";

export type PlanResult =
  | { status: "ok"; plan: Plan }
  | { status: "blocked"; reason: BlockReason; detail?: string[] }
  | { status: "session-expired" };

type Input = {
  account: KiteAccount;
  list: LoadListResult;
  prices: LoadPricesResult;
  bucketPaise: number;
  horizon: Horizon;
  now: Date;
};

const toPaise = (rupees: number) => Math.round(rupees * 100);

export async function buildPlan({ account, list, prices, bucketPaise, horizon, now }: Input): Promise<PlanResult> {
  switch (list.status) {
    case "missing":
      return { status: "blocked", reason: "list-missing" };
    case "invalid":
      return { status: "blocked", reason: "list-invalid", detail: list.issues };
    case "non-nse":
      return { status: "blocked", reason: "list-non-nse", detail: list.symbols };
    case "stale":
      return { status: "blocked", reason: "list-stale", detail: [`${list.tradingDaysOld} trading days old`] };
  }
  if (prices.status === "missing") return { status: "blocked", reason: "prices-missing" };
  if (prices.status === "invalid") return { status: "blocked", reason: "prices-invalid", detail: prices.issues };
  const candidates = list.list.horizons[horizon];
  if (!candidates) return { status: "blocked", reason: "horizon-unavailable" };

  let holdings, margins;
  try {
    [holdings, margins] = await Promise.all([account.holdings(), account.equityMargins()]);
  } catch (e) {
    if (e instanceof KiteSessionError) return { status: "session-expired" };
    throw e;
  }

  const rows = evaluateCandidates(candidates, prices.prices);
  const allocation = allocate({
    passed: rows
      .filter((r) => r.status === "pass")
      .map((r) => {
        const c = candidates.find((x) => x.symbol === r.symbol)!;
        return {
          rank: r.rank,
          symbol: r.symbol,
          closePaise: toPaise(r.close!),
          upsideLowPct: c.upsideLowPct,
          upsideHighPct: c.upsideHighPct,
        };
      }),
    bucketPaise,
    depth: depthForBucket(bucketPaise),
  });

  const deferred = new Map(allocation.deferred.map((d) => [d.symbol, d.reason]));
  const held = new Map(holdings.filter((h) => h.exchange === "NSE").map((h) => [h.symbol, h]));
  const positions: PlanPosition[] = allocation.positions.map((p) => {
    const c = candidates.find((x) => x.symbol === p.symbol)!;
    const h = held.get(p.symbol);
    return {
      ...p,
      name: c.name,
      rationale: c.rationale,
      flags: c.flags,
      upsideLowPct: c.upsideLowPct,
      upsideHighPct: c.upsideHighPct,
      ...(h && {
        holding: { quantity: h.quantity, t1Quantity: h.t1Quantity, averagePricePaise: toPaise(h.averagePrice) },
      }),
    };
  });
  const availablePaise = toPaise(margins.availableCash);

  return {
    status: "ok",
    plan: {
      screenDate: list.list.screenDate,
      pricesAsOf: prices.prices.asOf,
      pricesStale: prices.stale,
      horizon,
      bucketPaise,
      positions,
      checks: rows.map((r) =>
        deferred.has(r.symbol) ? { ...r, status: "deferred" as const, reason: deferred.get(r.symbol)! } : r,
      ),
      names: allocation.names,
      totals: allocation.totals,
      cash: { availablePaise, shortByPaise: Math.max(0, allocation.totals.committedPaise - availablePaise) },
      accountFetchedAt: now.toISOString(),
    },
  };
}
