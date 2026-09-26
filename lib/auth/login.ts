// Kite Connect login (https://kite.trade/docs/connect/v3/user/). A one-time `state` travels to Kite
// in redirect_params, comes back on the callback, and must match both the store and the browser's
// cookie. Only the owner's Zerodha user ID gets a session (ADR 0001).
import "server-only";
import { randomBytes } from "node:crypto";
import type { Kite } from "../kite/client";
import type { Sessions } from "../session/sessions";
import type { KeyValueStore } from "../session/store";

const LOGIN_URL = "https://kite.zerodha.com/connect/login";
const STATE_TTL_SECONDS = 10 * 60;
const stateKey = (state: string) => `oauth:${state}`;

type Deps = { store: KeyValueStore; kite: Kite; sessions: Sessions; ownerUserId: string; apiKey: string; now: Date };

export async function beginLogin({ store, apiKey }: Pick<Deps, "store" | "apiKey">): Promise<{ state: string; url: string }> {
  const state = randomBytes(24).toString("base64url");
  await store.set(stateKey(state), "1", STATE_TTL_SECONDS);
  const url = new URL(LOGIN_URL);
  url.searchParams.set("v", "3");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("redirect_params", new URLSearchParams({ state }).toString());
  return { state, url: url.toString() };
}

export type LoginError = "state" | "denied" | "foreign-user" | "kite";

export async function completeLogin(
  { store, kite, sessions, ownerUserId, now }: Omit<Deps, "apiKey">,
  input: { state?: string; cookieState?: string; requestToken?: string; status?: string },
): Promise<{ ok: true; sid: string } | { ok: false; error: LoginError }> {
  const { state, cookieState, requestToken, status } = input;
  if (!state || state !== cookieState || !(await store.get(stateKey(state)))) return { ok: false, error: "state" };
  await store.del(stateKey(state)); // one use only
  if (status !== "success") return { ok: false, error: "denied" };
  if (!requestToken) return { ok: false, error: "state" };

  let kiteSession;
  try {
    kiteSession = await kite.auth.exchangeToken(requestToken);
  } catch {
    return { ok: false, error: "kite" };
  }
  if (kiteSession.userId !== ownerUserId) {
    await kite.auth.invalidate(kiteSession.accessToken).catch(() => undefined);
    return { ok: false, error: "foreign-user" };
  }
  return { ok: true, sid: await sessions.start(kiteSession, now) };
}
