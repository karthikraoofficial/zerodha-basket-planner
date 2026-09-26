// Per-user limit on plan builds (spec §7), as a fixed hourly window in the key-value store.
import type { KeyValueStore } from "./store";

export const PLAN_BUILDS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

export async function consumePlanBuild(
  store: KeyValueStore,
  userId: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; retryAt: Date }> {
  const windowStart = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const retryAt = new Date(windowStart + HOUR_MS);
  const count = await store.incr(`rl:plan:${userId}:${windowStart}`, (retryAt.getTime() - now.getTime()) / 1000 + 60);
  return count <= PLAN_BUILDS_PER_HOUR ? { ok: true } : { ok: false, retryAt };
}
