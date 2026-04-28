import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import { getMonthlyExpensesCopyableMonths } from "./get-monthly-expenses-copyable-months";

describe("getMonthlyExpensesCopyableMonths", () => {
  it("returns only the immediately previous month when it has expenses", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listMonthsWithExpenses: jest.fn().mockResolvedValue([
        "2026-01",
        "2026-03",
        "2026-04",
      ]),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-jan",
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
          ],
          month: "2026-01",
        },
        {
          items: [],
          month: "2026-02",
        },
        {
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-mar",
              occurrencesPerMonth: 1,
              subtotal: 9000,
              total: 9000,
            },
          ],
          month: "2026-03",
        },
        {
          items: [
            {
              currency: "ARS",
              description: "Luz",
              id: "expense-apr",
              occurrencesPerMonth: 1,
              subtotal: 12000,
              total: 12000,
            },
          ],
          month: "2026-04",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesCopyableMonths({
      query: {
        targetMonth: "2026-04",
      },
      repository,
    });

    expect(repository.listMonthsWithExpenses).toHaveBeenCalledTimes(1);
    expect(repository.listAll).not.toHaveBeenCalled();
    expect(result).toEqual({
      defaultSourceMonth: "2026-03",
      sourceMonths: ["2026-03"],
      targetMonth: "2026-04",
    });
  });

  it("returns empty copyable months when the previous month has no expenses", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-feb",
              occurrencesPerMonth: 1,
              subtotal: 15000,
              total: 15000,
            },
          ],
          month: "2026-02",
        },
        {
          items: [],
          month: "2026-03",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesCopyableMonths({
      query: {
        targetMonth: "2026-04",
      },
      repository,
    });

    expect(result).toEqual({
      defaultSourceMonth: null,
      sourceMonths: [],
      targetMonth: "2026-04",
    });
  });

  it("returns no source months when there are no saved months with expenses", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [],
          month: "2026-01",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesCopyableMonths({
      query: {
        targetMonth: "2026-04",
      },
      repository,
    });

    expect(result).toEqual({
      defaultSourceMonth: null,
      sourceMonths: [],
      targetMonth: "2026-04",
    });
  });

  it("handles January target month without returning future months", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-dec",
              occurrencesPerMonth: 1,
              subtotal: 19000,
              total: 19000,
            },
          ],
          month: "2025-12",
        },
        {
          items: [
            {
              currency: "ARS",
              description: "Agua",
              id: "expense-jan",
              occurrencesPerMonth: 1,
              subtotal: 8000,
              total: 8000,
            },
          ],
          month: "2026-01",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesCopyableMonths({
      query: {
        targetMonth: "2026-01",
      },
      repository,
    });

    expect(result).toEqual({
      defaultSourceMonth: "2025-12",
      sourceMonths: ["2025-12"],
      targetMonth: "2026-01",
    });
  });
});
