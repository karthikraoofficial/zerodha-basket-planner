// Candidate checks (spec §6a, adapted to NSE end-of-day data; see ADR 0002).
// One row per candidate, in rank order, with a status and a human-readable reason.
import type { Candidate } from "../data/list";
import type { Prices } from "../data/prices";

export type CheckStatus = "pass" | "excluded" | "insufficient" | "not-tradable" | "data-error";

export type CheckRow = {
  rank: number;
  symbol: string;
  name: string;
  status: CheckStatus;
  /** Empty for a pass. */
  reason: string;
  /** Last close in rupees, when there is one. */
  close?: number;
};

export const MIN_SESSIONS = 50;

export function evaluateCandidates(candidates: Candidate[], prices: Prices): CheckRow[] {
  return candidates.map((c) => {
    const base = { rank: c.rank, symbol: c.symbol, name: c.name };
    const h = prices.symbols[c.symbol];
    if (!h || "missing" in h) return { ...base, status: "data-error", reason: "no NSE price data for this symbol" };

    const lastClose = h.closes.at(-1);
    if (lastClose == null) return { ...base, status: "data-error", reason: `no close on ${prices.asOf}` };
    if (h.series !== "EQ") {
      return { ...base, status: "not-tradable", reason: `series ${h.series} on NSE (only EQ is tradable here)`, close: lastClose };
    }

    const closes = h.closes.filter((x): x is number => x !== null);
    if (closes.length < MIN_SESSIONS) {
      return {
        ...base,
        status: "insufficient",
        reason: `insufficient data: ${closes.length} sessions (${MIN_SESSIONS} needed)`,
        close: lastClose,
      };
    }
    return { ...base, status: "pass", reason: "", close: lastClose };
  });
}
