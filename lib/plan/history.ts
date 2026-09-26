// Saved plans. The plan page stores what it showed as a short-lived server-side draft; "Save plan"
// snapshots that draft, so nothing the browser sends can alter a saved plan.
import { randomBytes } from "node:crypto";
import type { KeyValueStore } from "../session/store";
import type { Plan } from "./build";

export type SavedPlan = { id: string; savedAt: string; plan: Plan };
export type SavedPlanSummary = {
  id: string;
  savedAt: string;
  screenDate: string;
  horizon: Plan["horizon"];
  bucketPaise: number;
  names: string;
  committedPaise: number;
};

const DRAFT_TTL_SECONDS = 60 * 60;
const ID = /^[A-Za-z0-9_-]{16}$/;
const draftKey = (userId: string) => `draft:${userId}`;
const indexKey = (userId: string) => `plans:${userId}`;
const planKey = (userId: string, id: string) => `plan:${userId}:${id}`;

export async function saveDraft(store: KeyValueStore, userId: string, plan: Plan): Promise<void> {
  await store.set(draftKey(userId), JSON.stringify(plan), DRAFT_TTL_SECONDS);
}

export async function savePlanFromDraft(
  store: KeyValueStore,
  userId: string,
  now: Date,
): Promise<{ ok: true; id: string } | { ok: false; reason: "no-draft" }> {
  const draft = await store.get(draftKey(userId));
  if (!draft) return { ok: false, reason: "no-draft" };
  const plan = JSON.parse(draft) as Plan;
  const id = randomBytes(12).toString("base64url");
  const savedAt = now.toISOString();

  await store.set(planKey(userId, id), JSON.stringify({ id, savedAt, plan } satisfies SavedPlan));
  const summary: SavedPlanSummary = {
    id,
    savedAt,
    screenDate: plan.screenDate,
    horizon: plan.horizon,
    bucketPaise: plan.bucketPaise,
    names: `${plan.names.selected} of ${plan.names.depth}`,
    committedPaise: plan.totals.committedPaise,
  };
  await store.set(indexKey(userId), JSON.stringify([summary, ...(await listSavedPlans(store, userId))]));
  return { ok: true, id };
}

/** Newest first. */
export async function listSavedPlans(store: KeyValueStore, userId: string): Promise<SavedPlanSummary[]> {
  const raw = await store.get(indexKey(userId));
  return raw ? (JSON.parse(raw) as SavedPlanSummary[]) : [];
}

export async function getSavedPlan(store: KeyValueStore, userId: string, id: string): Promise<SavedPlan | null> {
  if (!ID.test(id)) return null;
  const raw = await store.get(planKey(userId, id));
  return raw ? (JSON.parse(raw) as SavedPlan) : null;
}
