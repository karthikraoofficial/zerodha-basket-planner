import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadList } from "../data/list";
import { loadPrices } from "../data/prices";
import { createMockKite } from "../kite/mock";
import { createMemoryStore } from "../session/store";
import { buildPlan } from "./build";
import { getSavedPlan, listSavedPlans, saveDraft, savePlanFromDraft } from "./history";

const FIXTURES = join(import.meta.dirname, "../../tests/fixtures/data");
const now = new Date("2026-09-25T12:00:00+05:30");

async function plan(bucketPaise = 10_000_000) {
  const kite = createMockKite();
  const { accessToken } = await kite.auth.exchangeToken("x");
  const result = await buildPlan({
    account: kite.account(accessToken),
    list: loadList(join(FIXTURES, "latest.json"), now),
    prices: loadPrices(join(FIXTURES, "prices.json"), now),
    bucketPaise,
    horizon: "6-12m",
    now,
  });
  if (result.status !== "ok") throw new Error(result.status);
  return { plan: result.plan, accessToken };
}

describe("saved plans", () => {
  it("saves the plan last shown to the user and lists it newest first", async () => {
    const store = createMemoryStore();
    const first = await plan(10_000_000);
    await saveDraft(store, "AB1234", first.plan);
    const a = await savePlanFromDraft(store, "AB1234", new Date("2026-09-25T12:01:00+05:30"));

    await saveDraft(store, "AB1234", (await plan(500_000)).plan);
    const b = await savePlanFromDraft(store, "AB1234", new Date("2026-09-25T12:05:00+05:30"));
    if (!a.ok || !b.ok) throw new Error("save failed");

    const list = await listSavedPlans(store, "AB1234");
    expect(list.map((s) => [s.id, s.bucketPaise, s.names])).toEqual([
      [b.id, 500_000, "4 of 4"],
      [a.id, 10_000_000, "6 of 12"],
    ]);
    expect(list[1]).toMatchObject({ screenDate: "2026-09-24", horizon: "6-12m", committedPaise: 9_901_675 });

    const saved = await getSavedPlan(store, "AB1234", a.id);
    expect(saved?.plan.totals.shares).toBe(259);
    expect(saved?.savedAt).toBe(new Date("2026-09-25T12:01:00+05:30").toISOString());
  });

  it("stores no session secrets in a snapshot", async () => {
    const store = createMemoryStore();
    const { plan: p, accessToken } = await plan();
    await saveDraft(store, "AB1234", p);
    await savePlanFromDraft(store, "AB1234", now);
    expect(store.dump()).not.toContain(accessToken);
  });

  it("refuses to save when no plan was shown recently", async () => {
    expect(await savePlanFromDraft(createMemoryStore(), "AB1234", now)).toEqual({ ok: false, reason: "no-draft" });
  });

  it("keeps each user's plans private", async () => {
    const store = createMemoryStore();
    await saveDraft(store, "AB1234", (await plan()).plan);
    const saved = await savePlanFromDraft(store, "AB1234", now);
    if (!saved.ok) throw new Error();
    expect(await getSavedPlan(store, "ZZ9999", saved.id)).toBeNull();
    expect(await listSavedPlans(store, "ZZ9999")).toEqual([]);
  });

  it("ignores ids that are not ids", async () => {
    expect(await getSavedPlan(createMemoryStore(), "AB1234", "../../etc")).toBeNull();
  });
});
