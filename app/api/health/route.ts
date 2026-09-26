import { NextResponse } from "next/server";
import { configProblems } from "@/lib/server/config";

export const dynamic = "force-dynamic";

/** Deployment check: lists missing configuration by name only, never values. */
export function GET() {
  const production = process.env.VERCEL_ENV === "production";
  const problems = production ? configProblems(process.env) : [];
  return NextResponse.json({ ok: problems.length === 0, production, problems }, { status: problems.length ? 503 : 200 });
}
