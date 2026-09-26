import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPrices } from "./prices";

const ist = (s: string) => new Date(`${s}+05:30`);
const FRI_NOON = ist("2026-09-25T12:00:00"); // last completed session: Thu 24 Sep

function pricesFile(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    as_of: "2026-09-24",
    sessions: ["2026-09-22", "2026-09-23", "2026-09-24"],
    symbols: {
      ELLEN: { series: "EQ", close: [355.1, null, 361], volume: [1e6, null, 9e5], traded_value: [3.5e8, null, 3.2e8] },
      GONE: { missing: true },
    },
    ...overrides,
  };
}

function writeTemp(content: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "prices-")), "prices.json");
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
}

describe("loadPrices", () => {
  it("loads histories aligned to sessions, keeping no-trade days as gaps", () => {
    const result = loadPrices(writeTemp(pricesFile()), FRI_NOON);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.prices.asOf).toBe("2026-09-24");
    expect(result.prices.symbols.ELLEN).toEqual({
      series: "EQ",
      closes: [355.1, null, 361],
      volumes: [1e6, null, 9e5],
      tradedValues: [3.5e8, null, 3.2e8],
    });
    expect(result.prices.symbols.GONE).toEqual({ missing: true });
    expect(result.stale).toBe(false);
  });

  it("flags prices older than the last completed session as stale", () => {
    const result = loadPrices(writeTemp(pricesFile()), ist("2026-09-25T19:00:00")); // Fri close is out
    expect(result.status === "ok" && result.stale).toBe(true);
  });

  it("reports a missing file", () => {
    expect(loadPrices(join(tmpdir(), "nope", "prices.json"), FRI_NOON).status).toBe("missing");
  });

  it.each([
    ["malformed JSON", "{"],
    ["as_of not the last session", pricesFile({ as_of: "2026-09-23" })],
    ["sessions out of order", pricesFile({ sessions: ["2026-09-23", "2026-09-22", "2026-09-24"] })],
    [
      "a series not aligned to sessions",
      pricesFile({ symbols: { X: { series: "EQ", close: [1, 2], volume: [1, 2], traded_value: [1, 2] } } }),
    ],
    ["negative close", pricesFile({ symbols: { X: { series: "EQ", close: [1, 2, -3], volume: [1, 1, 1], traded_value: [1, 1, 1] } } })],
  ])("rejects %s as invalid", (_label, content) => {
    expect(loadPrices(writeTemp(content), FRI_NOON).status).toBe("invalid");
  });
});
