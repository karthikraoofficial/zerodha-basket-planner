import { formatDate, formatTimeIST } from "@/lib/dates";
import type { LoadListResult } from "@/lib/data/list";
import type { LoadPricesResult } from "@/lib/data/prices";

type Props = { list: LoadListResult; prices: LoadPricesResult; sessionExpiresAt?: Date };

/** Always visible: which list and prices are in use, and whether the Kite session is live. */
export function StatusBar({ list, prices, sessionExpiresAt }: Props) {
  const listText =
    list.status === "ok" || list.status === "stale"
      ? `List ${formatDate(list.list.screenDate)}${list.status === "stale" ? " · stale" : ""}`
      : `List ${list.status}`;
  const pricesText =
    prices.status === "ok"
      ? `Prices as of ${formatDate(prices.prices.asOf)} close${prices.stale ? " · stale" : ""}`
      : `Prices ${prices.status}`;
  return (
    <div className="statusbar" role="status">
      <span className={list.status === "ok" ? "chip" : "chip chip-bad"}>{listText}</span>
      <span className={prices.status === "ok" && !prices.stale ? "chip" : "chip chip-warn"}>{pricesText}</span>
      <span className={sessionExpiresAt ? "chip chip-ok" : "chip"}>
        {sessionExpiresAt ? `Kite live until ${formatTimeIST(sessionExpiresAt)} IST` : "Kite not connected"}
      </span>
    </div>
  );
}
