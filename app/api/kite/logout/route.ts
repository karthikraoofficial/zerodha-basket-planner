import { NextResponse } from "next/server";
import { currentSession, SESSION_COOKIE } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

export async function POST(request: Request) {
  const current = await currentSession();
  if (current) {
    await runtime().kite.auth.invalidate(current.session.accessToken).catch(() => undefined);
    await runtime().sessions.end(current.sid);
  }
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
