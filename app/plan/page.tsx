import Link from "next/link";
import { redirect } from "next/navigation";
import { ChecksTable } from "@/components/ChecksTable";
import { PlanActions } from "@/components/PlanActions";
import { PlanTable, PlanTotals } from "@/components/PlanTable";
import { StatusBar } from "@/components/StatusBar";
import { Stepper } from "@/components/Stepper";
import { formatDate, formatTimeIST } from "@/lib/dates";
import { HORIZON_LABELS } from "@/lib/data/list";
import { formatBucket, formatRupees } from "@/lib/money";
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
      <Stepper current={3} />
      <StatusBar list={list} prices={prices} sessionExpiresAt={session.expiresAt} />
      <h1>
        {formatBucket(session.bucketPaise)} · {HORIZON_LABELS[session.horizon]}
      </h1>
      <p className="sub">
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
        <>
          <p className="note">
            Buy limit = last close × 1.015, rounded down to a valid NSE tick. Closes are as of{" "}
            {formatDate(result.plan.pricesAsOf)}
            {result.plan.pricesStale && <strong className="warn"> (stale: a newer session has closed)</strong>}.
          </p>
          <p className={result.plan.cash.shortByPaise > 0 ? "cash cash-short" : "cash"}>
            Available cash {formatRupees(result.plan.cash.availablePaise)}
            {result.plan.cash.shortByPaise > 0
              ? ` · short by ${formatRupees(result.plan.cash.shortByPaise)} for this plan`
              : " · covers this plan"}
          </p>
          <PlanActions plan={result.plan} />
          <form action={savePlan}>
            <button className="button" type="submit" disabled={!result.plan.positions.length}>
              Save plan
            </button>
          </form>
          <PlanTotals plan={result.plan} />
          {result.plan.positions.length ? (
            <PlanTable plan={result.plan} />
          ) : (
            <p className="alert">No candidate passed the checks for this bucket. The plan is empty.</p>
          )}
          <h2>Checks for every candidate</h2>
          <p className="note">
            Excluded: below a falling 20DMA or 50DMA, more than 15% above the 50DMA, or median traded value under
            ₹2 Cr/day over the last 50 sessions. Arrows show each MA&apos;s direction over 10 sessions.
          </p>
          <ChecksTable rows={result.plan.checks} inPlan={new Set(result.plan.positions.map((p) => p.symbol))} />
        </>
      )}
    </>
  );
}
