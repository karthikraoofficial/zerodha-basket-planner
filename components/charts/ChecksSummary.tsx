import type { CSSProperties } from "react";
import type { PlanCheckRow } from "@/lib/plan/build";
import { checksSummary } from "@/lib/plan/chart";

/** The candidate funnel as vertical bars, each scaled to the total number of candidates. */
export function ChecksSummary({ rows, inPlan }: { rows: PlanCheckRow[]; inPlan: Set<string> }) {
  const { total, groups } = checksSummary(rows, inPlan);
  const shown = groups.filter((g) => g.count > 0);
  if (!total) return null;

  return (
    <figure className="chart funnel" aria-label={`${total} candidates: ${shown.map((g) => `${g.count} ${g.label.toLowerCase()}`).join(", ")}`}>
      {shown.map((g, i) => (
        <div key={g.key} className="funnel-item">
          <div className="vtrack" aria-hidden>
            <span
              className={`vfill ${g.key === "in-plan" ? "tone-s1" : "tone-muted"}`}
              style={{ height: `${(g.count / total) * 100}%`, "--i": i } as CSSProperties}
            />
          </div>
          <div>
            <div className="figure">{g.count}</div>
            <div className="sub">{g.label}</div>
          </div>
        </div>
      ))}
    </figure>
  );
}
