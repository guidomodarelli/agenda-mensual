import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import { saveMonthlyExpensesDocument } from "./save-monthly-expenses-document";

describe("saveMonthlyExpensesDocument", () => {
  it("delegates a validated monthly document to the repository", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      save: jest.fn().mockResolvedValue({
        id: "monthly-expenses-file-id",
        month: "2026-03",
        name: "monthly-expenses-2026-03.json",
        viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
      }),
    };

    const result = await saveMonthlyExpensesDocument({
      command: {
        items: [
          {
            currency: "ARS",
            description: "Expensas",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 55032.07,
          },
        ],
        month: "2026-03",
      },
      repository,
    });

    expect(repository.save).toHaveBeenCalledWith({
      items: [
        {
          currency: "ARS",
          description: "Expensas",
          id: "expense-1",
          occurrencesPerMonth: 1,
          subtotal: 55032.07,
          total: 55032.07,
        },
      ],
      month: "2026-03",
    });
    expect(result).toEqual({
      id: "monthly-expenses-file-id",
      month: "2026-03",
      name: "monthly-expenses-2026-03.json",
      viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
    });
  });
});
