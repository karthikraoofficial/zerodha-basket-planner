// All money in this app is integer paise. These helpers are display-only.

const twoDecimals = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const noDecimals = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹99,016.75 */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  return `${sign}₹${twoDecimals.format(Math.abs(paise) / 100)}`;
}

/** 2,956.10 (no currency symbol, for price columns) */
export function formatPrice(paise: number): string {
  return twoDecimals.format(paise / 100);
}

/** ₹1,00,000 */
export function formatBucket(paise: number): string {
  return `₹${noDecimals.format(paise / 100)}`;
}
