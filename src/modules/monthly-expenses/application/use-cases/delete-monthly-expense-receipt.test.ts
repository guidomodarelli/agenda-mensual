import { vi, describe, it, expect } from "vitest";
import type { MonthlyExpenseReceiptsRepository } from "../../domain/repositories/monthly-expense-receipts-repository";
import { deleteMonthlyExpenseReceipt } from "./delete-monthly-expense-receipt";

describe("deleteMonthlyExpenseReceipt", () => {
  it("deletes a receipt by file id", async () => {
    const repository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: vi.fn().mockResolvedValue(undefined),
      renameExpenseFolder: vi.fn(),
      renameReceiptFile: vi.fn(),
      saveReceipt: vi.fn(),
      verifyFolders: vi.fn(),
      verifyReceipt: vi.fn(),
    };

    await deleteMonthlyExpenseReceipt({
      command: {
        fileId: "receipt-file-id",
      },
      repository,
    });

    expect(repository.deleteReceipt).toHaveBeenCalledWith({
      fileId: "receipt-file-id",
    });
  });

  it("rejects empty file ids", async () => {
    const repository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: vi.fn(),
      renameExpenseFolder: vi.fn(),
      renameReceiptFile: vi.fn(),
      saveReceipt: vi.fn(),
      verifyFolders: vi.fn(),
      verifyReceipt: vi.fn(),
    };

    await expect(
      deleteMonthlyExpenseReceipt({
        command: {
          fileId: "   ",
        },
        repository,
      }),
    ).rejects.toThrow(
      "Monthly expense receipt deletion requires a file id.",
    );

    expect(repository.deleteReceipt).not.toHaveBeenCalled();
  });
});
