import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpenseReceiptsRepository } from "../../domain/repositories/monthly-expense-receipts-repository";
import { saveMonthlyExpensesDocument } from "./save-monthly-expenses-document";

describe("saveMonthlyExpensesDocument", () => {
  it("delegates a validated monthly document with the snapshot to the repository", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn(),
      save: jest.fn().mockResolvedValue({
        id: "monthly-expenses-file-id",
        month: "2026-03",
        name: "gastos-mensuales-2026-marzo.json",
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
      getExchangeRateSnapshot: jest.fn().mockResolvedValue({
        blueRate: 1290,
        iibbRateDecimalUsed: 0.02,
        month: "2026-03",
        officialRate: 1200,
        solidarityRate: 1476,
        source: "ambito-historico-general",
        sourceDateIso: "2026-03-31",
        updatedAtIso: "2026-03-14T12:00:00.000Z",
      }),
      repository,
    });

    expect(repository.save).toHaveBeenCalledWith({
      exchangeRateSnapshot: {
        blueRate: 1290,
        month: "2026-03",
        officialRate: 1200,
        solidarityRate: 1476,
      },
      items: [
        {
          currency: "ARS",
          description: "Expensas",
          id: "expense-1",
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 55032.07,
          total: 55032.07,
        },
      ],
      month: "2026-03",
    });
    expect(result).toEqual({
      id: "monthly-expenses-file-id",
      month: "2026-03",
      name: "gastos-mensuales-2026-marzo.json",
      viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
    });
  });

  it("renames receipt folder when an existing expense description changes", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [
          {
            currency: "ARS",
            description: "Internet viejo",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
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
      }),
      listAll: jest.fn(),
      save: jest.fn().mockResolvedValue({
        id: "monthly-expenses-file-id",
        month: "2026-03",
        name: "gastos-mensuales-2026-marzo.json",
        viewUrl: null,
      }),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn().mockResolvedValue(undefined),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn(),
      verifyReceipt: jest.fn(),
    };

    await saveMonthlyExpensesDocument({
      command: {
        items: [
          {
            currency: "ARS",
            description: "Internet nuevo",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
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
          },
        ],
        month: "2026-03",
      },
      getExchangeRateSnapshot: jest.fn().mockResolvedValue({
        blueRate: 1290,
        iibbRateDecimalUsed: 0.02,
        month: "2026-03",
        officialRate: 1200,
        solidarityRate: 1476,
        source: "ambito-historico-general",
        sourceDateIso: "2026-03-31",
        updatedAtIso: "2026-03-14T12:00:00.000Z",
      }),
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.renameExpenseFolder).toHaveBeenCalledWith({
      folderId: "receipt-folder-id",
      nextDescription: "Internet nuevo",
    });
  });

  it("does not rename receipt folders when description remains unchanged", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
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
      }),
      listAll: jest.fn(),
      save: jest.fn().mockResolvedValue({
        id: "monthly-expenses-file-id",
        month: "2026-03",
        name: "gastos-mensuales-2026-marzo.json",
        viewUrl: null,
      }),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn().mockResolvedValue(undefined),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn(),
      verifyReceipt: jest.fn(),
    };

    await saveMonthlyExpensesDocument({
      command: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
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
          },
        ],
        month: "2026-03",
      },
      getExchangeRateSnapshot: jest.fn().mockResolvedValue({
        blueRate: 1290,
        iibbRateDecimalUsed: 0.02,
        month: "2026-03",
        officialRate: 1200,
        solidarityRate: 1476,
        source: "ambito-historico-general",
        sourceDateIso: "2026-03-31",
        updatedAtIso: "2026-03-14T12:00:00.000Z",
      }),
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.renameExpenseFolder).not.toHaveBeenCalled();
  });
});
