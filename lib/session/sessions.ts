// Server-side login sessions. The browser holds only an opaque random id; the Kite access token
// lives in the store, encrypted with AES-256-GCM, and expires with Kite's at the next 06:00 IST.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { BUCKET_DEPTHS } from "../allocate/allocate";
import { HORIZONS, type Horizon } from "../data/list";
import type { KeyValueStore } from "./store";

export type SessionState = {
  kiteUserId: string;
  accessToken: string;
  expiresAt: Date;
  bucketPaise?: number;
  horizon?: Horizon;
};

type Stored = { kiteUserId: string; tokenCipher: string; expiresAt: string; bucketPaise?: number; horizon?: Horizon };

export type SetupResult = { ok: true } | { ok: false; reason: "bucket" | "horizon" | "session" };

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KITE_EXPIRY_HOUR_IST = 6;

/** Kite access tokens expire at 06:00 IST the next morning (regulatory requirement). */
export function nextKiteExpiry(now: Date): Date {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istSixToday = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), KITE_EXPIRY_HOUR_IST);
  const sixIst = istNow.getTime() < istSixToday ? istSixToday : istSixToday + DAY_MS;
  return new Date(sixIst - IST_OFFSET_MS);
}

function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

function decrypt(token: string, key: Buffer): string | null {
  const [version, iv, tag, body] = token.split(".");
  if (version !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const storeKey = (sid: string) => `sess:${sid}`;

export function createSessions({ store, encryptionKey }: { store: KeyValueStore; encryptionKey: string }) {
  const key = Buffer.from(encryptionKey, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64-encoded");

  async function read(sid: string, now: Date): Promise<Stored | null> {
    const raw = await store.get(storeKey(sid));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    return new Date(stored.expiresAt) > now ? stored : null;
  }

  async function write(sid: string, stored: Stored, now: Date) {
    await store.set(storeKey(sid), JSON.stringify(stored), (Date.parse(stored.expiresAt) - now.getTime()) / 1000);
  }

  return {
    async start(kite: { userId: string; accessToken: string }, now: Date): Promise<string> {
      const sid = randomBytes(32).toString("base64url");
      const expiresAt = nextKiteExpiry(now).toISOString();
      await write(sid, { kiteUserId: kite.userId, tokenCipher: encrypt(kite.accessToken, key), expiresAt }, now);
      return sid;
    },

    async load(sid: string, now: Date): Promise<SessionState | null> {
      const stored = await read(sid, now);
      const accessToken = stored && decrypt(stored.tokenCipher, key);
      if (!stored || !accessToken) return null;
      return {
        kiteUserId: stored.kiteUserId,
        accessToken,
        expiresAt: new Date(stored.expiresAt),
        ...(stored.bucketPaise !== undefined && { bucketPaise: stored.bucketPaise }),
        ...(stored.horizon !== undefined && { horizon: stored.horizon }),
      };
    },

    /** Record Step 2's choices. Anything but a real bucket and horizon is refused. */
    async chooseSetup(sid: string, setup: { bucketPaise: number; horizon: string }, now: Date): Promise<SetupResult> {
      if (!BUCKET_DEPTHS.has(setup.bucketPaise)) return { ok: false, reason: "bucket" };
      if (!(HORIZONS as readonly string[]).includes(setup.horizon)) return { ok: false, reason: "horizon" };
      const stored = await read(sid, now);
      if (!stored) return { ok: false, reason: "session" };
      await write(sid, { ...stored, bucketPaise: setup.bucketPaise, horizon: setup.horizon as Horizon }, now);
      return { ok: true };
    },

    async end(sid: string): Promise<void> {
      await store.del(storeKey(sid));
    },
  };
}

export type Sessions = ReturnType<typeof createSessions>;

/** Where to send a request for `step`, or null if it may proceed. Steps: 2 = setup, 3 = plan. */
export function requiredRedirect(session: SessionState | null, step: 2 | 3): "/login" | "/setup" | null {
  if (!session) return "/login";
  if (step === 3 && (session.bucketPaise === undefined || session.horizon === undefined)) return "/setup";
  return null;
}
