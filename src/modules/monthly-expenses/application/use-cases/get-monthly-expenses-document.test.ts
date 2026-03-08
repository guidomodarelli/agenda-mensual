import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import { getMonthlyExpensesDocument } from "./get-monthly-expenses-document";

describe("getMonthlyExpensesDocument", () => {
  it("returns an empty monthly document when Drive has no file for the requested month", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      query: {
        month: "2026-03",
      },
      repository,
    });

    expect(result).toEqual({
      items: [],
      month: "2026-03",
    });
  });
});
