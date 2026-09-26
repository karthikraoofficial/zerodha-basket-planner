"use server";

import { redirect } from "next/navigation";
import { currentData } from "@/lib/server/data";
import { requireKiteSession } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

export async function selectSetup(formData: FormData) {
  const { sid } = await requireKiteSession();
  const now = new Date();
  const bucketPaise = Number(formData.get("bucket"));
  const horizon = String(formData.get("horizon") ?? "");

  const { list } = currentData(now);
  const available: string[] = list.status === "ok" || list.status === "stale" ? list.availableHorizons : [];
  if (!available.includes(horizon)) redirect("/setup?error=horizon");

  const result = await runtime().sessions.chooseSetup(sid, { bucketPaise, horizon }, now);
  if (!result.ok) redirect(result.reason === "session" ? "/login" : `/setup?error=${result.reason}`);
  redirect("/plan");
}
