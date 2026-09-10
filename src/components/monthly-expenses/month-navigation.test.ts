import { describe, it, expect } from "vitest";
import {
  getAdjacentYearMonth,
  getCurrentYearMonth,
} from "./month-navigation";

describe("getAdjacentYearMonth", () => {
  it("returns the previous month within the same year", () => {
    expect(getAdjacentYearMonth("2026-04", -1)).toBe("2026-03");
  });

  it("returns the next month within the same year", () => {
    expect(getAdjacentYearMonth("2026-04", 1)).toBe("2026-05");
  });

  it("moves to the previous year from january", () => {
    expect(getAdjacentYearMonth("2026-01", -1)).toBe("2025-12");
  });

  it("moves to the next year from december", () => {
    expect(getAdjacentYearMonth("2026-12", 1)).toBe("2027-01");
  });

  it("returns null for an invalid year-month value", () => {
    expect(getAdjacentYearMonth("", 1)).toBeNull();
    expect(getAdjacentYearMonth("2026-13", 1)).toBeNull();
    expect(getAdjacentYearMonth("04-2026", -1)).toBeNull();
  });
});

describe("getCurrentYearMonth", () => {
  it("formats the reference date as YYYY-MM in local time", () => {
    expect(getCurrentYearMonth(new Date(2026, 6, 3))).toBe("2026-07");
    expect(getCurrentYearMonth(new Date(2025, 0, 15))).toBe("2025-01");
    expect(getCurrentYearMonth(new Date(2025, 11, 31))).toBe("2025-12");
  });
});
