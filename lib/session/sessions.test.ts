import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./store";
import { createSessions, InvalidSetupError, requiredRedirect } from "./sessions";

const ist = (s: string) => new Date(`${s}+05:30`);
const KEY = randomBytes(32).toString("base64");
const KITE = { userId: "AB1234", accessToken: "access_tok_789" };

function setup(key = KEY) {
  const store = createMemoryStore();
  return { store, sessions: createSessions({ store, encryptionKey: key }) };
}

describe("sessions", () => {
  it("round-trips the Kite session while storing the access token only encrypted", async () => {
    const { store, sessions } = setup();
    const now = ist("2026-09-25T09:00:00");
    const sid = await sessions.start(KITE, now);

    expect(await sessions.load(sid, now)).toMatchObject({ kiteUserId: "AB1234", accessToken: "access_tok_789" });
    expect(store.dump()).not.toContain("access_tok_789");
  });

  it("encrypts the same token differently every time", async () => {
    const { store, sessions } = setup();
    await sessions.start(KITE, ist("2026-09-25T09:00:00"));
    await sessions.start(KITE, ist("2026-09-25T09:00:00"));
    const entries = JSON.parse(store.dump()) as [string, { value: string }][];
    const ciphers = entries.map(([, e]) => (JSON.parse(e.value) as { tokenCipher: string }).tokenCipher);
    expect(ciphers).toHaveLength(2);
    expect(ciphers[0]).not.toBe(ciphers[1]);
  });

  it("uses session ids that are long and random", async () => {
    const { sessions } = setup();
    const a = await sessions.start(KITE, ist("2026-09-25T09:00:00"));
    const b = await sessions.start(KITE, ist("2026-09-25T09:00:00"));
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
  });

  it("expires at the next 06:00 IST, like the Kite token", async () => {
    const { sessions } = setup();
    const evening = await sessions.start(KITE, ist("2026-09-25T22:00:00"));
    expect((await sessions.load(evening, ist("2026-09-25T22:00:00")))?.expiresAt).toEqual(ist("2026-09-26T06:00:00"));
    expect(await sessions.load(evening, ist("2026-09-26T05:59:59"))).not.toBeNull();
    expect(await sessions.load(evening, ist("2026-09-26T06:00:00"))).toBeNull();

    const earlyMorning = await sessions.start(KITE, ist("2026-09-26T05:00:00"));
    expect((await sessions.load(earlyMorning, ist("2026-09-26T05:00:00")))?.expiresAt).toEqual(ist("2026-09-26T06:00:00"));
  });

  it("treats a session it cannot decrypt (wrong key) as no session", async () => {
    const { store, sessions } = setup();
    const sid = await sessions.start(KITE, ist("2026-09-25T09:00:00"));
    const other = createSessions({ store, encryptionKey: randomBytes(32).toString("base64") });
    expect(await other.load(sid, ist("2026-09-25T09:00:00"))).toBeNull();
  });

  it("refuses an encryption key that is not 32 bytes", () => {
    expect(() => createSessions({ store: createMemoryStore(), encryptionKey: "c2hvcnQ=" })).toThrow(/32 bytes/);
  });

  it("records a valid bucket and horizon, and rejects anything else", async () => {
    const { sessions } = setup();
    const now = ist("2026-09-25T09:00:00");
    const sid = await sessions.start(KITE, now);

    await expect(sessions.chooseSetup(sid, { bucketPaise: 750_000, horizon: "6-12m" }, now)).rejects.toBeInstanceOf(InvalidSetupError);
    await expect(sessions.chooseSetup(sid, { bucketPaise: 10_000_000, horizon: "1-2y" }, now)).rejects.toBeInstanceOf(InvalidSetupError);
    await sessions.chooseSetup(sid, { bucketPaise: 10_000_000, horizon: "6-12m" }, now);
    expect(await sessions.load(sid, now)).toMatchObject({ bucketPaise: 10_000_000, horizon: "6-12m" });
  });

  it("ends a session", async () => {
    const { sessions } = setup();
    const now = ist("2026-09-25T09:00:00");
    const sid = await sessions.start(KITE, now);
    await sessions.end(sid);
    expect(await sessions.load(sid, now)).toBeNull();
  });
});

describe("requiredRedirect (step order, enforced on the server)", () => {
  const live = { kiteUserId: "AB1234", accessToken: "t", expiresAt: new Date() };

  it("sends anyone without a live Kite session to Step 1", () => {
    expect(requiredRedirect(null, 2)).toBe("/login");
    expect(requiredRedirect(null, 3)).toBe("/login");
  });

  it("allows Step 2 with a session, but Step 3 only once bucket and horizon are chosen", () => {
    expect(requiredRedirect(live, 2)).toBeNull();
    expect(requiredRedirect(live, 3)).toBe("/setup");
    expect(requiredRedirect({ ...live, bucketPaise: 10_000_000 }, 3)).toBe("/setup");
    expect(requiredRedirect({ ...live, bucketPaise: 10_000_000, horizon: "6-12m" }, 3)).toBeNull();
  });
});
