import type { Plan } from "@/lib/plan/build";
import { formatPrice, formatRupees } from "@/lib/money";

const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

export function PlanTable({ plan }: { plan: Plan }) {
  return (
    <div className="table-wrap">
      <table className="plan">
        <thead>
          <tr>
            <th className="num">#</th>
            <th className="sticky">Symbol</th>
            <th className="num">Qty</th>
            <th className="num">Buy limit</th>
            <th className="num">Amount</th>
            <th className="num">Weight / target</th>
            <th className="num">Close</th>
            <th className="num">Upside</th>
            <th>Already held</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {plan.positions.map((p) => (
            <tr key={p.symbol}>
              <td className="num">{p.rank}</td>
              <td className="sticky">
                <strong>{p.symbol}</strong>
                <div className="sub">{p.name}</div>
              </td>
              <td className="num">{p.qty}</td>
              <td className="num">{formatPrice(p.limitPaise)}</td>
              <td className="num">{formatRupees(p.amountPaise)}</td>
              <td className="num">
                {pct(p.weight)} <span className="sub">/ {pct(p.targetWeight)}</span>
              </td>
              <td className="num">{formatPrice(p.closePaise)}</td>
              <td className="num">
                {p.upsideLowPct}–{p.upsideHighPct}%
              </td>
              <td>
                {p.holding ? (
                  <>
                    {p.holding.quantity}
                    {p.holding.t1Quantity ? ` + ${p.holding.t1Quantity} T1` : ""} @ {formatPrice(p.holding.averagePricePaise)}
                    <div className="sub">
                      {p.limitPaise > p.holding.averagePricePaise ? "averaging up" : "averaging down"}
                    </div>
                  </>
                ) : (
                  <span className="sub">—</span>
                )}
              </td>
              <td className="rationale">
                {p.rationale}
                {p.flags.length > 0 && <div className="sub">{p.flags.join(", ")}</div>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td className="sticky">Total</td>
            <td className="num">{plan.totals.shares}</td>
            <td />
            <td className="num">{formatRupees(plan.totals.committedPaise)}</td>
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PlanTotals({ plan }: { plan: Plan }) {
  const items: [string, string][] = [
    ["Committed at limits", formatRupees(plan.totals.committedPaise)],
    ["Unspent", formatRupees(plan.totals.unspentPaise)],
    ["Names", `${plan.names.selected} of ${plan.names.depth}`],
    ["Mean weight error", pct(plan.totals.meanAbsWeightError, 2)],
    ["Worst weight error", pct(plan.totals.worstAbsWeightError, 2)],
    ["Weighted upside midpoint", `${plan.totals.weightedUpsideMidPct.toFixed(1)}%`],
  ];
  return (
    <dl className="totals">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
