// Build gate for the committed data files. Invalid data fails the build; staleness only warns,
// because the runtime blocks Step 3 on a stale list anyway.
import { join } from "node:path";
import { loadList } from "./list";
import { loadPrices } from "./prices";

export function validateDataFiles(dir: string, now: Date): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const list = loadList(join(dir, "latest.json"), now);
  switch (list.status) {
    case "missing":
      errors.push("latest.json: file is missing");
      break;
    case "invalid":
      errors.push(...list.issues.map((i) => `latest.json: ${i}`));
      break;
    case "non-nse":
      errors.push(`latest.json: non-NSE symbols ${list.symbols.join(", ")}`);
      break;
    case "stale":
      warnings.push(`latest.json: list is stale (${list.tradingDaysOld} trading days old)`);
      break;
    case "ok":
      warnings.push(...list.warnings.map((w) => `latest.json: ${w}`));
  }

  const prices = loadPrices(join(dir, "prices.json"), now);
  if (prices.status === "missing") errors.push("prices.json: file is missing");
  if (prices.status === "invalid") errors.push(...prices.issues.map((i) => `prices.json: ${i}`));
  if (prices.status === "ok" && prices.stale) {
    warnings.push(`prices.json: prices are stale (as of ${prices.prices.asOf}, last session ${prices.lastCompletedSession})`);
  }

  if ((list.status === "ok" || list.status === "stale") && prices.status === "ok") {
    const symbols = new Set(Object.values(list.list.horizons).flatMap((cs) => cs.map((c) => c.symbol)));
    for (const s of symbols) {
      if (!prices.prices.symbols[s]) warnings.push(`prices.json: no history for ${s} (it will show as a data error)`);
    }
  }
  return { errors, warnings };
}
