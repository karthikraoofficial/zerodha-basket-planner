import { NextResponse, type NextRequest } from "next/server";
import { completeLogin } from "@/lib/auth/login";
import { LOGIN_STATE_COOKIE, SESSION_COOKIE } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const now = new Date();
  const result = await completeLogin(
    { ...runtime(), now },
    {
      state: q.get("state") ?? undefined,
      cookieState: request.cookies.get(LOGIN_STATE_COOKIE)?.value,
      requestToken: q.get("request_token") ?? undefined,
      status: q.get("status") ?? undefined,
    },
  );

  const response = NextResponse.redirect(new URL(result.ok ? "/setup" : `/login?error=${result.error}`, request.url));
  response.cookies.delete({ name: LOGIN_STATE_COOKIE, path: "/api/kite/callback" });
  if (result.ok) {
    const session = await runtime().sessions.load(result.sid, now);
    response.cookies.set(SESSION_COOKIE, result.sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session?.expiresAt,
    });
  }
  return response;
}
