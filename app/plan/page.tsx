import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanActions } from "@/components/PlanActions";
import { PlanDashboard } from "@/components/PlanDashboard";
import { StatusBar } from "@/components/StatusBar";
import { formatDate, formatTimeIST } from "@/lib/dates";
import { HORIZON_LABELS } from "@/lib/data/list";
import { formatBucket } from "@/lib/money";
import { buildPlan, type BlockReason } from "@/lib/plan/build";
import { saveDraft } from "@/lib/plan/history";
import { currentData } from "@/lib/server/data";
import { requireSetup } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";
import { consumePlanBuild, PLAN_BUILDS_PER_HOUR } from "@/lib/session/ratelimit";
import { savePlan } from "./actions";

const BLOCKED: Record<BlockReason, string> = {
  "list-missing": "Today's ranked list (data/latest.json) is missing, so no plan can be built.",
  "list-invalid": "Today's ranked list failed validation, so no plan can be built.",
  "list-non-nse": "The ranked list contains non-NSE symbols, so no plan can be built.",
  "list-stale": "The list is stale: it is more than 2 trading days old. Wait for a fresh screen.",
  "prices-missing": "NSE prices (data/prices.json) are missing, so no plan can be built.",
  "prices-invalid": "NSE prices failed validation, so no plan can be built.",
  "horizon-unavailable": "Today's list has no ranking for this horizon. Choose another.",
};

export default async function PlanPage() {
  const { session } = await requireSetup();
  const now = new Date();
  const { list, prices } = currentData(now);
  const allowed = await consumePlanBuild(runtime().store, session.kiteUserId, now);
  const result = allowed.ok
    ? await buildPlan({
        account: runtime().kite.account(session.accessToken),
        list,
        prices,
        bucketPaise: session.bucketPaise,
        horizon: session.horizon,
        now,
      })
    : ({ status: "rate-limited", retryAt: allowed.retryAt } as const);
  if (result.status === "session-expired") redirect("/api/session/expired");
  if (result.status === "ok") await saveDraft(runtime().store, session.kiteUserId, result.plan);

  return (
    <>
      <StatusBar list={list} prices={prices} sessionExpiresAt={session.expiresAt} />
      <h1>
        {formatBucket(session.bucketPaise)} · {HORIZON_LABELS[session.horizon]}
      </h1>
      <p className="links">
        <Link href="/setup">Change bucket or horizon</Link> · <Link href="/history">My past plans</Link>
      </p>

      {result.status === "rate-limited" ? (
        <p className="alert">
          Plan limit reached ({PLAN_BUILDS_PER_HOUR} an hour). Try again after {formatTimeIST(result.retryAt)} IST.
        </p>
      ) : result.status === "blocked" ? (
        <div className="alert">
          <p>{BLOCKED[result.reason]}</p>
          {result.reason.startsWith("list-") && (
            <p>
              <Link href="/upload">Publish today&apos;s list</Link>
            </p>
          )}
          {result.detail && (
            <ul>
              {result.detail.slice(0, 10).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <PlanDashboard
          plan={result.plan}
          toolbar={
            <div className="toolbar">
              <PlanActions plan={result.plan} />
              <form action={savePlan}>
                <button className="button" type="submit" disabled={!result.plan.positions.length}>
                  Save plan
                </button>
              </form>
            </div>
          }
          note={
            <p className="note">
              Buy limit = last close × 1.015, rounded down to a valid NSE tick. Closes are as of{" "}
              {formatDate(result.plan.pricesAsOf)}
              {result.plan.pricesStale && <strong className="warn"> (stale: a newer session has closed)</strong>}.
            </p>
          }
        />
      )}
    </>
  );
}
