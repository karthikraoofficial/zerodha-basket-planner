// Wires the app's server-side dependencies from the environment. Production must use Upstash and
// the real Kite; the in-memory store and mock Kite exist only for local development.
import "server-only";
import { randomBytes } from "node:crypto";
import { createHttpKite, type Kite } from "../kite/client";
import { createMockKite } from "../kite/mock";
import { createSessions, type Sessions } from "../session/sessions";
import { createMemoryStore, createUpstashStore, type KeyValueStore } from "../session/store";

type Runtime = { store: KeyValueStore; sessions: Sessions; kite: Kite; ownerUserId: string; mockKite: boolean };

const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function build(): Runtime {
  const mockKite = process.env.KITE_MOCK === "1";
  if (mockKite && process.env.VERCEL_ENV === "production") throw new Error("KITE_MOCK is not allowed in production");

  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!hasUpstash && isProduction && !mockKite) throw new Error("Upstash Redis is required in production");
  const store = hasUpstash ? createUpstashStore() : createMemoryStore();

  // Local dev without a key gets a random one per process: sessions just don't survive restarts.
  const encryptionKey = process.env.TOKEN_ENC_KEY ?? (isProduction && !mockKite ? required("TOKEN_ENC_KEY") : randomBytes(32).toString("base64"));
  const kite = mockKite
    ? createMockKite({ userId: process.env.KITE_USER_ID ?? "MOCK01" })
    : createHttpKite({ apiKey: required("KITE_API_KEY"), apiSecret: required("KITE_API_SECRET") });

  return {
    store,
    sessions: createSessions({ store, encryptionKey }),
    kite,
    ownerUserId: mockKite ? (process.env.KITE_USER_ID ?? "MOCK01") : required("KITE_USER_ID"),
    mockKite,
  };
}

// One instance per server process (and across dev hot reloads).
const globalForRuntime = globalThis as unknown as { __basketRuntime?: Runtime };

export function runtime(): Runtime {
  return (globalForRuntime.__basketRuntime ??= build());
}
