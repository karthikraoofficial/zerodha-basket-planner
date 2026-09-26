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
  metrics?: TechnicalMetrics;
};

export type TechnicalMetrics = {
  sessions: number;
  ma20: number;
  ma50: number;
  /** MA today − MA 10 sessions ago; null when there is too little history. */
  slope20: number | null;
  slope50: number | null;
  /** % distance of the close from each MA. */
  dist20Pct: number;
  dist50Pct: number;
  /** Median daily traded value over the last 50 sessions, in ₹ crore. */
  medianTradedValueCr: number;
};

export const MIN_SESSIONS = 50;
const SLOPE_LOOKBACK = 10;
const MAX_EXTENSION_PCT = 15;
const MIN_MEDIAN_TRADED_VALUE_CR = 2;
const LIQUIDITY_WINDOW = 50;
const RUPEES_PER_CRORE = 1e7;

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** n-session moving average ending `back` sessions ago, or null without enough history. */
function ma(closes: number[], n: number, back = 0): number | null {
  const end = closes.length - back;
  return end - n < 0 ? null : mean(closes.slice(end - n, end));
}

export function technicalMetrics(closes: number[], tradedValues: number[]): TechnicalMetrics {
  const close = closes.at(-1)!;
  const ma20 = ma(closes, 20)!;
  const ma50 = ma(closes, 50)!;
  const ma20Before = ma(closes, 20, SLOPE_LOOKBACK);
  const ma50Before = ma(closes, 50, SLOPE_LOOKBACK);
  return {
    sessions: closes.length,
    ma20: round(ma20, 4),
    ma50: round(ma50, 4),
    slope20: ma20Before === null ? null : round(ma20 - ma20Before, 4),
    slope50: ma50Before === null ? null : round(ma50 - ma50Before, 4),
    dist20Pct: round(((close - ma20) / ma20) * 100, 2),
    dist50Pct: round(((close - ma50) / ma50) * 100, 2),
    medianTradedValueCr: round(median(tradedValues.slice(-LIQUIDITY_WINDOW)) / RUPEES_PER_CRORE, 4),
  };
}

/** Exclusion reasons (spec §6a.4). "Below" is close < MA; "falling" is MA today < MA 10 sessions ago. */
function exclusions(m: TechnicalMetrics): string[] {
  const reasons: string[] = [];
  if (m.dist20Pct < 0 && m.slope20 !== null && m.slope20 < 0) reasons.push("below falling 20DMA");
  if (m.dist50Pct < 0 && m.slope50 !== null && m.slope50 < 0) reasons.push("below falling 50DMA");
  if (m.dist50Pct > MAX_EXTENSION_PCT) {
    reasons.push(`extended: ${m.dist50Pct.toFixed(1)}% above 50DMA (${MAX_EXTENSION_PCT}% max)`);
  }
  if (m.medianTradedValueCr < MIN_MEDIAN_TRADED_VALUE_CR) {
    reasons.push(`illiquid: median ₹${m.medianTradedValueCr.toFixed(2)} Cr/day (₹${MIN_MEDIAN_TRADED_VALUE_CR} Cr minimum)`);
  }
  return reasons;
}

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
    const tradedValues = h.tradedValues.filter((x): x is number => x !== null);
    const metrics = technicalMetrics(closes, tradedValues);
    const reasons = exclusions(metrics);
    if (reasons.length) return { ...base, status: "excluded", reason: reasons.join("; "), close: lastClose, metrics };
    if (metrics.dist50Pct < 0 && metrics.slope50 === null) {
      return {
        ...base,
        status: "insufficient",
        reason: `below 50DMA; its slope needs ${50 + SLOPE_LOOKBACK} sessions (have ${metrics.sessions})`,
        close: lastClose,
        metrics,
      };
    }
    return { ...base, status: "pass", reason: "", close: lastClose, metrics };
  });
}
