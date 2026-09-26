import { NextResponse } from "next/server";
import { beginLogin } from "@/lib/auth/login";
import { LOGIN_STATE_COOKIE } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";


export async function GET(request: Request) {
  const rt = runtime();
  const { state, url } = await beginLogin(rt);
  // With the mock Kite there is no Kite page to visit: go straight to our callback.
  const target = rt.mockKite
    ? new URL(`/api/kite/callback?state=${state}&request_token=mock&status=success`, request.url)
    : url;
  const response = NextResponse.redirect(target);
  response.cookies.set(LOGIN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/kite/callback",
    maxAge: 600,
  });
  return response;
}
