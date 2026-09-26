// NSE cash-market tick sizes by price band, in paise.
// Source: NSE circular on tick-size revision (effective 2025), summarised at
// https://zerodha.com/marketintel/bulletin/380460/change-in-tick-size-of-nse-stocks-and-fo-contracts-trading-below-250
// The exchange sets each stock's band monthly from the prior month-end close, which we don't
// have, so callers use the larger of the bands for the close and the limit. Ticks nest
// (1 | 5 | 10 | 50 | 100 | 500), so a multiple of the larger tick is valid in either band.
const BANDS: { belowPaise: number; tickPaise: number }[] = [
  { belowPaise: 25_000, tickPaise: 1 },
  { belowPaise: 100_000, tickPaise: 5 },
  { belowPaise: 500_000, tickPaise: 10 },
  { belowPaise: 1_000_000, tickPaise: 50 },
  { belowPaise: 2_000_000, tickPaise: 100 },
];
const TOP_TICK_PAISE = 500;

/** The spec's default tick; never round to anything finer (ADR 0003). */
export const MIN_TICK_PAISE = 5;

export function bandTickPaise(pricePaise: number): number {
  return BANDS.find((b) => pricePaise < b.belowPaise)?.tickPaise ?? TOP_TICK_PAISE;
}
