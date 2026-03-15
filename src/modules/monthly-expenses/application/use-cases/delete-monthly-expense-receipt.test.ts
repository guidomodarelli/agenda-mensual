import type { MonthlyExpenseReceiptsRepository } from "../../domain/repositories/monthly-expense-receipts-repository";
import { deleteMonthlyExpenseReceipt } from "./delete-monthly-expense-receipt";

describe("deleteMonthlyExpenseReceipt", () => {
  it("deletes a receipt by file id", async () => {
    const repository: MonthlyExpenseReceiptsRepository = {
      deleteReceipt: jest.fn().mockResolvedValue(undefined),
      renameExpenseFolder: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn(),
      verifyReceipt: jest.fn(),
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
      deleteReceipt: jest.fn(),
      renameExpenseFolder: jest.fn(),
      saveReceipt: jest.fn(),
      verifyFolders: jest.fn(),
      verifyReceipt: jest.fn(),
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
