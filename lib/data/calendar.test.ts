import { describe, expect, it } from "vitest";
import { isTradingDay, istDate, lastCompletedSession, NSE_HOLIDAYS, tradingDaysAfter } from "./calendar";

// Instants are written in IST (+05:30) for readability.
const ist = (s: string) => new Date(`${s}+05:30`);

describe("NSE trading calendar", () => {
  it("treats weekends and NSE holidays as non-trading days", () => {
    expect(isTradingDay("2026-09-24")).toBe(true); // Thursday
    expect(isTradingDay("2026-09-26")).toBe(false); // Saturday
    expect(isTradingDay("2026-09-14")).toBe(false); // Ganesh Chaturthi
    expect(isTradingDay("2026-10-02")).toBe(false); // Gandhi Jayanti
  });

  it("counts trading days after one date up to and including another", () => {
    expect(tradingDaysAfter("2026-09-24", "2026-09-24")).toBe(0);
    expect(tradingDaysAfter("2026-09-24", "2026-09-26")).toBe(1); // Fri only; Sat is not
    expect(tradingDaysAfter("2026-09-24", "2026-09-29")).toBe(3); // Fri, Mon, Tue
    expect(tradingDaysAfter("2026-09-30", "2026-10-05")).toBe(2); // Thu 1, Mon 5 (Fri 2 Oct is a holiday)
  });

  it("gives today's date in IST regardless of the server's time zone", () => {
    expect(istDate(new Date("2026-09-24T20:00:00Z"))).toBe("2026-09-25"); // 01:30 IST next day
    expect(istDate(ist("2026-09-24T09:15:00"))).toBe("2026-09-24");
  });

  it("knows the last completed session (a close counts from 18:00 IST)", () => {
    expect(lastCompletedSession(ist("2026-09-24T19:00:00"))).toBe("2026-09-24");
    expect(lastCompletedSession(ist("2026-09-24T11:00:00"))).toBe("2026-09-23");
    expect(lastCompletedSession(ist("2026-09-26T11:00:00"))).toBe("2026-09-25"); // Saturday
    expect(lastCompletedSession(ist("2026-09-15T10:00:00"))).toBe("2026-09-11"); // Tue after a Monday holiday
  });

  it("refuses to guess for a year without a holiday table", () => {
    expect(() => isTradingDay("2031-01-15")).toThrow(/holiday table/);
  });

  it("has a holiday table for the current year (update yearly from the NSE circular)", () => {
    expect(NSE_HOLIDAYS[new Date().getFullYear()]).toBeDefined();
  });
});
