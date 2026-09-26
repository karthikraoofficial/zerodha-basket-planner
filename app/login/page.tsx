import { redirect } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { StatusBar } from "@/components/StatusBar";
import { currentData } from "@/lib/server/data";
import { currentSession } from "@/lib/server/guards";

const ERRORS: Record<string, string> = {
  state: "That login link expired or didn't match this browser. Please try again.",
  denied: "The Kite login was cancelled.",
  "foreign-user": "This app only accepts its owner's Zerodha account.",
  kite: "Kite didn't complete the login. Please try again.",
  expired: "Your Kite session has expired (Kite sessions end daily at 06:00 IST). Please log in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentSession()) redirect("/setup");
  const { error } = await searchParams;
  const { list, prices } = currentData(new Date());
  return (
    <>
      <Stepper current={1} />
      <StatusBar list={list} prices={prices} />
      <h1>Log in with Kite</h1>
      <p>
        Sign in through Zerodha&apos;s own login page. This app only reads your holdings and funds, and never places
        orders.
      </p>
      {error && <p className="alert">{ERRORS[error] ?? "Login failed. Please try again."}</p>}
      <a className="button" href="/api/kite/login">
        Log in with Kite
      </a>
    </>
  );
}
