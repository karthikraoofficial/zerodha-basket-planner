import type { CSSProperties } from "react";
import { formatRupees } from "@/lib/money";
import type { Plan } from "@/lib/plan/build";
import { allocation } from "@/lib/plan/chart";

const pct = (x: number, dp = 1) => `${x.toFixed(dp)}%`;

/** The basket's composition as one stacked bar: the four heaviest names, then "N others". */
export function AllocationBar({ plan }: { plan: Plan }) {
  const { named, others } = allocation(plan);
  if (!named.length) return <p className="note">Nothing allocated.</p>;
  const segments = [
    ...named.map((s, i) => ({ key: s.symbol, label: s.symbol, sub: s.name, tone: `s${i + 1}`, ...s })),
    ...(others ? [{ key: "others", label: `${others.count} others`, sub: "grouped", tone: "other", ...others }] : []),
  ];
  const summary = segments.map((s) => `${s.label} ${pct(s.pct)}`).join(", ");

  return (
    <figure className="chart">
      <div className="stack" role="img" aria-label={`Basket allocation by amount: ${summary}`}>
        {segments.map((s, i) => (
          <span
            key={s.key}
            className={`seg tone-${s.tone}`}
            style={{ flexGrow: s.pct, "--i": i } as CSSProperties}
            data-tip={`${s.label} · ${formatRupees(s.amountPaise)} · ${pct(s.pct)} of basket`}
            tabIndex={0}
          />
        ))}
      </div>
      <table className="legend">
        <thead>
          <tr>
            <th>Name</th>
            <th className="num">Amount</th>
            <th className="num">Of bucket</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key}>
              <td>
                <span className={`swatch tone-${s.tone}`} aria-hidden />
                <strong>{s.label}</strong> <span className="sub">{s.sub}</span>
              </td>
              <td className="num">{formatRupees(s.amountPaise)}</td>
              <td className="num">{pct(s.weight * 100, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
