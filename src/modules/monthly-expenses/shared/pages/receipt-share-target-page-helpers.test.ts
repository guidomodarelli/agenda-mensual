import type { MonthlyExpensesDocumentResult } from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";

import {
  deriveExpenseSearchQueryFromFileName,
  getCurrentMonthIdentifier,
  getRemainingReceiptPayments,
  normalizeExpenseItemsForSave,
  suggestExpenseIdForSharedReceipt,
  type ReceiptSuggestionExpense,
} from "./receipt-share-target-page-helpers";

describe("receipt share target helpers", () => {
  it("formats current month using YYYY-MM", () => {
    expect(
      getCurrentMonthIdentifier(new Date("2026-03-17T12:00:00.000Z")),
    ).toBe("2026-03");
  });

  it("derives a search query from receipt file names", () => {
    expect(
      deriveExpenseSearchQueryFromFileName("2026-03-17_luz-casa.PDF"),
    ).toBe("luz casa");
  });

  it("suggests the best matching expense id using fuzzy ranking", () => {
    const expenses: ReceiptSuggestionExpense[] = [
      {
        description: "Agua",
        id: "expense-1",
      },
      {
        description: "Luz de casa",
        id: "expense-2",
      },
      {
        description: "Despensa",
        id: "expense-3",
      },
    ];

    expect(
      suggestExpenseIdForSharedReceipt({
        expenses,
        fileName: "ticket-luz-casa.pdf",
      }),
    ).toBe("expense-2");
  });

  it("returns remaining covered payments clamped to zero", () => {
    expect(
      getRemainingReceiptPayments({
        coveredPaymentsByReceipts: 2,
        manualCoveredPayments: 1,
        occurrencesPerMonth: 2,
      }),
    ).toBe(0);
  });

  it("preserves the occurrences unit when normalizing items for save", () => {
    const items: MonthlyExpensesDocumentResult["items"] = [
      {
        currency: "ARS",
        description: "Clases de ingles",
        id: "expense-1",
        occurrencesPerMonth: 4,
        occurrencesUnit: "semanas",
        subtotal: 5000,
        total: 20000,
      },
      {
        currency: "ARS",
        description: "Internet",
        id: "expense-2",
        occurrencesPerMonth: 1,
        subtotal: 100,
        total: 100,
      },
    ];

    const normalizedItems = normalizeExpenseItemsForSave(items);

    expect(normalizedItems[0]).toMatchObject({
      occurrencesPerMonth: 4,
      occurrencesUnit: "semanas",
    });
    expect(normalizedItems[1]).not.toHaveProperty("occurrencesUnit");
  });
});
