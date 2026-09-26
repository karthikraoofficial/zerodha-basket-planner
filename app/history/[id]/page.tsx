import Link from "next/link";
import { notFound } from "next/navigation";
import { ChecksTable } from "@/components/ChecksTable";
import { PlanTable, PlanTotals } from "@/components/PlanTable";
import { istDate } from "@/lib/data/calendar";
import { formatDate, formatTimeIST } from "@/lib/dates";
import { HORIZON_LABELS } from "@/lib/data/list";
import { formatBucket, formatRupees } from "@/lib/money";
import { getSavedPlan } from "@/lib/plan/history";
import { requireKiteSession } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

/** A saved snapshot, read-only. Renders from the snapshot alone: no Kite calls. */
export default async function SavedPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireKiteSession();
  const saved = await getSavedPlan(runtime().store, session.kiteUserId, (await params).id);
  if (!saved) notFound();
  const { plan } = saved;
  const at = new Date(saved.savedAt);
  const savedAt = `${formatDate(istDate(at))} ${formatTimeIST(at)}`;

  return (
    <>
      <p className="sub">
        <Link href="/history">← My past plans</Link>
      </p>
      <h1>
        {formatBucket(plan.bucketPaise)} · {HORIZON_LABELS[plan.horizon]}
      </h1>
      <p className="note">
        Snapshot saved {savedAt} IST · list {formatDate(plan.screenDate)} · closes as of {formatDate(plan.pricesAsOf)} ·
        cash then {formatRupees(plan.cash.availablePaise)}. Prices have moved since; this is a record, not a current
        plan.
      </p>
      <PlanTotals plan={plan} />
      <PlanTable plan={plan} />
      <h2>Checks at the time</h2>
      <ChecksTable rows={plan.checks} inPlan={new Set(plan.positions.map((p) => p.symbol))} />
    </>
  );
}
