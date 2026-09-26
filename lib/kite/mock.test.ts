import { describe, expect, it } from "vitest";
import { KiteSessionError } from "./client";
import { createMockKite } from "./mock";

describe("createMockKite", () => {
  it("logs in as the configured user and serves configured holdings and margins", async () => {
    const kite = createMockKite({
      userId: "AB1234",
      holdings: [{ symbol: "ELLEN", exchange: "NSE", quantity: 10, t1Quantity: 0, averagePrice: 300 }],
      availableCash: 25_000,
    });
    const session = await kite.auth.exchangeToken("any");
    expect(session.userId).toBe("AB1234");

    const account = kite.account(session.accessToken);
    expect(await account.holdings()).toHaveLength(1);
    expect(await account.equityMargins()).toEqual({ availableCash: 25_000, net: 25_000 });
  });

  it("can expire the session after a number of account calls", async () => {
    const kite = createMockKite({ expireAfterCalls: 1 });
    const account = kite.account((await kite.auth.exchangeToken("x")).accessToken);
    await account.holdings();
    await expect(account.equityMargins()).rejects.toBeInstanceOf(KiteSessionError);
  });

  it("rejects tokens it did not issue and tokens that were invalidated", async () => {
    const kite = createMockKite();
    await expect(kite.account("forged").holdings()).rejects.toBeInstanceOf(KiteSessionError);
    const { accessToken } = await kite.auth.exchangeToken("x");
    await kite.auth.invalidate(accessToken);
    await expect(kite.account(accessToken).holdings()).rejects.toBeInstanceOf(KiteSessionError);
  });
});
