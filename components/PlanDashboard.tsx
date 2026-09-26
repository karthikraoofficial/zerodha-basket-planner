import type { CSSProperties, ReactNode } from "react";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { BucketBar } from "@/components/charts/BucketBar";
import { ChecksSummary } from "@/components/charts/ChecksSummary";
import { ChecksTable } from "@/components/ChecksTable";
import { PlanTable, PlanTotals } from "@/components/PlanTable";
import { formatBucket, formatRupees } from "@/lib/money";
import type { Plan } from "@/lib/plan/build";

const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** The plan as dashboard cards: basket, bucket, positions, checks. Used live and for saved snapshots. */
export function PlanDashboard({
  plan,
  toolbar,
  note,
  checksTitle = "Checks",
}: {
  plan: Plan;
  toolbar?: ReactNode;
  note?: ReactNode;
  checksTitle?: string;
}) {
  const inPlan = new Set(plan.positions.map((p) => p.symbol));
  const short = plan.cash.shortByPaise > 0;
  return (
    <div className="dash">
      <div className="dash-row">
        <section className="card card-beige" style={order(0)}>
          <div className="card-head">
            <h2>Basket</h2>
            <span className="sub">
              {plan.names.selected} of {plan.names.depth} names · by amount at limits
            </span>
          </div>
          <AllocationBar plan={plan} />
        </section>

        <section className="card" style={order(1)}>
          <div className="card-head">
            <h2>Bucket</h2>
            <span className="sub">{formatBucket(plan.bucketPaise)}</span>
          </div>
          <BucketBar plan={plan} />
          <p className={short ? "cash cash-short" : "cash"}>
            Available cash {formatRupees(plan.cash.availablePaise)}
            {short ? ` · short by ${formatRupees(plan.cash.shortByPaise)} for this plan` : " · covers this plan"}
          </p>
          <PlanTotals plan={plan} />
        </section>
      </div>

      <section className="card card-plain" style={order(2)}>
        <div className="card-head">
          <h2>Positions</h2>
        </div>
        {toolbar}
        {note}
        {plan.positions.length ? (
          <PlanTable plan={plan} />
        ) : (
          <p className="alert">No candidate passed the checks for this bucket. The plan is empty.</p>
        )}
      </section>

      <section className="card" style={order(3)}>
        <div className="card-head">
          <h2>{checksTitle}</h2>
          <span className="sub">{plan.checks.length} candidates</span>
        </div>
        <p className="note">
          Excluded: below a falling 20DMA or 50DMA, more than 15% above the 50DMA, or median traded value under ₹2
          Cr/day over the last 50 sessions. Arrows show each MA&apos;s direction over 10 sessions.
        </p>
        <ChecksSummary rows={plan.checks} inPlan={inPlan} />
        <ChecksTable rows={plan.checks} inPlan={inPlan} />
      </section>
    </div>
  );
}
