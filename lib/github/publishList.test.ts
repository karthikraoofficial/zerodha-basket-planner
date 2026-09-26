import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { publishList } from "./publishList";

const FRI_NOON = new Date("2026-09-25T12:00:00+05:30");
const SAMPLE = readFileSync(join(import.meta.dirname, "../../tests/fixtures/data/latest.json"), "utf8");

type Publish = (file: { content: string; message: string }) => Promise<{ commitSha: string; commitUrl: string }>;
const okPublisher = () => vi.fn<Publish>(async () => ({ commitSha: "abc", commitUrl: "https://github.com/c/abc" }));

describe("publishList", () => {
  it("commits a valid list, pretty-printed, with the screen date in the message", async () => {
    const publish = okPublisher();
    const result = await publishList({ text: JSON.stringify(JSON.parse(SAMPLE)), now: FRI_NOON, publish });

    expect(result).toEqual({
      ok: true,
      screenDate: "2026-09-24",
      horizons: ["6-12m"],
      warnings: ["6-12m has only 7 names (14 recommended for backfill)"],
      commitUrl: "https://github.com/c/abc",
    });
    const { content, message } = publish.mock.calls[0]![0];
    expect(message).toBe("Update ranked list for 2026-09-24");
    expect(content).toBe(JSON.stringify(JSON.parse(SAMPLE), null, 2) + "\n");
  });

  it.each([
    ["not JSON", "{ nope", /not valid JSON/],
    ["a stale list", SAMPLE.replace('"2026-09-24"', '"2026-09-18"'), /stale: 5 trading days old/],
    ["a BSE symbol", SAMPLE.replace('"exchange": "NSE"', '"exchange": "BSE"'), /non-NSE symbols: ELLEN/],
    ["a schema error", SAMPLE.replace('"rank": 2', '"rank": 9'), /ranks must run 1..n/],
  ])("refuses %s and commits nothing", async (_label, text, problem) => {
    const publish = okPublisher();
    const result = await publishList({ text, now: FRI_NOON, publish });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join("\n")).toMatch(problem);
    expect(publish).not.toHaveBeenCalled();
  });

  it("reports a failed commit", async () => {
    const publish = vi.fn(async () => {
      throw new Error("Resource not accessible by personal access token");
    });
    const result = await publishList({ text: SAMPLE, now: FRI_NOON, publish });
    expect(result).toEqual({ ok: false, problems: ["GitHub refused the commit: Resource not accessible by personal access token"] });
  });
});
