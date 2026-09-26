// In-memory Kite for tests and local development (KITE_MOCK=1). Same interface as the HTTP adapter.
import { randomUUID } from "node:crypto";
import { KiteSessionError, type Holding, type Kite } from "./client";

export type MockKiteOptions = {
  userId?: string;
  userName?: string;
  holdings?: Holding[];
  /** Rupees. */
  availableCash?: number;
  /** Simulate the 06:00 IST expiry: account calls after this many fail with a session error. */
  expireAfterCalls?: number;
  /** Issued tokens; pass a shared set to keep them valid across instances. */
  liveTokens?: Set<string>;
};

export function createMockKite({
  userId = "MOCK01",
  userName = "Mock Owner",
  holdings = [],
  availableCash = 1_00_000,
  expireAfterCalls = Infinity,
  liveTokens: live = new Set<string>(),
}: MockKiteOptions = {}): Kite {
  let calls = 0;
  const guard = (accessToken: string) => {
    calls++;
    if (!live.has(accessToken) || calls > expireAfterCalls) {
      throw new KiteSessionError("Session expired (mock)", 403, "TokenException");
    }
  };
  return {
    auth: {
      async exchangeToken() {
        const accessToken = `mock-${randomUUID()}`;
        live.add(accessToken);
        return { userId, userName, accessToken };
      },
      async invalidate(accessToken) {
        live.delete(accessToken);
      },
    },
    account(accessToken) {
      return {
        async holdings() {
          guard(accessToken);
          return holdings.map((h) => ({ ...h }));
        },
        async equityMargins() {
          guard(accessToken);
          return { availableCash, net: availableCash };
        },
      };
    },
  };
}
