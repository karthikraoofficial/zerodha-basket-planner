import type { PlanCheckRow } from "@/lib/plan/build";

const STATUS_LABEL: Record<PlanCheckRow["status"], string> = {
  pass: "Pass",
  deferred: "Deferred",
  excluded: "Excluded",
  insufficient: "Insufficient data",
  "not-tradable": "Not tradable",
  "data-error": "Data error",
};

const signed = (x: number, dp = 1) => `${x > 0 ? "+" : ""}${x.toFixed(dp)}%`;
const slope = (s: number | null) => (s === null ? "?" : s > 0 ? "↑" : s < 0 ? "↓" : "→");
const inr = (rupees: number) => rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Every candidate in the horizon, pass or fail, with the numbers behind the decision (spec §6a.4). */
export function ChecksTable({ rows, inPlan }: { rows: PlanCheckRow[]; inPlan: Set<string> }) {
  return (
    <div className="table-wrap">
      <table className="checks">
        <thead>
          <tr>
            <th className="num">#</th>
            <th className="sticky">Symbol</th>
            <th>Result</th>
            <th className="num">Close</th>
            <th className="num">vs 20DMA</th>
            <th className="num">vs 50DMA</th>
            <th className="num">Median value</th>
            <th className="num">Sessions</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = r.metrics;
            const passedButNotHeld = r.status === "pass" && !inPlan.has(r.symbol);
            return (
              <tr key={r.symbol}>
                <td className="num">{r.rank}</td>
                <td className="sticky">
                  <strong>{r.symbol}</strong>
                  <div className="sub">{r.name}</div>
                </td>
                <td>
                  <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="num">{r.close === undefined ? "—" : inr(r.close)}</td>
                <td className="num">
                  {m ? (
                    <>
                      {signed(m.dist20Pct)} <span title="20DMA slope over 10 sessions">{slope(m.slope20)}</span>
                      <div className="sub">{inr(m.ma20)}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">
                  {m ? (
                    <>
                      {signed(m.dist50Pct)} <span title="50DMA slope over 10 sessions">{slope(m.slope50)}</span>
                      <div className="sub">{inr(m.ma50)}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">{m ? `₹${m.medianTradedValueCr.toFixed(2)} Cr` : "—"}</td>
                <td className="num">{m?.sessions ?? "—"}</td>
                <td className="reason">
                  {r.reason || (passedButNotHeld ? "passed; beyond this bucket's depth" : "")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
