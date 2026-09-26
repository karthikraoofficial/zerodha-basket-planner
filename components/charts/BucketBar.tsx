import { formatBucket, formatRupees } from "@/lib/money";
import type { Plan } from "@/lib/plan/build";
import { bucketBar } from "@/lib/plan/chart";

const pct = (x: number) => `${x.toFixed(1)}%`;

/** The bucket as committed + unspent, with a marker where available cash reaches. */
export function BucketBar({ plan }: { plan: Plan }) {
  const b = bucketBar(plan);
  const cash = formatRupees(plan.cash.availablePaise);
  const markerLabel = b.cashOverBucket ? "Cash ≥ bucket" : "Cash";
  const edge = b.cashPct > 80 ? "marker-end" : b.cashPct < 20 ? "marker-start" : "";

  return (
    <figure className="chart">
      <div
        className="track"
        role="img"
        aria-label={`Committed ${pct(b.committedPct)} of the bucket, unspent ${pct(b.unspentPct)}. Available cash ${cash}${b.short ? ", short of the plan" : ""}.`}
      >
        <span
          className="fill tone-s1"
          style={{ width: `${b.committedPct}%` }}
          data-tip={`Committed · ${formatRupees(plan.totals.committedPaise)} · ${pct(b.committedPct)}`}
          tabIndex={0}
        />
        <span
          className={`marker ${edge} ${b.short ? "marker-short" : ""}`}
          style={{ left: `${b.cashPct}%` }}
          data-tip={`Available cash · ${cash}`}
          tabIndex={0}
        >
          <span className="marker-label">{markerLabel}</span>
        </span>
      </div>
      <div className="scale">
        <span>₹0</span>
        <span>{formatBucket(plan.bucketPaise)}</span>
      </div>
    </figure>
  );
}
