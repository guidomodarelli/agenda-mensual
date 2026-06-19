import { createEmptyMonthlyExpensesDocumentResult } from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";
import type { MonthlyExpenseItemResult } from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";

import {
  copyMonthlyExpenseTemplatesToMonth,
  getChangedExpenseFields,
  getExpenseValidationMessage,
  getMaxManualCoveredPayments,
  toEditableRows,
  toSaveMonthlyExpensesCommand,
} from "./monthly-expenses-page";

describe("monthly expenses page mappers", () => {
  it("falls back to receipt monthly folder metadata when top-level folder metadata is blank", () => {
    const document = createEmptyMonthlyExpensesDocumentResult("2026-03");
    document.items = [
      {
        currency: "ARS",
        description: "Internet",
        folders: {
          allReceiptsFolderId: "receipt-folder-id",
          allReceiptsFolderViewUrl:
            "https://drive.google.com/drive/folders/receipt-folder-id",
          monthlyFolderId: undefined as unknown as string,
          monthlyFolderStatus: "missing",
          monthlyFolderViewUrl: undefined as unknown as string,
        },
        id: "expense-1",
        occurrencesPerMonth: 1,
        receipts: [
          {
            allReceiptsFolderId: "receipt-folder-id",
            allReceiptsFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-folder-id",
            coveredPayments: 1,
            fileId: "receipt-file-id",
            fileName: "comprobante.pdf",
            fileStatus: "normal",
            fileViewUrl:
              "https://drive.google.com/file/d/receipt-file-id/view",
            monthlyFolderId: "receipt-month-folder-id",
            monthlyFolderStatus: "normal",
            monthlyFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-month-folder-id",
          },
        ],
        subtotal: 100,
        total: 100,
      } as MonthlyExpenseItemResult,
    ];

    expect(toEditableRows(document)[0]).toEqual(
      expect.objectContaining({
        monthlyFolderId: "receipt-month-folder-id",
        monthlyFolderStatus: "normal",
        monthlyFolderViewUrl:
          "https://drive.google.com/drive/folders/receipt-month-folder-id",
      }),
    );
  });

  it("does not reconstruct a cleared monthly folder reference from receipt metadata", () => {
    const rows = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          folders: {
            allReceiptsFolderId: "receipt-folder-id",
            allReceiptsFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-folder-id",
            monthlyFolderId: "",
            monthlyFolderViewUrl: "",
          },
          id: "expense-1",
          occurrencesPerMonth: 1,
          receipts: [
            {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              coveredPayments: 1,
              fileId: "receipt-file-id",
              fileName: "comprobante.pdf",
              fileViewUrl:
                "https://drive.google.com/file/d/receipt-file-id/view",
              monthlyFolderId: "receipt-month-folder-id",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
          ],
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    });

    const command = toSaveMonthlyExpensesCommand({
      error: null,
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      hasReplicatedFromPreviousMonth: false,
      isSubmitting: false,
      month: "2026-03",
      rows,
    });

    expect(command.items[0]).toEqual(
      expect.objectContaining({
        folders: {
          allReceiptsFolderId: "receipt-folder-id",
          allReceiptsFolderViewUrl:
            "https://drive.google.com/drive/folders/receipt-folder-id",
          monthlyFolderId: "",
          monthlyFolderViewUrl: "",
        },
      }),
    );
  });

  it("does not reconstruct a cleared shared receipts folder reference from receipt metadata", () => {
    const rows = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          folders: {
            allReceiptsFolderId: "",
            allReceiptsFolderViewUrl: "",
            monthlyFolderId: "receipt-month-folder-id",
            monthlyFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-month-folder-id",
          },
          id: "expense-1",
          occurrencesPerMonth: 1,
          receipts: [
            {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              coveredPayments: 1,
              fileId: "receipt-file-id",
              fileName: "comprobante.pdf",
              fileViewUrl:
                "https://drive.google.com/file/d/receipt-file-id/view",
              monthlyFolderId: "receipt-month-folder-id",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
          ],
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    });

    const command = toSaveMonthlyExpensesCommand({
      error: null,
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      hasReplicatedFromPreviousMonth: false,
      isSubmitting: false,
      month: "2026-03",
      rows,
    });

    expect(command.items[0]?.folders).toBeUndefined();
  });

  it("does not copy loans that are no longer active in the destination month", () => {
    const sourceDocument = createEmptyMonthlyExpensesDocumentResult("2026-03");
    sourceDocument.items = [
      {
        currency: "ARS",
        description: "Prestamo",
        id: "expense-1",
        loan: {
          endMonth: "2026-04",
          installmentCount: 2,
          paidInstallments: 1,
          startMonth: "2026-03",
        },
        occurrencesPerMonth: 1,
        receipts: [],
        subtotal: 100,
        total: 100,
      },
    ];

    const copiedRows = copyMonthlyExpenseTemplatesToMonth(
      "2026-05",
      toEditableRows(sourceDocument),
    );

    expect(copiedRows).toHaveLength(0);
  });

  it("copies an active recurring expense into a later month", () => {
    const sourceDocument = createEmptyMonthlyExpensesDocumentResult("2026-03");
    sourceDocument.items = [
      {
        currency: "ARS",
        description: "Alquiler",
        id: "expense-1",
        occurrencesPerMonth: 1,
        recurrence: { startMonth: "2026-01", isActive: true, endMonth: null },
        receipts: [],
        subtotal: 350000,
        total: 350000,
      },
    ];

    const copiedRows = copyMonthlyExpenseTemplatesToMonth(
      "2026-05",
      toEditableRows(sourceDocument),
    );

    expect(copiedRows).toHaveLength(1);
    expect(copiedRows[0]?.isRecurring).toBe(true);
  });

  it("does not copy a cancelled recurring expense into a month past its end", () => {
    const sourceDocument = createEmptyMonthlyExpensesDocumentResult("2026-03");
    sourceDocument.items = [
      {
        currency: "ARS",
        description: "Alquiler",
        id: "expense-1",
        occurrencesPerMonth: 1,
        recurrence: {
          startMonth: "2026-01",
          endMonth: "2026-04",
          isActive: true,
        },
        receipts: [],
        subtotal: 350000,
        total: 350000,
      },
    ];

    const copiedRows = copyMonthlyExpenseTemplatesToMonth(
      "2026-05",
      toEditableRows(sourceDocument),
    );

    expect(copiedRows).toHaveLength(0);
  });

  it("synchronizes payment records from legacy manual coverage before saving", () => {
    const rows = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          manualCoveredPayments: 1,
          occurrencesPerMonth: 4,
          paymentRecords: [
            {
              coveredPayments: 1,
              id: "receipt-record-1",
              receipt: {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 1,
                fileId: "receipt-file-id",
                fileName: "comprobante.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
              registeredAt: "2026-03-10T10:00:00.000Z",
            },
            {
              coveredPayments: 1,
              id: "manual-record-1",
              registeredAt: "2026-03-11T10:00:00.000Z",
            },
          ],
          receipts: [
            {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              coveredPayments: 1,
              fileId: "receipt-file-id",
              fileName: "comprobante.pdf",
              fileViewUrl:
                "https://drive.google.com/file/d/receipt-file-id/view",
              monthlyFolderId: "receipt-month-folder-id",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
          ],
          subtotal: 100,
          total: 400,
        },
      ],
      month: "2026-03",
    });

    const command = toSaveMonthlyExpensesCommand({
      error: null,
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      hasReplicatedFromPreviousMonth: false,
      isSubmitting: false,
      month: "2026-03",
      rows: [
        {
          ...rows[0],
          manualCoveredPayments: "3",
        },
      ],
    });

    expect(command.items[0]?.paymentRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coveredPayments: 3,
          id: "manual-record-1",
          registeredAt: "2026-03-11T10:00:00.000Z",
        }),
        expect.objectContaining({
          coveredPayments: 1,
          id: "receipt-record-1",
          registeredAt: "2026-03-10T10:00:00.000Z",
        }),
      ]),
    );
  });

  it("preserves multiple manual payment records before saving", () => {
    const rows = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          manualCoveredPayments: 3,
          occurrencesPerMonth: 4,
          paymentRecords: [
            {
              coveredPayments: 1,
              id: "receipt-record-1",
              receipt: {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 1,
                fileId: "receipt-file-id",
                fileName: "comprobante.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
              registeredAt: "2026-03-10T10:00:00.000Z",
            },
            {
              coveredPayments: 1,
              id: "manual-record-1",
              registeredAt: "2026-03-11T10:00:00.000Z",
            },
            {
              coveredPayments: 2,
              id: "manual-record-2",
              registeredAt: "2026-03-12T10:00:00.000Z",
            },
          ],
          receipts: [
            {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              coveredPayments: 1,
              fileId: "receipt-file-id",
              fileName: "comprobante.pdf",
              fileViewUrl:
                "https://drive.google.com/file/d/receipt-file-id/view",
              monthlyFolderId: "receipt-month-folder-id",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
          ],
          subtotal: 100,
          total: 400,
        },
      ],
      month: "2026-03",
    });

    const command = toSaveMonthlyExpensesCommand({
      error: null,
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      hasReplicatedFromPreviousMonth: false,
      isSubmitting: false,
      month: "2026-03",
      rows: [
        {
          ...rows[0],
          description: "Internet actualizado",
        },
      ],
    });

    expect(command.items[0]?.paymentRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coveredPayments: 1,
          id: "manual-record-1",
          registeredAt: "2026-03-11T10:00:00.000Z",
        }),
        expect.objectContaining({
          coveredPayments: 2,
          id: "manual-record-2",
          registeredAt: "2026-03-12T10:00:00.000Z",
        }),
        expect.objectContaining({
          coveredPayments: 1,
          id: "receipt-record-1",
          registeredAt: "2026-03-10T10:00:00.000Z",
        }),
      ]),
    );
  });

  it("uses legacy manual coverage when payment records are empty", () => {
    const maxManualCoveredPayments = getMaxManualCoveredPayments({
      row: {
        manualCoveredPayments: "2",
        occurrencesPerMonth: "5",
        paymentRecords: [],
        receipts: [
          {
            allReceiptsFolderId: "receipt-folder-id",
            allReceiptsFolderStatus: undefined,
            allReceiptsFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-folder-id",
            coveredPayments: 1,
            fileId: "receipt-file-id",
            fileName: "comprobante.pdf",
            fileStatus: undefined,
            fileViewUrl:
              "https://drive.google.com/file/d/receipt-file-id/view",
            monthlyFolderId: "receipt-month-folder-id",
            monthlyFolderStatus: undefined,
            monthlyFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-month-folder-id",
          },
        ],
      },
    });

    expect(maxManualCoveredPayments).toBe(2);
  });

  it("requires a valid receipt share phone when creating an expense", () => {
    const editableRow = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          occurrencesPerMonth: 1,
          receiptSharePhoneDigits: "",
          requiresReceiptShare: true,
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    })[0];

    expect(getExpenseValidationMessage("2026-03", editableRow, "create")).toBe(
      "Corregí los errores antes de continuar.",
    );
  });

  it("does not block edit mode for legacy invalid receipt share phone values", () => {
    const editableRow = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          occurrencesPerMonth: 1,
          receiptSharePhoneDigits: "",
          requiresReceiptShare: true,
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    })[0];

    // Sharing was already enabled on the original row, so an empty legacy phone
    // is tolerated while editing other fields.
    expect(
      getExpenseValidationMessage("2026-03", editableRow, "edit", editableRow),
    ).toBeNull();
  });

  it("blocks edit mode when sharing is newly enabled without a phone", () => {
    const originalRow = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          occurrencesPerMonth: 1,
          requiresReceiptShare: false,
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    })[0];
    const draft = { ...originalRow, requiresReceiptShare: true };

    expect(
      getExpenseValidationMessage("2026-03", draft, "edit", originalRow),
    ).toBe("Corregí los errores antes de continuar.");
  });

  it("blocks edit mode when the entered receipt share phone is invalid", () => {
    const editableRow = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          occurrencesPerMonth: 1,
          receiptSharePhoneDigits: "123",
          requiresReceiptShare: true,
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    })[0];

    expect(getExpenseValidationMessage("2026-03", editableRow, "edit")).toBe(
      "Corregí los errores antes de continuar.",
    );
  });

  it("blocks saving a recurring expense without a start month", () => {
    const [recurringRow] = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-01", isActive: true, endMonth: null },
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    expect(
      getExpenseValidationMessage(
        "2026-03",
        { ...recurringRow, recurrenceStartMonth: "" },
        "edit",
      ),
    ).toBe("Corregí los errores antes de continuar.");
  });

  it("blocks saving a recurring expense whose end month precedes its start month", () => {
    const [recurringRow] = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-01", isActive: true, endMonth: null },
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    expect(
      getExpenseValidationMessage(
        "2026-03",
        {
          ...recurringRow,
          recurrenceStartMonth: "2026-05",
          recurrenceEndMonth: "2026-01",
        },
        "edit",
      ),
    ).toBe("Corregí los errores antes de continuar.");
  });

  it("allows saving a valid recurring expense", () => {
    const [recurringRow] = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-01", endMonth: "2026-09", isActive: true },
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    expect(
      getExpenseValidationMessage("2026-03", recurringRow, "create"),
    ).toBeNull();
  });

  it("blocks saving a recurring expense whose start month is after the visible month", () => {
    const [recurringRow] = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-01", isActive: true, endMonth: null },
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    expect(
      getExpenseValidationMessage(
        "2026-03",
        { ...recurringRow, recurrenceStartMonth: "2026-05" },
        "create",
      ),
    ).toBe("Corregí los errores antes de continuar.");
  });

  it("blocks saving a recurring expense whose end month is before the visible month", () => {
    const [recurringRow] = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-01", endMonth: "2026-05", isActive: true },
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    expect(
      getExpenseValidationMessage("2026-08", recurringRow, "edit"),
    ).toBe("Corregí los errores antes de continuar.");
  });

  it("allows saving a recurring expense cancelled exactly in the visible month", () => {
    const [recurringRow] = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-01", endMonth: "2026-06", isActive: true },
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-06",
    });

    expect(
      getExpenseValidationMessage("2026-06", recurringRow, "edit"),
    ).toBeNull();
  });

  it("builds a recurrence in the save command when creating a recurring expense", () => {
    const recurringRow = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: { startMonth: "2026-03", isActive: true, endMonth: null },
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    const command = toSaveMonthlyExpensesCommand({
      error: null,
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      hasReplicatedFromPreviousMonth: false,
      isSubmitting: false,
      month: "2026-03",
      rows: recurringRow,
    });

    expect(command.items[0]).toEqual(
      expect.objectContaining({
        recurrence: { startMonth: "2026-03" },
      }),
    );
    expect(command.items[0]).not.toHaveProperty("loan");
  });

  it("carries the cancellation end month into the save command", () => {
    const cancelledRow = toEditableRows({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          occurrencesPerMonth: 1,
          recurrence: {
            startMonth: "2026-03",
            endMonth: "2026-06",
            isActive: false,
          },
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-08",
    });

    const command = toSaveMonthlyExpensesCommand({
      error: null,
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      hasReplicatedFromPreviousMonth: false,
      isSubmitting: false,
      month: "2026-08",
      rows: cancelledRow,
    });

    expect(command.items[0]).toEqual(
      expect.objectContaining({
        recurrence: { startMonth: "2026-03", endMonth: "2026-06" },
      }),
    );
  });

  it("detects recurrence month edits as changed fields", () => {
    const sourceDocument = createEmptyMonthlyExpensesDocumentResult("2026-03");
    sourceDocument.items = [
      {
        currency: "ARS",
        description: "Alquiler",
        id: "expense-1",
        occurrencesPerMonth: 1,
        recurrence: { startMonth: "2026-01", isActive: true, endMonth: null },
        receipts: [],
        subtotal: 350000,
        total: 350000,
      },
    ];
    const [originalRow] = toEditableRows(sourceDocument);

    const changedFields = getChangedExpenseFields(originalRow, {
      ...originalRow,
      recurrenceStartMonth: "2026-02",
      recurrenceEndMonth: "2026-09",
    });

    expect(changedFields.has("recurrenceStartMonth")).toBe(true);
    expect(changedFields.has("recurrenceEndMonth")).toBe(true);
  });

  it("detects toggling the recurring flag as a changed field", () => {
    const sourceDocument = createEmptyMonthlyExpensesDocumentResult("2026-03");
    sourceDocument.items = [
      {
        currency: "ARS",
        description: "Internet",
        id: "expense-1",
        occurrencesPerMonth: 1,
        receipts: [],
        subtotal: 20000,
        total: 20000,
      },
    ];
    const [originalRow] = toEditableRows(sourceDocument);

    const changedFields = getChangedExpenseFields(originalRow, {
      ...originalRow,
      isRecurring: true,
      recurrenceStartMonth: "2026-03",
    });

    expect(changedFields.has("isRecurring")).toBe(true);
  });
});
