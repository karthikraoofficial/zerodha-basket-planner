// Plan → CSV (download) and TSV (clipboard). Amounts in rupees with 2 decimals, no grouping,
// so spreadsheets read them as numbers.
import type { Plan } from "./build";

const HEADER = ["Rank", "Symbol", "Name", "Close", "Buy limit", "Qty", "Amount", "Weight %", "Target %", "Upside low %", "Upside high %"];

const rupees = (paise: number) => (paise / 100).toFixed(2);
const pct = (x: number) => (x * 100).toFixed(2);

function rows(plan: Plan): string[][] {
  const blank = (n: number) => Array<string>(n).fill("");
  return [
    HEADER,
    ...plan.positions.map((p) => [
      String(p.rank),
      p.symbol,
      p.name,
      rupees(p.closePaise),
      rupees(p.limitPaise),
      String(p.qty),
      rupees(p.amountPaise),
      pct(p.weight),
      pct(p.targetWeight),
      String(p.upsideLowPct),
      String(p.upsideHighPct),
    ]),
    ["Total", ...blank(4), String(plan.totals.shares), rupees(plan.totals.committedPaise), ...blank(4)],
    ["Unspent", ...blank(5), rupees(plan.totals.unspentPaise), ...blank(4)],
  ];
}

const csvField = (f: string) => (/[",\n]/.test(f) ? `"${f.replaceAll('"', '""')}"` : f);

export function planToCsv(plan: Plan): string {
  return rows(plan).map((r) => r.map(csvField).join(",")).join("\n") + "\n";
}

export function planToTsv(plan: Plan): string {
  return rows(plan)
    .map((r) => r.map((f) => f.replaceAll(/[\t\n]/g, " ")).join("\t"))
    .join("\n");
}
