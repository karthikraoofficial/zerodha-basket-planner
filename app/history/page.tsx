import Link from "next/link";
import { istDate } from "@/lib/data/calendar";
import { formatDate, formatTimeIST } from "@/lib/dates";
import { HORIZON_LABELS } from "@/lib/data/list";
import { formatBucket, formatRupees } from "@/lib/money";
import { listSavedPlans } from "@/lib/plan/history";
import { requireKiteSession } from "@/lib/server/guards";
import { runtime } from "@/lib/server/runtime";

export default async function HistoryPage() {
  const { session } = await requireKiteSession();
  const plans = await listSavedPlans(runtime().store, session.kiteUserId);
  return (
    <>
      <p className="sub">
        <Link href="/plan">← Back to the plan</Link>
      </p>
      <h1>My past plans</h1>
      {plans.length === 0 ? (
        <p className="note">No saved plans yet. Use &ldquo;Save plan&rdquo; on a plan to keep a snapshot here.</p>
      ) : (
        <ul className="history">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/history/${p.id}`}>
                <strong>
                  {formatBucket(p.bucketPaise)} · {HORIZON_LABELS[p.horizon]}
                </strong>
                <span className="sub">
                  Saved {formatDate(istDate(new Date(p.savedAt)))} {formatTimeIST(new Date(p.savedAt))} IST · list {formatDate(p.screenDate)} · {p.names}{" "}
                  names · {formatRupees(p.committedPaise)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
