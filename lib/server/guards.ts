// Step guards for pages and server actions. Every Step 2/3 entry point calls one of these.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requiredRedirect, type SessionState } from "../session/sessions";
import { runtime } from "./runtime";

export const SESSION_COOKIE = "sid";

export async function currentSession(): Promise<{ sid: string; session: SessionState } | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const session = await runtime().sessions.load(sid, new Date());
  return session ? { sid, session } : null;
}

/** Step 2 (bucket & horizon): needs a live Kite session. */
export async function requireKiteSession() {
  const current = await currentSession();
  const to = requiredRedirect(current?.session ?? null, 2);
  if (to || !current) redirect(to ?? "/login");
  return current;
}

/** Step 3 (plan): needs a live Kite session and a chosen bucket and horizon. */
export async function requireSetup() {
  const current = await currentSession();
  const to = requiredRedirect(current?.session ?? null, 3);
  if (to || !current) redirect(to ?? "/login");
  return current as { sid: string; session: Required<SessionState> };
}
