import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadList } from "./list";

const ist = (s: string) => new Date(`${s}+05:30`);
const FRI_NOON = ist("2026-09-25T12:00:00");

function candidate(rank: number, symbol: string, extra: Record<string, unknown> = {}) {
  return {
    rank,
    symbol,
    exchange: "NSE",
    name: `${symbol} Ltd`,
    upside_low_pct: 15,
    upside_high_pct: 30,
    rationale: "sample",
    flags: [],
    ...extra,
  };
}

function listFile(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 2,
    screen_date: "2026-09-24",
    generated_at: "2026-09-24T07:40:00Z",
    horizons: { "6-12m": { candidates: [candidate(1, "ELLEN"), candidate(2, "KMEW")] } },
    ...overrides,
  };
}

function writeTemp(content: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "list-")), "latest.json");
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
}

describe("loadList", () => {
  it("loads a valid list and reports which horizons it covers", () => {
    const result = loadList(writeTemp(listFile()), FRI_NOON);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.list.screenDate).toBe("2026-09-24");
    expect(result.list.horizons["6-12m"]?.map((c) => c.symbol)).toEqual(["ELLEN", "KMEW"]);
    expect(result.availableHorizons).toEqual(["6-12m"]);
    expect(result.tradingDaysOld).toBe(1);
  });

  it("reports a missing file", () => {
    expect(loadList(join(tmpdir(), "definitely-not-here", "latest.json"), FRI_NOON).status).toBe("missing");
  });

  it.each([
    ["malformed JSON", "{ not json"],
    ["wrong schema version", listFile({ schema_version: 1 })],
    ["duplicate symbols", listFile({ horizons: { "3-6m": { candidates: [candidate(1, "A"), candidate(2, "A")] } } })],
    ["ranks not 1..n", listFile({ horizons: { "3-6m": { candidates: [candidate(1, "A"), candidate(3, "B")] } } })],
    ["upside low > high", listFile({ horizons: { "3-6m": { candidates: [candidate(1, "A", { upside_low_pct: 40 })] } } })],
    ["unknown horizon", listFile({ horizons: { "1-2m": { candidates: [candidate(1, "A")] } } })],
    ["no horizons", listFile({ horizons: {} })],
  ])("rejects %s as invalid", (_label, content) => {
    const result = loadList(writeTemp(content), FRI_NOON);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects a list containing a non-NSE symbol", () => {
    const bse = listFile({ horizons: { "3-6m": { candidates: [candidate(1, "A"), candidate(2, "B", { exchange: "BSE" })] } } });
    const result = loadList(writeTemp(bse), FRI_NOON);
    expect(result.status).toBe("non-nse");
    if (result.status === "non-nse") expect(result.symbols).toEqual(["B"]);
  });

  it("marks the list stale when it is more than 2 trading days old", () => {
    const path = writeTemp(listFile()); // screened Thu 24 Sep
    expect(loadList(path, ist("2026-09-28T10:00:00")).status).toBe("ok"); // Mon: 2 days (Fri, Mon)
    const stale = loadList(path, ist("2026-09-29T10:00:00")); // Tue: 3 days
    expect(stale.status).toBe("stale");
    if (stale.status === "stale") expect(stale.tradingDaysOld).toBe(3);
  });

  it("warns (without failing) when a horizon has fewer than 14 names to backfill from", () => {
    const result = loadList(writeTemp(listFile()), FRI_NOON);
    expect(result.status === "ok" && result.warnings).toEqual(["6-12m has only 2 names (14 recommended for backfill)"]);
  });
});

describe("parseListText (pasted lists)", () => {
  it("gives the same result as loading the file", async () => {
    const { parseListText } = await import("./list");
    const text = JSON.stringify(listFile());
    expect(parseListText(text, FRI_NOON)).toEqual(loadList(writeTemp(text), FRI_NOON));
  });

  it("rejects a screen date in the future", async () => {
    const { parseListText } = await import("./list");
    const result = parseListText(JSON.stringify(listFile({ screen_date: "2026-09-28" })), FRI_NOON);
    expect(result).toEqual({ status: "invalid", issues: ["screen_date: 2026-09-28 is after today (2026-09-25)"] });
  });
});
