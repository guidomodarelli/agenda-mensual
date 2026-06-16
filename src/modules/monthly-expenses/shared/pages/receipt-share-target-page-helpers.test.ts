import type { MonthlyExpensesDocumentResult } from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";
import { createMonthlyExpensesDocument } from "@/modules/monthly-expenses/domain/value-objects/monthly-expenses-document";

import {
  appendUploadedReceiptToExpenseItem,
  deriveExpenseSearchQueryFromFileName,
  getCurrentMonthIdentifier,
  getRemainingReceiptPayments,
  normalizeExpenseItemsForSave,
  suggestExpenseIdForSharedReceipt,
  type ReceiptSuggestionExpense,
  type UploadedSharedReceipt,
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

  it("keeps an uploaded shared receipt on an expense that already has payment records", () => {
    const existingReceipt = {
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      coveredPayments: 1,
      fileId: "existing-receipt-file-id",
      fileName: "existing.pdf",
      fileViewUrl: "https://drive.google.com/file/d/existing-receipt-file-id/view",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    };
    const item: MonthlyExpensesDocumentResult["items"][number] = {
      currency: "ARS",
      description: "Internet",
      id: "expense-1",
      occurrencesPerMonth: 2,
      paymentRecords: [
        {
          coveredPayments: 1,
          id: "legacy-receipt-existing-receipt-file-id",
          receipt: existingReceipt,
          registeredAt: null,
        },
      ],
      receipts: [existingReceipt],
      subtotal: 45,
      total: 45,
    };
    const uploadedReceipt: UploadedSharedReceipt = {
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      coveredPayments: 1,
      fileId: "uploaded-receipt-file-id",
      fileName: "comprobante.pdf",
      fileViewUrl: "https://drive.google.com/file/d/uploaded-receipt-file-id/view",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    };

    const updatedItem = appendUploadedReceiptToExpenseItem(item, uploadedReceipt);

    expect(
      updatedItem.paymentRecords?.some(
        (paymentRecord) =>
          paymentRecord.receipt?.fileId === "uploaded-receipt-file-id",
      ),
    ).toBe(true);

    const savedDocument = createMonthlyExpensesDocument(
      {
        items: normalizeExpenseItemsForSave([updatedItem]),
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    const savedFileIds = (savedDocument.items[0]?.paymentRecords ?? [])
      .map((paymentRecord) => paymentRecord.receipt?.fileId)
      .filter(Boolean);

    expect(savedFileIds).toContain("uploaded-receipt-file-id");
    expect(savedFileIds).toContain("existing-receipt-file-id");
  });
});
