const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

/** "2026-09-24" → "24 Sep 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
}

/** An instant → "06:00" in IST */
export function formatTimeIST(at: Date): string {
  return timeFormat.format(at);
}
