import { describe, it, expect } from "vitest";
import { createMonthlyExpenseId } from "./monthly-expenses-id";

describe("createMonthlyExpenseId", () => {
  it("returns non-empty ids", () => {
    const expenseId = createMonthlyExpenseId();

    expect(expenseId).toBeTruthy();
    expect(typeof expenseId).toBe("string");
  });

  it("produces lexicographically sortable ids in creation order", () => {
    const createdIds = Array.from({ length: 10 }, () => createMonthlyExpenseId());
    const sortedIds = [...createdIds].sort((left, right) =>
      left.localeCompare(right),
    );

    expect(createdIds).toEqual(sortedIds);
  });
});
