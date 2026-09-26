// Minimal key-value store: Upstash Redis in production, in-memory for tests and local dev.
import "server-only";
import { Redis } from "@upstash/redis";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
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
  };
}

export function createMemoryStore(): KeyValueStore & { dump(): string } {
  const data = new Map<string, { value: string; expiresAt: number }>();
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
    dump() {
      return JSON.stringify([...data.entries()]);
    },
  };
}
