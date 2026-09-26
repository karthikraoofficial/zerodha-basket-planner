import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDataFiles } from "./validate";

const ist = (s: string) => new Date(`${s}+05:30`);

describe("validateDataFiles (build gate)", () => {
  it("passes the committed sample data", () => {
    const result = validateDataFiles(join(import.meta.dirname, "../../data"), ist("2026-09-25T12:00:00"));
    expect(result.errors).toEqual([]);
  });

  it("does not fail the build for staleness, only warns", () => {
    const result = validateDataFiles(join(import.meta.dirname, "../../data"), ist("2026-10-30T12:00:00"));
    expect(result.errors).toEqual([]);
    expect(result.warnings.join("\n")).toMatch(/stale/);
  });

  it("fails when a data file is missing or invalid", () => {
    const dir = mkdtempSync(join(tmpdir(), "data-"));
    writeFileSync(join(dir, "latest.json"), "{}");
    const result = validateDataFiles(dir, ist("2026-09-25T12:00:00"));
    expect(result.errors.some((e) => e.startsWith("latest.json"))).toBe(true);
    expect(result.errors.some((e) => e.startsWith("prices.json"))).toBe(true);
  });

  it("warns when a listed symbol has no price history", () => {
    const dir = mkdtempSync(join(tmpdir(), "data-"));
    writeFileSync(
      join(dir, "latest.json"),
      JSON.stringify({
        schema_version: 2,
        screen_date: "2026-09-24",
        generated_at: "2026-09-24T07:40:00Z",
        horizons: {
          "3-6m": {
            candidates: [
              { rank: 1, symbol: "NEWCO", exchange: "NSE", name: "New Co", upside_low_pct: 10, upside_high_pct: 20, rationale: "", flags: [] },
            ],
          },
        },
      }),
    );
    writeFileSync(
      join(dir, "prices.json"),
      JSON.stringify({ schema_version: 1, as_of: "2026-09-24", sessions: ["2026-09-24"], symbols: {} }),
    );
    const result = validateDataFiles(dir, ist("2026-09-25T12:00:00"));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain("prices.json: no history for NEWCO (it will show as a data error)");
  });
});
