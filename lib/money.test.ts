import { describe, expect, it } from "vitest";
import { formatBucket, formatPrice, formatRupees } from "./money";

describe("money formatting (Indian grouping)", () => {
  it("formats amounts in paise with lakh grouping and two decimals", () => {
    expect(formatRupees(9_901_675)).toBe("₹99,016.75");
    expect(formatRupees(10_000_000)).toBe("₹1,00,000.00");
    expect(formatRupees(98_325)).toBe("₹983.25");
  });

  it("formats prices with two decimals", () => {
    expect(formatPrice(295_610)).toBe("2,956.10");
    expect(formatPrice(16_367)).toBe("163.67");
  });

  it("formats bucket labels without decimals", () => {
    expect(formatBucket(10_000_000)).toBe("₹1,00,000");
    expect(formatBucket(20_000_000)).toBe("₹2,00,000");
    expect(formatBucket(500_000)).toBe("₹5,000");
  });

  it("formats negative amounts", () => {
    expect(formatRupees(-150_050)).toBe("-₹1,500.50");
  });
});
