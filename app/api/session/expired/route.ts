import { NextResponse } from "next/server";
import { currentSession, SESSION_COOKIE } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

/** Kite rejected the session mid-way (daily 06:00 IST expiry or a logout elsewhere): back to Step 1. */
export async function GET(request: Request) {
  const current = await currentSession();
  if (current) await runtime().sessions.end(current.sid);
  const response = NextResponse.redirect(new URL("/login?error=expired", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
