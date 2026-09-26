"use server";

import { publishFile } from "@/lib/github/publish";
import { publishList, type PublishListResult } from "@/lib/github/publishList";
import { requireKiteSession } from "@/lib/server/guards";
import { publishingRepo } from "@/lib/server/config";

export async function publishListAction(_prev: PublishListResult | null, formData: FormData): Promise<PublishListResult> {
  await requireKiteSession();
  const token = process.env.GITHUB_TOKEN;
  const repo = publishingRepo(process.env);
  if (!token || !repo) {
    return { ok: false, problems: ["Publishing isn't set up: add a GITHUB_TOKEN environment variable in Vercel (see below)."] };
  }
  return publishList({
    text: String(formData.get("list") ?? ""),
    now: new Date(),
    publish: (file) => publishFile({ token, repo, path: "data/latest.json", ...file }),
  });
}
