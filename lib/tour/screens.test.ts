import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOUR, tourImage } from "./screens";

const PUBLIC = join(import.meta.dirname, "../../public");

describe("screen tour", () => {
  it("runs in flow order, from logging in to updating the list", () => {
    expect(TOUR.map((s) => s.id)).toEqual(["login", "setup", "plan", "charts", "checks", "history", "saved", "upload"]);
  });

  it("gives every step a unique id, a title and a caption", () => {
    expect(new Set(TOUR.map((s) => s.id)).size).toBe(TOUR.length);
    for (const step of TOUR) {
      expect(step.title.trim()).not.toBe("");
      expect(step.caption.trim()).not.toBe("");
    }
  });

  it("has a committed light and dark screenshot for every step (npm run screenshots)", () => {
    const missing = TOUR.flatMap((s) => (["light", "dark"] as const).map((t) => tourImage(s.id, t))).filter(
      (url) => !existsSync(join(PUBLIC, url)),
    );
    expect(missing).toEqual([]);
  });
});
