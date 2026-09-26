"use server";

import { redirect } from "next/navigation";
import { savePlanFromDraft } from "@/lib/plan/history";
import { requireSetup } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

export async function savePlan() {
  const { session } = await requireSetup();
  const result = await savePlanFromDraft(runtime().store, session.kiteUserId, new Date());
  redirect(result.ok ? `/history/${result.id}` : "/plan?error=no-draft");
}
