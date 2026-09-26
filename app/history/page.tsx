import Link from "next/link";
import type { CSSProperties } from "react";
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
      <Link href="/plan" className="crumb">
        ← Back to the plan
      </Link>
      <h1>My past plans</h1>
      {plans.length === 0 ? (
        <p className="card note">No saved plans yet. Use &ldquo;Save plan&rdquo; on a plan to keep a snapshot here.</p>
      ) : (
        <ul className="history">
          {plans.map((p, i) => (
            <li key={p.id} style={{ "--i": i } as CSSProperties}>
              <Link href={`/history/${p.id}`}>
                <span className="history-figure">
                  {formatBucket(p.bucketPaise)} <span>· {HORIZON_LABELS[p.horizon]}</span>
                </span>
                <span className="sub">
                  Saved {formatDate(istDate(new Date(p.savedAt)))} {formatTimeIST(new Date(p.savedAt))} IST · list {formatDate(p.screenDate)} · {p.names}{" "}
                  names · {formatRupees(p.committedPaise)}
                </span>
                <span className="history-go" aria-hidden>
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
