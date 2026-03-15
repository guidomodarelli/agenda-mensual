import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpenseReceiptsRepository } from "../../domain/repositories/monthly-expense-receipts-repository";
import {
  createMonthlyExpensesDocument,
  type MonthlyExpensesDocument,
  toMonthlyExpensesDocumentInput,
} from "../../domain/value-objects/monthly-expenses-document";
import type { SaveMonthlyExpensesCommand } from "../commands/save-monthly-expenses-command";
import {
  toStoredMonthlyExpensesDocumentResult,
  type StoredMonthlyExpensesDocumentResult,
} from "../results/stored-monthly-expenses-document-result";
import type { MonthlyExchangeRateSnapshot } from "@/modules/exchange-rates/domain/entities/monthly-exchange-rate-snapshot";

interface SaveMonthlyExpensesDocumentDependencies {
  command: SaveMonthlyExpensesCommand;
  getExchangeRateSnapshot: (
    month: string,
  ) => Promise<MonthlyExchangeRateSnapshot>;
  receiptsRepository?: MonthlyExpenseReceiptsRepository;
  repository: MonthlyExpensesRepository;
}

async function syncReceiptFolderRenames({
  currentDocument,
  nextDocument,
  receiptsRepository,
}: {
  currentDocument: MonthlyExpensesDocument;
  nextDocument: MonthlyExpensesDocument;
  receiptsRepository: MonthlyExpenseReceiptsRepository;
}): Promise<void> {
  const currentItemsById = new Map(
    currentDocument.items.map((item) => [item.id, item]),
  );

  for (const nextItem of nextDocument.items) {
    const currentItem = currentItemsById.get(nextItem.id);

    if (!currentItem) {
      continue;
    }

    if (currentItem.description === nextItem.description) {
      continue;
    }

    const currentFolderId =
      currentItem.folders?.allReceiptsFolderId?.trim() ||
      currentItem.receipts[0]?.allReceiptsFolderId?.trim();
    const nextFolderId =
      nextItem.folders?.allReceiptsFolderId?.trim() ||
      nextItem.receipts[0]?.allReceiptsFolderId?.trim();

    if (!currentFolderId || !nextFolderId || currentFolderId !== nextFolderId) {
      continue;
    }

    await receiptsRepository.renameExpenseFolder({
      folderId: nextFolderId,
      nextDescription: nextItem.description,
    });
  }
}

export async function saveMonthlyExpensesDocument({
  command,
  getExchangeRateSnapshot,
  receiptsRepository,
  repository,
}: SaveMonthlyExpensesDocumentDependencies): Promise<StoredMonthlyExpensesDocumentResult> {
  const validatedBaseDocument: MonthlyExpensesDocument = createMonthlyExpensesDocument(
    command,
    "Saving monthly expenses",
  );
  const exchangeRateSnapshot = await getExchangeRateSnapshot(
    validatedBaseDocument.month,
  );
  const currentDocument = receiptsRepository
    ? await repository.getByMonth(validatedBaseDocument.month)
    : null;
  const validatedDocument: MonthlyExpensesDocument = createMonthlyExpensesDocument(
    {
      ...toMonthlyExpensesDocumentInput(validatedBaseDocument),
      exchangeRateSnapshot: {
        blueRate: exchangeRateSnapshot.blueRate,
        month: exchangeRateSnapshot.month,
        officialRate: exchangeRateSnapshot.officialRate,
        solidarityRate: exchangeRateSnapshot.solidarityRate,
      },
    },
    "Saving monthly expenses",
  );

  if (currentDocument && receiptsRepository) {
    await syncReceiptFolderRenames({
      currentDocument,
      nextDocument: validatedDocument,
      receiptsRepository,
    });
  }

  return toStoredMonthlyExpensesDocumentResult(
    await repository.save(validatedDocument),
  );
}
