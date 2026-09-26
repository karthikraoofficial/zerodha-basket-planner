import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPricesFile, parseBhavcopy } from "./bhavcopy";

const SAMPLE = readFileSync(join(import.meta.dirname, "../../tests/fixtures/bhavcopy-20260924-sample.csv"), "utf8");

describe("parseBhavcopy (NSE UDiFF CM bhavcopy)", () => {
  it("reads symbol, series, close, volume and traded value from a real 24 Sep 2026 file", () => {
    const day = parseBhavcopy(SAMPLE);
    expect(day.date).toBe("2026-09-24");
    expect(day.rows.get("ELLEN")).toEqual({ series: "EQ", close: 357.7, volume: 1_000_879, tradedValue: 361_617_253.5 });
    expect(day.rows.get("KMEW")).toEqual({ series: "EQ", close: 2890.6, volume: 62_583, tradedValue: 183_194_491.6 });
    expect(day.rows.get("AAKAAR")?.series).toBe("SM");
    expect(day.rows.get("3IINFOLTD")?.series).toBe("BE");
  });

  it("keeps the EQ row when a symbol trades in several series", () => {
    const [header, eqRow] = SAMPLE.split(/\r?\n/);
    const blRow = eqRow!.replace(",ELLEN,EQ,", ",ELLEN,BL,").replace(",357.70,", ",999.00,");
    const day = parseBhavcopy([header, blRow, eqRow].join("\n"));
    expect(day.rows.get("ELLEN")).toMatchObject({ series: "EQ", close: 357.7 });
  });

  it("rejects a file that is not a CM bhavcopy", () => {
    expect(() => parseBhavcopy("a,b,c\n1,2,3")).toThrow(/bhavcopy/);
  });
});

describe("buildPricesFile", () => {
  const day = (date: string, rows: [string, number][]) => ({
    date,
    rows: new Map(rows.map(([s, close]) => [s, { series: "EQ", close, volume: 10, tradedValue: close * 10 }])),
  });

  it("aligns each symbol's history to the sessions, with gaps where it did not trade", () => {
    const file = buildPricesFile(
      [day("2026-09-23", [["AAA", 11]]), day("2026-09-22", [["AAA", 10], ["BBB", 5]]), day("2026-09-24", [["AAA", 12], ["BBB", 6]])],
      ["AAA", "BBB", "ZZZ"],
    );
    expect(file).toEqual({
      schema_version: 1,
      as_of: "2026-09-24",
      sessions: ["2026-09-22", "2026-09-23", "2026-09-24"],
      symbols: {
        AAA: { series: "EQ", close: [10, 11, 12], volume: [10, 10, 10], traded_value: [100, 110, 120] },
        BBB: { series: "EQ", close: [5, null, 6], volume: [10, null, 10], traded_value: [50, null, 60] },
        ZZZ: { missing: true },
      },
    });
  });
});
