// Fetch NSE UDiFF bhavcopies for recent sessions and rebuild data/prices.json for every symbol
// in data/latest.json. Raw daily files are cached in .cache/bhavcopy (restored by actions/cache),
// so steady state downloads one file per day. Writes the prices file only when it changes.
//
//   npx tsx scripts/fetch-prices.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { isTradingDay, lastCompletedSession, previousTradingDay } from "../lib/data/calendar";
import { loadList } from "../lib/data/list";
import { buildPricesFile, parseBhavcopy, type BhavDay } from "../lib/prices/bhavcopy";

const ROOT = join(import.meta.dirname, "..");
const CACHE = join(ROOT, ".cache", "bhavcopy");
const SESSIONS = 75; // 50DMA + 10-session slope + headroom
const MIN_SESSIONS = 60;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  Accept: "application/zip,application/octet-stream,*/*",
  Referer: "https://www.nseindia.com/all-reports",
};

const url = (date: string) =>
  `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${date.replaceAll("-", "")}_F_0000.csv.zip`;

/** The CSV for a session, from cache or NSE; null when NSE has no file for it (404). */
async function bhavcopyCsv(date: string): Promise<string | null> {
  const cached = join(CACHE, `${date}.csv`);
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url(date), { headers: HEADERS });
    if (res.status === 404) return null;
    if (res.ok) {
      const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
      const csv = strFromU8(Object.values(files)[0]!);
      writeFileSync(cached, csv);
      return csv;
    }
    if (attempt >= 4) throw new Error(`NSE returned HTTP ${res.status} for ${date} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

async function main() {
  const now = new Date();
  const list = loadList(join(ROOT, "data", "latest.json"), now);
  if (list.status !== "ok" && list.status !== "stale") throw new Error(`data/latest.json is ${list.status}`);
  const symbols = Object.values(list.list.horizons).flatMap((cs) => cs.map((c) => c.symbol));

  mkdirSync(CACHE, { recursive: true });
  const days: BhavDay[] = [];
  const unavailable: string[] = [];
  // Walk back from the last completed session. Allow a few extra days for files NSE doesn't have.
  let date = lastCompletedSession(now);
  for (let tries = 0; days.length < SESSIONS && tries < SESSIONS + 10; tries++, date = previousTradingDay(date)) {
    if (!isTradingDay(date)) continue;
    const csv = await bhavcopyCsv(date);
    if (csv === null) unavailable.push(date);
    else days.push(parseBhavcopy(csv));
  }
  if (days.length < MIN_SESSIONS) throw new Error(`Only ${days.length} sessions available (need ${MIN_SESSIONS})`);

  const file = buildPricesFile(days, symbols);
  const out = join(ROOT, "data", "prices.json");
  const next = JSON.stringify(file) + "\n";
  const changed = !existsSync(out) || readFileSync(out, "utf8") !== next;
  if (changed) writeFileSync(out, next);

  const missing = Object.entries(file.symbols).filter(([, h]) => "missing" in h).map(([s]) => s);
  console.log(`prices: ${days.length} sessions to ${file.as_of}, ${symbols.length} symbols, ${changed ? "updated" : "unchanged"}`);
  if (unavailable.length) console.log(`prices: NSE had no file for ${unavailable.join(", ")}`);
  if (missing.length) console.warn(`prices: not in any bhavcopy: ${missing.join(", ")}`);
}

main().catch((e) => {
  console.error(`fetch-prices failed: ${(e as Error).message}`);
  process.exit(1);
});
