import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadList } from "../data/list";
import { loadPrices } from "../data/prices";
import { createMockKite } from "../kite/mock";
import { buildPlan } from "./build";
import { planToCsv, planToTsv } from "./export";

const FIXTURES = join(import.meta.dirname, "../../tests/fixtures/data");
const now = new Date("2026-09-25T12:00:00+05:30");

async function goldenPlan() {
  const kite = createMockKite();
  const { accessToken } = await kite.auth.exchangeToken("x");
  const result = await buildPlan({
    account: kite.account(accessToken),
    list: loadList(join(FIXTURES, "latest.json"), now),
    prices: loadPrices(join(FIXTURES, "prices.json"), now),
    bucketPaise: 10_000_000,
    horizon: "6-12m",
    now,
  });
  if (result.status !== "ok") throw new Error(result.status);
  return result.plan;
}

describe("plan export", () => {
  it("writes a CSV with one row per position and a totals row, in rupees", async () => {
    const lines = planToCsv(await goldenPlan()).trimEnd().split("\n");
    expect(lines[0]).toBe("Rank,Symbol,Name,Close,Buy limit,Qty,Amount,Weight %,Target %,Upside low %,Upside high %");
    expect(lines[1]).toBe("1,ELLEN,Ellenbarrie Industrial Gases,361.00,366.40,58,21251.20,21.25,21.35,20,40");
    expect(lines[6]).toMatch(/^6,USHAMART,Usha Martin,523.50,531.35,20,10627.00,/);
    expect(lines[7]).toBe("Total,,,,,259,99016.75,,,,");
    expect(lines[8]).toBe("Unspent,,,,,,983.25,,,,");
  });

  it("quotes fields that contain commas or quotes", async () => {
    const plan = await goldenPlan();
    plan.positions[0]!.name = 'Knowledge Marine & Engineering "KMEW", Ltd';
    expect(planToCsv(plan).split("\n")[1]).toContain('"Knowledge Marine & Engineering ""KMEW"", Ltd"');
  });

  it("copies as tab-separated text for pasting into a sheet", async () => {
    const tsv = planToTsv(await goldenPlan()).split("\n");
    expect(tsv[1]!.split("\t").slice(0, 2)).toEqual(["1", "ELLEN"]);
  });
});
