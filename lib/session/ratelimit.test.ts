import { describe, expect, it } from "vitest";
import { consumePlanBuild, PLAN_BUILDS_PER_HOUR } from "./ratelimit";
import { createMemoryStore } from "./store";

describe("consumePlanBuild (fixed hourly window per user)", () => {
  it("allows 30 plan builds an hour, then refuses until the next hour", async () => {
    const store = createMemoryStore();
    const t = new Date("2026-09-25T10:15:00Z");
    for (let i = 0; i < PLAN_BUILDS_PER_HOUR; i++) expect((await consumePlanBuild(store, "AB1234", t)).ok).toBe(true);

    const refused = await consumePlanBuild(store, "AB1234", t);
    expect(refused).toEqual({ ok: false, retryAt: new Date("2026-09-25T11:00:00Z") });
    expect((await consumePlanBuild(store, "AB1234", new Date("2026-09-25T11:00:01Z"))).ok).toBe(true);
  });

  it("counts each user separately", async () => {
    const store = createMemoryStore();
    const t = new Date("2026-09-25T10:15:00Z");
    for (let i = 0; i < PLAN_BUILDS_PER_HOUR; i++) await consumePlanBuild(store, "AB1234", t);
    expect((await consumePlanBuild(store, "ZZ9999", t)).ok).toBe(true);
  });
});
