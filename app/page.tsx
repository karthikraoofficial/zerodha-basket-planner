import { redirect } from "next/navigation";
import { currentSession } from "@/lib/server/guards";
import { requiredRedirect } from "@/lib/session/sessions";

/** Send the owner to the furthest step they can reach. */
export default async function Home() {
  const current = await currentSession();
  redirect(requiredRedirect(current?.session ?? null, 3) ?? "/plan");
}
