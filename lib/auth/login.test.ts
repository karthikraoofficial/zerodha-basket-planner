import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { KiteSessionError } from "../kite/client";
import { createMockKite } from "../kite/mock";
import { createSessions } from "../session/sessions";
import { createMemoryStore } from "../session/store";
import { beginLogin, completeLogin } from "./login";

const now = new Date("2026-09-25T04:00:00Z");

function deps(kiteUserId = "AB1234") {
  const store = createMemoryStore();
  const kite = createMockKite({ userId: kiteUserId });
  const sessions = createSessions({ store, encryptionKey: randomBytes(32).toString("base64") });
  return { store, kite, sessions, ownerUserId: "AB1234", apiKey: "kite_key_123", now };
}

describe("beginLogin", () => {
  it("builds the official Kite login URL carrying a one-time state", async () => {
    const d = deps();
    const { state, url } = await beginLogin(d);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://kite.zerodha.com/connect/login");
    expect(u.searchParams.get("v")).toBe("3");
    expect(u.searchParams.get("api_key")).toBe("kite_key_123");
    expect(new URLSearchParams(u.searchParams.get("redirect_params")!).get("state")).toBe(state);
    expect(state.length).toBeGreaterThanOrEqual(32);
  });
});

describe("completeLogin", () => {
  it("creates a session for the owner when the state matches", async () => {
    const d = deps();
    const { state } = await beginLogin(d);
    const result = await completeLogin(d, { state, cookieState: state, requestToken: "rt", status: "success" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await d.sessions.load(result.sid, now)).toMatchObject({ kiteUserId: "AB1234" });
  });

  it.each([
    ["a state that doesn't match the browser's cookie", { cookieState: "other" }],
    ["a missing state", { state: undefined }],
    ["a missing request token", { requestToken: undefined }],
  ])("rejects %s", async (_label, override) => {
    const d = deps();
    const { state } = await beginLogin(d);
    const result = await completeLogin(d, { state, cookieState: state, requestToken: "rt", status: "success", ...override });
    expect(result).toEqual({ ok: false, error: "state" });
  });

  it("accepts a state only once", async () => {
    const d = deps();
    const { state } = await beginLogin(d);
    const input = { state, cookieState: state, requestToken: "rt", status: "success" };
    expect((await completeLogin(d, input)).ok).toBe(true);
    expect(await completeLogin(d, input)).toEqual({ ok: false, error: "state" });
  });

  it("reports a cancelled or failed Kite login", async () => {
    const d = deps();
    const { state } = await beginLogin(d);
    expect(await completeLogin(d, { state, cookieState: state, requestToken: "rt", status: "cancelled" })).toEqual({
      ok: false,
      error: "denied",
    });
  });

  it("refuses any Zerodha account other than the owner's and kills its token", async () => {
    const d = deps("ZZ9999");
    let issuedToken = "";
    const exchange = d.kite.auth.exchangeToken.bind(d.kite.auth);
    d.kite.auth.exchangeToken = async (rt) => {
      const s = await exchange(rt);
      issuedToken = s.accessToken;
      return s;
    };
    const { state } = await beginLogin(d);
    const result = await completeLogin(d, { state, cookieState: state, requestToken: "rt", status: "success" });

    expect(result).toEqual({ ok: false, error: "foreign-user" });
    await expect(d.kite.account(issuedToken).holdings()).rejects.toBeInstanceOf(KiteSessionError);
  });
});
