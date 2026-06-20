import type { MonthlyExpensesDocument } from "../../domain/value-objects/monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import { getMonthlyExpensesCopyableMonths } from "./get-monthly-expenses-copyable-months";

function createGetByMonth(
  documentsByMonth: Record<string, { items: Array<Record<string, unknown>> }>,
) {
  return jest.fn(async (month: string) => {
    const document = documentsByMonth[month];

    return (document ?? null) as unknown as MonthlyExpensesDocument | null;
  });
}

describe("getMonthlyExpensesCopyableMonths", () => {
  it("returns only the immediately previous month when it has a plain expense", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: createGetByMonth({
        "2026-03": {
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
        },
      }),
      listMonthsWithExpenses: jest.fn().mockResolvedValue([
        "2026-01",
        "2026-03",
        "2026-04",
      ]),
      listAll: jest.fn(),
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
    expect(repository.getByMonth).toHaveBeenCalledWith("2026-03");
    expect(result).toEqual({
      defaultSourceMonth: "2026-03",
      sourceMonths: ["2026-03"],
      targetMonth: "2026-04",
    });
  });

  it("does not expose the previous month when its only items are loans or recurring expenses", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: createGetByMonth({
        "2026-03": {
          items: [
            {
              currency: "ARS",
              description: "Préstamo Carlos",
              id: "loan-mar",
              loan: {
                direction: "payable",
                installmentCount: 6,
                startMonth: "2026-03",
              },
              occurrencesPerMonth: 1,
              subtotal: 9000,
              total: 9000,
            },
            {
              currency: "ARS",
              description: "Alquiler",
              id: "recurring-mar",
              occurrencesPerMonth: 1,
              recurrence: {
                startMonth: "2026-03",
              },
              subtotal: 120000,
              total: 120000,
            },
          ],
        },
      }),
      listMonthsWithExpenses: jest.fn().mockResolvedValue(["2026-03"]),
      listAll: jest.fn(),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesCopyableMonths({
      query: {
        targetMonth: "2026-04",
      },
      repository,
    });

    expect(repository.getByMonth).toHaveBeenCalledWith("2026-03");
    expect(result).toEqual({
      defaultSourceMonth: null,
      sourceMonths: [],
      targetMonth: "2026-04",
    });
  });

  it("exposes a previous month that mixes plain expenses with loans or recurring expenses", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: createGetByMonth({
        "2026-03": {
          items: [
            {
              currency: "ARS",
              description: "Préstamo Carlos",
              id: "loan-mar",
              loan: {
                direction: "payable",
                installmentCount: 6,
                startMonth: "2026-03",
              },
              occurrencesPerMonth: 1,
              subtotal: 9000,
              total: 9000,
            },
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-mar",
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
          ],
        },
      }),
      listMonthsWithExpenses: jest.fn().mockResolvedValue(["2026-03"]),
      listAll: jest.fn(),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesCopyableMonths({
      query: {
        targetMonth: "2026-04",
      },
      repository,
    });

    expect(result).toEqual({
      defaultSourceMonth: "2026-03",
      sourceMonths: ["2026-03"],
      targetMonth: "2026-04",
    });
  });

  it("returns empty copyable months when the previous month has no expenses", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: createGetByMonth({
        "2026-02": {
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
        },
      }),
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
      getByMonth: createGetByMonth({}),
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
      getByMonth: createGetByMonth({
        "2025-12": {
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
        },
      }),
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
