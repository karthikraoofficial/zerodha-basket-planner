import { redirect } from "next/navigation";
import { PlanTable, PlanTotals } from "@/components/PlanTable";
import { StatusBar } from "@/components/StatusBar";
import { Stepper } from "@/components/Stepper";
import { formatDate } from "@/lib/dates";
import { HORIZON_LABELS } from "@/lib/data/list";
import { formatBucket } from "@/lib/money";
import { buildPlan, type BlockReason } from "@/lib/plan/build";
import { currentData } from "@/lib/server/data";
import { requireSetup } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

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
  const result = await buildPlan({
    account: runtime().kite.account(session.accessToken),
    list,
    prices,
    bucketPaise: session.bucketPaise,
    horizon: session.horizon,
    now,
  });
  if (result.status === "session-expired") redirect("/api/session/expired");

  return (
    <>
      <Stepper current={3} />
      <StatusBar list={list} prices={prices} sessionExpiresAt={session.expiresAt} />
      <h1>
        {formatBucket(session.bucketPaise)} · {HORIZON_LABELS[session.horizon]}
      </h1>
      <p className="sub">
        <a href="/setup">Change bucket or horizon</a>
      </p>

      {result.status === "blocked" ? (
        <div className="alert">
          <p>{BLOCKED[result.reason]}</p>
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
          <PlanTotals plan={result.plan} />
          {result.plan.positions.length ? (
            <PlanTable plan={result.plan} />
          ) : (
            <p className="alert">No candidate passed the checks for this bucket. The plan is empty.</p>
          )}
        </>
      )}
    </>
  );
}
