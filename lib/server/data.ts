import "server-only";
import { join } from "node:path";
import { loadList } from "../data/list";
import { loadPrices } from "../data/prices";

/** The committed data files, validated. Read per request so a redeploy picks up new data. */
export function currentData(now: Date) {
  const dir = join(process.cwd(), "data");
  return { list: loadList(join(dir, "latest.json"), now), prices: loadPrices(join(dir, "prices.json"), now) };
}
