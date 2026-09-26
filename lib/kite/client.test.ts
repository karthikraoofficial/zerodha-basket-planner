import { describe, expect, it, vi } from "vitest";
import { assertAllowed, createHttpKite, KiteError, KiteSessionError } from "./client";

const API_KEY = "kite_key_123";
const API_SECRET = "kite_secret_xyz";
const TOKEN = "access_tok_789";

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: (call: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    const { status = 200, body } = respond(call);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const kite = (fetch: typeof globalThis.fetch) => createHttpKite({ apiKey: API_KEY, apiSecret: API_SECRET, fetch });

describe("Kite allow-list", () => {
  it.each([
    ["POST", "/orders/regular"],
    ["PUT", "/orders/regular/123"],
    ["DELETE", "/orders/regular/123"],
    ["POST", "/gtt/triggers"],
    ["GET", "/quote/ltp"],
    ["GET", "/portfolio/positions"],
    ["POST", "/portfolio/holdings"],
  ])("refuses %s %s", (method, path) => {
    expect(() => assertAllowed(method, path)).toThrow(/not allow-listed/);
  });

  it.each([
    ["POST", "/session/token"],
    ["DELETE", "/session/token"],
    ["GET", "/user/profile"],
    ["GET", "/portfolio/holdings"],
    ["GET", "/user/margins/equity"],
  ])("permits %s %s", (method, path) => {
    expect(() => assertAllowed(method, path)).not.toThrow();
  });
});

describe("createHttpKite", () => {
  it("exchanges a request token with checksum = SHA-256(api_key + request_token + api_secret)", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      body: { status: "success", data: { user_id: "AB1234", user_name: "Owner", access_token: TOKEN } },
    }));
    const session = await kite(fetch).auth.exchangeToken("req_tok_abc");

    expect(session).toEqual({ userId: "AB1234", userName: "Owner", accessToken: TOKEN });
    expect(calls[0]!.url).toBe("https://api.kite.trade/session/token");
    expect(calls[0]!.init.method).toBe("POST");
    const form = new URLSearchParams(String(calls[0]!.init.body));
    expect(form.get("api_key")).toBe(API_KEY);
    expect(form.get("request_token")).toBe("req_tok_abc");
    expect(form.get("checksum")).toBe("3c8ad4b3b952b79c0d3d0c25c52f943f8317b5409d768d451d3a0d94a9f41163");
    expect(form.has("api_secret")).toBe(false);
  });

  it("reads holdings with quantity, T1 quantity and average price", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      body: {
        status: "success",
        data: [
          { tradingsymbol: "ELLEN", exchange: "NSE", quantity: 40, t1_quantity: 5, average_price: 342.1, last_price: 361 },
        ],
      },
    }));
    const holdings = await kite(fetch).account(TOKEN).holdings();

    expect(holdings).toEqual([{ symbol: "ELLEN", exchange: "NSE", quantity: 40, t1Quantity: 5, averagePrice: 342.1 }]);
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("Authorization")).toBe(`token ${API_KEY}:${TOKEN}`);
    expect(headers.get("X-Kite-Version")).toBe("3");
    expect(calls[0]!.init.method).toBe("GET");
  });

  it("reads available equity cash from margins", async () => {
    const { fetch } = fakeFetch(() => ({
      body: { status: "success", data: { net: 51234.5, available: { live_balance: 48000.25, cash: 50000 } } },
    }));
    expect(await kite(fetch).account(TOKEN).equityMargins()).toEqual({ availableCash: 48000.25, net: 51234.5 });
  });

  it("maps a 403 TokenException to a session error", async () => {
    const { fetch } = fakeFetch(() => ({
      status: 403,
      body: { status: "error", error_type: "TokenException", message: "Incorrect `api_key` or `access_token`." },
    }));
    await expect(kite(fetch).account(TOKEN).holdings()).rejects.toBeInstanceOf(KiteSessionError);
  });

  it("never puts the api secret or access token into errors", async () => {
    const { fetch } = fakeFetch(() => ({
      status: 500,
      body: { status: "error", error_type: "GeneralException", message: `boom ${TOKEN} ${API_SECRET}` },
    }));
    const error = await kite(fetch).account(TOKEN).equityMargins().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(KiteError);
    const dump = JSON.stringify(error, Object.getOwnPropertyNames(error));
    expect(dump).not.toContain(TOKEN);
    expect(dump).not.toContain(API_SECRET);
    expect((error as KiteError).status).toBe(500);
  });

  it("invalidates a session with DELETE /session/token", async () => {
    const { fetch, calls } = fakeFetch(() => ({ body: { status: "success", data: true } }));
    await kite(fetch).auth.invalidate(TOKEN);
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toMatch(/^https:\/\/api\.kite\.trade\/session\/token\?/);
  });
});
