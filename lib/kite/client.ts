// Kite Connect v3 over plain HTTP, restricted to ALLOWED_KITE_CALLS. Secrets never leave this
// module: errors carry only status, error type and a scrubbed message.
import "server-only";
import { createHash } from "node:crypto";
import { ALLOWED_KITE_CALLS } from "./endpoints";

const BASE_URL = "https://api.kite.trade";

export type KiteSession = { userId: string; userName: string; accessToken: string };
export type Holding = { symbol: string; exchange: string; quantity: number; t1Quantity: number; averagePrice: number };
/** Rupees. */
export type EquityMargins = { availableCash: number; net: number };

/** App-level calls, made with the api key and secret. */
export interface KiteAuth {
  exchangeToken(requestToken: string): Promise<KiteSession>;
  invalidate(accessToken: string): Promise<void>;
}

/** Calls bound to one user's access token. */
export interface KiteAccount {
  holdings(): Promise<Holding[]>;
  equityMargins(): Promise<EquityMargins>;
}

export interface Kite {
  auth: KiteAuth;
  account(accessToken: string): KiteAccount;
}

export class KiteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorType: string,
  ) {
    super(message);
    this.name = "KiteError";
  }
}

/** The Kite session is gone (expired at 06:00 IST, logged out, or revoked): back to Step 1. */
export class KiteSessionError extends KiteError {
  constructor(message: string, status: number, errorType: string) {
    super(message, status, errorType);
    this.name = "KiteSessionError";
  }
}

export function assertAllowed(method: string, path: string): void {
  if (!ALLOWED_KITE_CALLS.some((c) => c.method === method && c.path === path)) {
    throw new Error(`Kite call ${method} ${path} is not allow-listed (this app is read-only)`);
  }
}

type Options = { apiKey: string; apiSecret: string; fetch?: typeof globalThis.fetch };

export function createHttpKite({ apiKey, apiSecret, fetch = globalThis.fetch }: Options): Kite {
  const scrub = (text: string, accessToken?: string) =>
    [apiSecret, accessToken].reduce<string>((t, secret) => (secret ? t.replaceAll(secret, "[redacted]") : t), text);

  async function call<T>(
    method: string,
    path: string,
    { accessToken, form, query }: { accessToken?: string; form?: Record<string, string>; query?: Record<string, string> } = {},
  ): Promise<T> {
    assertAllowed(method, path);
    const headers: Record<string, string> = { "X-Kite-Version": "3" };
    if (accessToken) headers.Authorization = `token ${apiKey}:${accessToken}`;
    if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const url = `${BASE_URL}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;

    const res = await fetch(url, { method, headers, body: form ? new URLSearchParams(form).toString() : undefined });
    const body = (await res.json().catch(() => ({}))) as { status?: string; data?: T; message?: string; error_type?: string };
    if (res.ok && body.status === "success") return body.data as T;

    const errorType = body.error_type ?? "UnknownError";
    const message = scrub(body.message ?? `Kite returned HTTP ${res.status}`, accessToken);
    if (res.status === 403 || errorType === "TokenException") throw new KiteSessionError(message, res.status, errorType);
    throw new KiteError(message, res.status, errorType);
  }

  return {
    auth: {
      async exchangeToken(requestToken) {
        const checksum = createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");
        const data = await call<{ user_id: string; user_name: string; access_token: string }>("POST", "/session/token", {
          form: { api_key: apiKey, request_token: requestToken, checksum },
        });
        return { userId: data.user_id, userName: data.user_name, accessToken: data.access_token };
      },
      async invalidate(accessToken) {
        await call("DELETE", "/session/token", { query: { api_key: apiKey, access_token: accessToken }, accessToken });
      },
    },
    account(accessToken) {
      return {
        async holdings() {
          const rows = await call<
            { tradingsymbol: string; exchange: string; quantity: number; t1_quantity: number; average_price: number }[]
          >("GET", "/portfolio/holdings", { accessToken });
          return rows.map((h) => ({
            symbol: h.tradingsymbol,
            exchange: h.exchange,
            quantity: h.quantity,
            t1Quantity: h.t1_quantity,
            averagePrice: h.average_price,
          }));
        },
        async equityMargins() {
          const m = await call<{ net: number; available: { live_balance: number } }>("GET", "/user/margins/equity", {
            accessToken,
          });
          return { availableCash: m.available.live_balance, net: m.net };
        },
      };
    },
  };
}
