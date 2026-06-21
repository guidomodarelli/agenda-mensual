import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpenseReceiptsRepository } from "../../domain/repositories/monthly-expense-receipts-repository";
import { createMonthlyExpensesDocument } from "../../domain/value-objects/monthly-expenses-document";
import { getMonthlyExpensesDocument } from "./get-monthly-expenses-document";
import {
  MissingMonthlyExchangeRateError,
} from "@/modules/exchange-rates/domain/errors/missing-monthly-exchange-rate-error";

function buildLoanDocument(month: string, startMonth: string) {
  return createMonthlyExpensesDocument(
    {
      items: [
        {
          currency: "ARS",
          description: "Notebook",
          id: "loan-1",
          loan: { installmentCount: 6, startMonth },
          occurrencesPerMonth: 1,
          subtotal: 1000,
        },
      ],
      month,
    },
    "Building loan document",
  );
}

const getExchangeRateSnapshot = jest.fn().mockResolvedValue({
  blueRate: 1290,
  iibbRateDecimalUsed: 0.02,
  month: "2026-03",
  officialRate: 1200,
  solidarityRate: 1476,
  source: "ambito-historico-general",
  sourceDateIso: "2026-03-31",
  updatedAtIso: "2026-03-14T12:00:00.000Z",
});

describe("getMonthlyExpensesDocument", () => {
  beforeEach(() => {
    getExchangeRateSnapshot.mockClear();
  });

  it("returns an empty monthly document with the selected month snapshot when there is no stored file", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(null),
      listAll: jest.fn(),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        month: "2026-03",
      },
      repository,
    });

    expect(result).toEqual({
      exchangeRateLoadError: null,
      exchangeRateSnapshot: {
        blueRate: 1290,
        month: "2026-03",
        officialRate: 1200,
        solidarityRate: 1476,
      },
      items: [],
      month: "2026-03",
    });
  });

  it("backfills a stored document when the snapshot is missing and notifies of the persisted write", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [],
        month: "2026-03",
      }),
      listAll: jest.fn(),
      save: jest.fn(),
    };
    const onExchangeRateSnapshotPersisted = jest.fn();

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      onExchangeRateSnapshotPersisted,
      query: {
        month: "2026-03",
      },
      repository,
    });

    expect(result).toEqual({
      exchangeRateLoadError: null,
      exchangeRateSnapshot: {
        blueRate: 1290,
        month: "2026-03",
        officialRate: 1200,
        solidarityRate: 1476,
      },
      items: [],
      month: "2026-03",
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(onExchangeRateSnapshotPersisted).toHaveBeenCalledTimes(1);
  });

  it("returns the backfilled snapshot without persisting when persistence is disabled", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [],
        month: "2026-03",
      }),
      listAll: jest.fn(),
      save: jest.fn(),
    };
    const onExchangeRateSnapshotPersisted = jest.fn();

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      onExchangeRateSnapshotPersisted,
      persistMissingExchangeRateSnapshot: false,
      query: {
        month: "2026-03",
      },
      repository,
    });

    expect(result.exchangeRateSnapshot).toEqual({
      blueRate: 1290,
      month: "2026-03",
      officialRate: 1200,
      solidarityRate: 1476,
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(onExchangeRateSnapshotPersisted).not.toHaveBeenCalled();
  });

  it("does not notify a persisted write when the stored snapshot is already present", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        exchangeRateSnapshot: {
          blueRate: 1290,
          month: "2026-03",
          officialRate: 1200,
          solidarityRate: 1476,
        },
        items: [],
        month: "2026-03",
      }),
      listAll: jest.fn(),
      save: jest.fn(),
    };
    const onExchangeRateSnapshotPersisted = jest.fn();

    await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      onExchangeRateSnapshotPersisted,
      query: {
        month: "2026-03",
      },
      repository,
    });

    expect(repository.save).not.toHaveBeenCalled();
    expect(onExchangeRateSnapshotPersisted).not.toHaveBeenCalled();
  });

  it("verifies folder status for items without receipts and exposes warning/error states", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              monthlyFolderId: "receipt-month-folder-id",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [],
            subtotal: 100,
            total: 100,
          },
        ],
        month: "2026-03",
      }),
      listAll: jest.fn(),
      save: jest.fn(),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      renameReceiptFile: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn().mockResolvedValue({
        allReceiptsFolderStatus: "missing",
        monthlyFolderStatus: "trashed",
      }),
      verifyReceipt: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        month: "2026-03",
      },
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.verifyFolders).toHaveBeenCalledWith({
      allReceiptsFolderId: "receipt-folder-id",
      monthlyFolderId: "receipt-month-folder-id",
    });
    expect(result.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderStatus: "missing",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderStatus: "trashed",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    });
  });

  it("skips Drive verification when includeDriveStatuses is false", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
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
      save: jest.fn(),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      renameReceiptFile: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn(),
      verifyReceipt: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-03",
      },
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.verifyReceipt).not.toHaveBeenCalled();
    expect(receiptsRepository.verifyFolders).not.toHaveBeenCalled();
    expect(result.items[0]?.receipts?.[0]).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      coveredPayments: 1,
      fileId: "receipt-file-id",
      fileName: "comprobante.pdf",
      fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    });
  });

  it("verifies receipt Drive statuses sequentially to avoid request bursts", async () => {
    let activeVerifications = 0;
    let peakConcurrentVerifications = 0;

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
                allReceiptsFolderId: "receipt-folder-id-1",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id-1",
                fileId: "receipt-file-id-1",
                fileName: "comprobante-1.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id-1/view",
                monthlyFolderId: "receipt-month-folder-id-1",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id-1",
              },
              {
                allReceiptsFolderId: "receipt-folder-id-2",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id-2",
                fileId: "receipt-file-id-2",
                fileName: "comprobante-2.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id-2/view",
                monthlyFolderId: "receipt-month-folder-id-2",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id-2",
              },
            ],
            subtotal: 100,
            total: 100,
          },
        ],
        month: "2026-03",
      }),
      listAll: jest.fn(),
      save: jest.fn(),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      renameReceiptFile: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn().mockResolvedValue({
        allReceiptsFolderStatus: "normal",
        monthlyFolderStatus: "normal",
      }),
      verifyReceipt: jest.fn().mockImplementation(async () => {
        activeVerifications += 1;
        peakConcurrentVerifications = Math.max(
          peakConcurrentVerifications,
          activeVerifications,
        );

        await new Promise((resolve) => setTimeout(resolve, 0));

        activeVerifications -= 1;

        return {
          allReceiptsFolderStatus: "normal",
          fileStatus: "normal",
          monthlyFolderStatus: "normal",
        };
      }),
    };

    await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        month: "2026-03",
      },
      receiptsRepository,
      repository,
    });

    expect(peakConcurrentVerifications).toBe(1);
  });

  it("verifies the shared receipts folder even when the monthly folder reference is empty", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
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
            receipts: [],
            subtotal: 100,
            total: 100,
          },
        ],
        month: "2026-03",
      }),
      listAll: jest.fn(),
      save: jest.fn(),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      renameReceiptFile: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn().mockResolvedValue({
        allReceiptsFolderStatus: "missing",
      }),
      verifyReceipt: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        month: "2026-03",
      },
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.verifyFolders).toHaveBeenCalledWith({
      allReceiptsFolderId: "receipt-folder-id",
      monthlyFolderId: "",
    });
    expect(result.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderStatus: "missing",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "",
      monthlyFolderViewUrl: "",
    });
  });

  it("preserves an explicitly cleared monthly folder id instead of falling back to receipt metadata", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
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
      save: jest.fn(),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      renameReceiptFile: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn().mockResolvedValue({
        allReceiptsFolderStatus: "normal",
        monthlyFolderStatus: "missing",
      }),
      verifyReceipt: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        month: "2026-03",
      },
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.verifyFolders).toHaveBeenCalledWith({
      allReceiptsFolderId: "receipt-folder-id",
      monthlyFolderId: "",
    });
    expect(result.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderStatus: "normal",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "",
      monthlyFolderStatus: "missing",
      monthlyFolderViewUrl: "",
    });
  });

  it("falls back to receipt folder metadata only when top-level folder metadata is absent", async () => {
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
      save: jest.fn(),
    };
    const receiptsRepository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      renameReceiptFile: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn().mockResolvedValue({
        allReceiptsFolderStatus: "normal",
        monthlyFolderStatus: "missing",
      }),
      verifyReceipt: jest.fn(),
    };

    await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        month: "2026-03",
      },
      receiptsRepository,
      repository,
    });

    expect(receiptsRepository.verifyFolders).toHaveBeenCalledWith({
      allReceiptsFolderId: "receipt-folder-id",
      monthlyFolderId: "receipt-month-folder-id",
    });
  });

  it("projects loans from other months into the selected month", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(null),
      listAll: jest.fn().mockResolvedValue([buildLoanDocument("2026-01", "2026-01")]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-03",
      },
      repository,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("loan-1");
    expect(result.items[0]?.loan?.startMonth).toBe("2026-01");
    expect(result.items[0]?.loan?.paidInstallments).toBe(3);
  });

  it("drops a stored loan a newer canonical snapshot pushed out of range", async () => {
    const storedDocument = createMonthlyExpensesDocument(
      {
        exchangeRateSnapshot: {
          blueRate: 1290,
          month: "2026-08",
          officialRate: 1200,
          solidarityRate: 1476,
        },
        items: [
          {
            currency: "ARS",
            description: "Notebook",
            id: "loan-1",
            loan: { installmentCount: 12, startMonth: "2026-03" },
            occurrencesPerMonth: 1,
            subtotal: 1000,
          },
        ],
        month: "2026-08",
      },
      "Building stored document",
    );
    const shortenedCanonical = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Notebook",
            id: "loan-1",
            loan: { installmentCount: 3, startMonth: "2026-03" },
            occurrencesPerMonth: 1,
            subtotal: 1000,
          },
        ],
        month: "2026-09",
      },
      "Building shortened canonical",
    );
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(storedDocument),
      listAll: jest.fn().mockResolvedValue([storedDocument, shortenedCanonical]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-08",
      },
      repository,
    });

    expect(result.items).toHaveLength(0);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("keeps a pre-start recurring copy when an existing one-off is converted into recurring", async () => {
    // The store shares one recurrence definition per id, so after converting a
    // one-off (replicated into January) into a recurring expense starting in
    // March, January loads carrying that recurrence even though its month is
    // before the start. Dropping it would erase the past monthly total.
    const januaryDocument = createMonthlyExpensesDocument(
      {
        exchangeRateSnapshot: {
          blueRate: 1290,
          month: "2026-01",
          officialRate: 1200,
          solidarityRate: 1476,
        },
        items: [
          {
            currency: "ARS",
            description: "Alquiler",
            id: "rent-1",
            occurrencesPerMonth: 1,
            recurrence: { startMonth: "2026-03" },
            subtotal: 350000,
          },
        ],
        month: "2026-01",
      },
      "Building January document",
    );
    const marchDocument = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Alquiler",
            id: "rent-1",
            occurrencesPerMonth: 1,
            recurrence: { startMonth: "2026-03" },
            subtotal: 350000,
          },
        ],
        month: "2026-03",
      },
      "Building March document",
    );
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(januaryDocument),
      listAll: jest.fn().mockResolvedValue([januaryDocument, marchDocument]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-01",
      },
      repository,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("rent-1");
    expect(result.items[0]?.subtotal).toBe(350000);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("does not re-project a loan the stored month marks as excluded", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        excludedLoanIds: ["loan-1"],
        exchangeRateSnapshot: {
          blueRate: 1290,
          month: "2026-03",
          officialRate: 1200,
          solidarityRate: 1476,
        },
        items: [],
        month: "2026-03",
      }),
      listAll: jest.fn().mockResolvedValue([buildLoanDocument("2026-01", "2026-01")]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-03",
      },
      repository,
    });

    expect(result.items).toHaveLength(0);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("does not persist projected loans when there is no stored document", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(null),
      listAll: jest.fn().mockResolvedValue([buildLoanDocument("2026-01", "2026-01")]),
      save: jest.fn(),
    };

    await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-03",
      },
      repository,
    });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it("excludes projected loans from the document persisted during snapshot backfill", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [],
            subtotal: 100,
            total: 100,
          },
        ],
        month: "2026-03",
      }),
      listAll: jest.fn().mockResolvedValue([buildLoanDocument("2026-01", "2026-01")]),
      save: jest.fn().mockImplementation(async (document) => document),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-03",
      },
      repository,
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    const savedDocument = (repository.save as jest.Mock).mock.calls[0][0];
    expect(savedDocument.items.map((item: { id: string }) => item.id)).toEqual([
      "expense-1",
    ]);
    expect(result.items.map((item) => item.id).sort()).toEqual([
      "expense-1",
      "loan-1",
    ]);
  });

  it("refreshes a stored loan definition from a newer snapshot while preserving its payment state", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue({
        exchangeRateSnapshot: {
          blueRate: 1290,
          month: "2026-03",
          officialRate: 1200,
          solidarityRate: 1476,
        },
        items: [
          {
            currency: "ARS",
            description: "Notebook",
            id: "loan-1",
            loan: { installmentCount: 6, startMonth: "2026-01" },
            manualCoveredPayments: 1,
            occurrencesPerMonth: 1,
            paymentRecords: [{ coveredPayments: 1, id: "paid-record" }],
            receipts: [],
            subtotal: 1000,
          },
        ],
        month: "2026-03",
      }),
      listAll: jest.fn().mockResolvedValue([
        buildLoanDocument("2026-01", "2026-01"),
        createMonthlyExpensesDocument(
          {
            items: [
              {
                currency: "ARS",
                description: "Notebook",
                id: "loan-1",
                loan: { installmentCount: 9, startMonth: "2026-01" },
                occurrencesPerMonth: 1,
                subtotal: 1500,
              },
            ],
            month: "2026-05",
          },
          "Building newer snapshot",
        ),
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      query: {
        includeDriveStatuses: false,
        month: "2026-03",
      },
      repository,
    });

    const loanItem = result.items.find((item) => item.id === "loan-1");
    expect(result.items).toHaveLength(1);
    expect(loanItem?.subtotal).toBe(1500);
    expect(loanItem?.loan?.installmentCount).toBe(9);
    // Per-month payment state survives the canonical refresh.
    expect(loanItem?.manualCoveredPayments).toBe(1);
    expect(loanItem?.paymentRecords).toHaveLength(1);
    // The refresh is never persisted on load.
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("returns a non-blocking exchange rate warning when the selected month has no historical rates", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn().mockResolvedValue(null),
      listAll: jest.fn(),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesDocument({
      getExchangeRateSnapshot: jest
        .fn()
        .mockRejectedValue(new MissingMonthlyExchangeRateError("2026-05")),
      query: {
        month: "2026-05",
      },
      repository,
    });

    expect(result).toEqual({
      exchangeRateLoadError:
        "No pudimos cargar la cotización histórica del mes seleccionado. Igual podés seguir cargando y guardando gastos.",
      exchangeRateSnapshot: null,
      items: [],
      month: "2026-05",
    });
  });
});
