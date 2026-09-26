// NSE UDiFF cash-market bhavcopy → the committed prices file (data/prices.json).
// Format reference: https://nsearchives.nseindia.com/content/new_bhavcopy_format_readme.xlsx

export type BhavRow = { series: string; close: number; volume: number; tradedValue: number };
export type BhavDay = { date: string; rows: Map<string, BhavRow> };

const REQUIRED = ["TradDt", "Sgmt", "FinInstrmTp", "TckrSymb", "SctySrs", "ClsPric", "TtlTradgVol", "TtlTrfVal"] as const;

export function parseBhavcopy(csv: string): BhavDay {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = (lines[0] ?? "").split(",");
  const col = Object.fromEntries(REQUIRED.map((name) => [name, header.indexOf(name)])) as Record<
    (typeof REQUIRED)[number],
    number
  >;
  const absent = REQUIRED.filter((name) => col[name] < 0);
  if (absent.length) throw new Error(`Not an NSE UDiFF bhavcopy: missing columns ${absent.join(", ")}`);

  let date = "";
  const rows = new Map<string, BhavRow>();
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    if (f[col.Sgmt] !== "CM" || f[col.FinInstrmTp] !== "STK") continue;
    date ||= f[col.TradDt]!;
    const symbol = f[col.TckrSymb]!;
    const row: BhavRow = {
      series: f[col.SctySrs]!,
      close: Number(f[col.ClsPric]),
      volume: Number(f[col.TtlTradgVol]),
      tradedValue: Number(f[col.TtlTrfVal]),
    };
    // A symbol can trade in several series (e.g. a block-deal window); the EQ row is the one we trade.
    if (!rows.has(symbol) || row.series === "EQ") rows.set(symbol, row);
  }
  if (!date) throw new Error("Not an NSE UDiFF bhavcopy: no CM stock rows");
  return { date, rows };
}

type History = { series: string; close: (number | null)[]; volume: (number | null)[]; traded_value: (number | null)[] };

/** Build the prices file for `symbols` from daily bhavcopies (any order). */
export function buildPricesFile(days: BhavDay[], symbols: string[]) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const sessions = sorted.map((d) => d.date);
  const out: Record<string, History | { missing: true }> = {};
  for (const symbol of [...new Set(symbols)].sort()) {
    const rows = sorted.map((d) => d.rows.get(symbol));
    const latest = rows.findLast((r) => r !== undefined);
    out[symbol] = latest
      ? {
          series: latest.series,
          close: rows.map((r) => r?.close ?? null),
          volume: rows.map((r) => r?.volume ?? null),
          traded_value: rows.map((r) => r?.tradedValue ?? null),
        }
      : { missing: true };
  }
  return { schema_version: 1 as const, as_of: sessions.at(-1)!, sessions, symbols: out };
}
