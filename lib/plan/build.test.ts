// Integration: the three steps end to end against a mock Kite and the 24 Sep fixture data.
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { beginLogin, completeLogin } from "../auth/login";
import { loadList } from "../data/list";
import { loadPrices } from "../data/prices";
import { createMockKite, type MockKiteOptions } from "../kite/mock";
import { createSessions, requiredRedirect } from "../session/sessions";
import { createMemoryStore } from "../session/store";
import { buildPlan } from "./build";

const FIXTURES = join(import.meta.dirname, "../../tests/fixtures/data");
const FRI_NOON = new Date("2026-09-25T12:00:00+05:30");
const rupees = (r: number) => Math.round(r * 100);

function data(now = FRI_NOON, listPath = join(FIXTURES, "latest.json")) {
  return { list: loadList(listPath, now), prices: loadPrices(join(FIXTURES, "prices.json"), now) };
}

async function loggedIn(kiteOptions: MockKiteOptions = {}) {
  const store = createMemoryStore();
  const kite = createMockKite({ userId: "AB1234", ...kiteOptions });
  const sessions = createSessions({ store, encryptionKey: randomBytes(32).toString("base64") });
  const deps = { store, kite, sessions, ownerUserId: "AB1234", apiKey: "k", now: FRI_NOON };
  const { state } = await beginLogin(deps);
  const login = await completeLogin(deps, { state, cookieState: state, requestToken: "rt", status: "success" });
  if (!login.ok) throw new Error(login.error);
  return { kite, sessions, sid: login.sid };
}

describe("buildPlan (integration)", () => {
  it("runs Login → Bucket & Horizon → Plan and reproduces the golden ₹1,00,000 plan", async () => {
    const { kite, sessions, sid } = await loggedIn();
    expect(requiredRedirect(await sessions.load(sid, FRI_NOON), 3)).toBe("/setup");

    await sessions.chooseSetup(sid, { bucketPaise: rupees(100_000), horizon: "6-12m" }, FRI_NOON);
    const session = (await sessions.load(sid, FRI_NOON))!;
    expect(requiredRedirect(session, 3)).toBeNull();

    const result = await buildPlan({
      account: kite.account(session.accessToken),
      ...data(),
      bucketPaise: session.bucketPaise!,
      horizon: session.horizon!,
      now: FRI_NOON,
    });
    if (result.status !== "ok") throw new Error(result.status);
    const { plan } = result;

    expect(plan.positions.map((p) => [p.symbol, p.qty, p.limitPaise])).toEqual([
      ["ELLEN", 58, rupees(366.4)],
      ["KMEW", 6, rupees(3000.4)],
      ["MARKSANS", 51, rupees(347.65)],
      ["PRECWIRE", 32, rupees(503.9)],
      ["GPPL", 92, rupees(166.1)],
      ["USHAMART", 20, rupees(531.35)],
    ]);
    expect(plan.totals).toMatchObject({ shares: 259, committedPaise: rupees(99_016.75), unspentPaise: rupees(983.25) });
    expect(plan.names).toEqual({ selected: 6, depth: 12 });
    expect(plan.checks.map((r) => [r.symbol, r.status])).toEqual([
      ["ELLEN", "pass"],
      ["KMEW", "pass"],
      ["MARKSANS", "pass"],
      ["PRECWIRE", "pass"],
      ["GPPL", "pass"],
      ["USHAMART", "pass"],
      ["KPL", "excluded"],
    ]);
    expect(plan.checks.at(-1)!.reason).toBe("extended: 15.8% above 50DMA (15% max)");
    expect(plan).toMatchObject({ screenDate: "2026-09-24", pricesAsOf: "2026-09-24", horizon: "6-12m" });
  });

  it("returns session-expired when the Kite session dies midway (holdings ok, margins fail)", async () => {
    const { kite, sessions, sid } = await loggedIn({ expireAfterCalls: 1 });
    const session = (await sessions.load(sid, FRI_NOON))!;
    const result = await buildPlan({
      account: kite.account(session.accessToken),
      ...data(),
      bucketPaise: rupees(100_000),
      horizon: "6-12m",
      now: FRI_NOON,
    });
    expect(result).toEqual({ status: "session-expired" });
  });

  it("shows a listed symbol that has no price data as a data error without dropping it", async () => {
    const list = JSON.parse(readFileSync(join(FIXTURES, "latest.json"), "utf8"));
    list.horizons["6-12m"].candidates.push({
      rank: 8, symbol: "GHOST", exchange: "NSE", name: "Ghost Ltd", upside_low_pct: 30, upside_high_pct: 50, rationale: "", flags: [],
    });
    const path = join(mkdtempSync(join(tmpdir(), "list-")), "latest.json");
    writeFileSync(path, JSON.stringify(list));

    const { kite, sessions, sid } = await loggedIn();
    const session = (await sessions.load(sid, FRI_NOON))!;
    const result = await buildPlan({
      account: kite.account(session.accessToken),
      ...data(FRI_NOON, path),
      bucketPaise: rupees(100_000),
      horizon: "6-12m",
      now: FRI_NOON,
    });
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.plan.checks.find((r) => r.symbol === "GHOST")).toMatchObject({
      status: "data-error",
      reason: "no NSE price data for this symbol",
    });
    expect(result.plan.totals.shares).toBe(259);
  });

  it("refuses to build from a stale list", async () => {
    const { kite, sessions, sid } = await loggedIn();
    const session = (await sessions.load(sid, FRI_NOON))!;
    const tue = new Date("2026-09-29T10:00:00+05:30");
    const result = await buildPlan({
      account: kite.account(session.accessToken),
      ...data(tue),
      bucketPaise: rupees(100_000),
      horizon: "6-12m",
      now: tue,
    });
    expect(result).toMatchObject({ status: "blocked", reason: "list-stale" });
  });

  it("refuses a horizon that today's list doesn't have", async () => {
    const { kite, sessions, sid } = await loggedIn();
    const session = (await sessions.load(sid, FRI_NOON))!;
    const result = await buildPlan({
      account: kite.account(session.accessToken),
      ...data(),
      bucketPaise: rupees(100_000),
      horizon: "3-6m",
      now: FRI_NOON,
    });
    expect(result).toMatchObject({ status: "blocked", reason: "horizon-unavailable" });
  });

  it("shows holdings overlap and flags cash that won't cover the plan", async () => {
    const { kite, sessions, sid } = await loggedIn({
      holdings: [{ symbol: "ELLEN", exchange: "NSE", quantity: 40, t1Quantity: 5, averagePrice: 342.1 }],
      availableCash: 60_000,
    });
    const session = (await sessions.load(sid, FRI_NOON))!;
    const result = await buildPlan({
      account: kite.account(session.accessToken),
      ...data(),
      bucketPaise: rupees(100_000),
      horizon: "6-12m",
      now: FRI_NOON,
    });
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.plan.positions[0]!.holding).toEqual({ quantity: 40, t1Quantity: 5, averagePricePaise: rupees(342.1) });
    expect(result.plan.positions[1]!.holding).toBeUndefined();
    expect(result.plan.cash).toEqual({ availablePaise: rupees(60_000), shortByPaise: rupees(39_016.75) });
    expect(result.plan.accountFetchedAt).toEqual(FRI_NOON.toISOString());
  });
});
