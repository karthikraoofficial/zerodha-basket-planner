// Minimal key-value store: Upstash Redis in production, in-memory for tests and local dev.
import "server-only";
import { Redis } from "@upstash/redis";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomically add 1 and return the new count; the TTL is set when the key is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

export function createUpstashStore(redis: Redis = Redis.fromEnv()): KeyValueStore {
  return {
    async get(key) {
      const value = await redis.get<string>(key);
      return value === null || value === undefined ? null : typeof value === "string" ? value : JSON.stringify(value);
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await redis.set(key, value, { ex: Math.max(1, Math.ceil(ttlSeconds)) });
      else await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
    async incr(key, ttlSeconds) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, Math.max(1, Math.ceil(ttlSeconds)));
      return count;
    },
  };
}

export type MemoryData = Map<string, { value: string; expiresAt: number }>;

/** Pass `data` to share contents across instances (Next dev evaluates modules once per server layer). */
export function createMemoryStore(data: MemoryData = new Map()): KeyValueStore & { dump(): string } {
  const live = (key: string) => {
    const hit = data.get(key);
    if (hit && hit.expiresAt <= Date.now()) data.delete(key);
    return data.get(key);
  };
  return {
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, ttlSeconds) {
      data.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity });
    },
    async del(key) {
      data.delete(key);
    },
    async incr(key, ttlSeconds) {
      const hit = live(key);
      const count = hit ? Number(hit.value) + 1 : 1;
      data.set(key, { value: String(count), expiresAt: hit?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
      return count;
    },
    dump() {
      return JSON.stringify([...data.entries()]);
    },
  };
}
