import {
  compareFuzzyMatchRank,
  getFuzzyMatchRank,
  normalizeSearchValue,
} from "@/components/monthly-expenses/fuzzy-search";
import type { SaveMonthlyExpensesCommand } from "@/modules/monthly-expenses/application/commands/save-monthly-expenses-command";
import type { MonthlyExpensesDocumentResult } from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";

const RECEIPT_NOISE_WORDS = new Set([
  "comprobante",
  "factura",
  "pago",
  "receipt",
  "recibo",
  "ticket",
]);

export interface ReceiptSuggestionExpense {
  description: string;
  id: string;
}

export function getCurrentMonthIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function deriveExpenseSearchQueryFromFileName(fileName: string): string {
  const normalizedFileName = fileName.trim();
  const fileNameWithoutExtension = normalizedFileName.replace(/\.[^/.]+$/, "");
  const fileNameWithoutDatePrefix = fileNameWithoutExtension.replace(
    /^\d{4}[-_]?\d{2}[-_]?\d{2}[\s_-]*/,
    "",
  );

  const normalizedQuery = fileNameWithoutDatePrefix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalizedQuery
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 0)
    .filter((word) => !RECEIPT_NOISE_WORDS.has(normalizeSearchValue(word)))
    .join(" ");
}

export function suggestExpenseIdForSharedReceipt({
  expenses,
  fileName,
}: {
  expenses: ReceiptSuggestionExpense[];
  fileName: string;
}): string | null {
  const query = deriveExpenseSearchQueryFromFileName(fileName);

  if (!query) {
    return null;
  }

  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return null;
  }

  let bestMatch: {
    expenseId: string;
    rank: NonNullable<ReturnType<typeof getFuzzyMatchRank>>;
  } | null = null;

  for (const expense of expenses) {
    const rank = getFuzzyMatchRank(expense.description, normalizedQuery);

    if (!rank) {
      continue;
    }

    if (!bestMatch || compareFuzzyMatchRank(rank, bestMatch.rank) < 0) {
      bestMatch = {
        expenseId: expense.id,
        rank,
      };
    }
  }

  return bestMatch?.expenseId ?? null;
}

/**
 * Maps UI result items into the command shape persisted by a save operation,
 * preserving every field that the repository stores (including occurrencesUnit).
 *
 * @param items - Result items currently displayed for the selected month.
 * @returns Items ready to be saved without dropping persisted metadata.
 */
export function normalizeExpenseItemsForSave(
  items: MonthlyExpensesDocumentResult["items"],
): SaveMonthlyExpensesCommand["items"] {
  return items.map((item) => ({
    currency: item.currency,
    description: item.description,
    ...(item.folders
      ? {
          folders: {
            allReceiptsFolderId: item.folders.allReceiptsFolderId,
            allReceiptsFolderViewUrl: item.folders.allReceiptsFolderViewUrl,
            monthlyFolderId: item.folders.monthlyFolderId,
            monthlyFolderViewUrl: item.folders.monthlyFolderViewUrl,
          },
        }
      : {}),
    id: item.id,
    ...(typeof item.isPaid === "boolean"
      ? {
          isPaid: item.isPaid,
        }
      : {}),
    ...(item.loan
      ? {
          loan: {
            direction: item.loan.direction ?? "payable",
            installmentCount: item.loan.installmentCount,
            ...(item.loan.lenderId ? { lenderId: item.loan.lenderId } : {}),
            ...(item.loan.lenderName ? { lenderName: item.loan.lenderName } : {}),
            startMonth: item.loan.startMonth,
          },
        }
      : {}),
    ...(typeof item.manualCoveredPayments === "number"
      ? {
          manualCoveredPayments: item.manualCoveredPayments,
        }
      : {}),
    occurrencesPerMonth: item.occurrencesPerMonth,
    ...(item.occurrencesUnit
      ? {
          occurrencesUnit: item.occurrencesUnit,
        }
      : {}),
    ...(typeof item.paymentLink !== "undefined"
      ? {
          paymentLink: item.paymentLink,
        }
      : {}),
    ...(typeof item.receiptShareMessage !== "undefined"
      ? {
          receiptShareMessage: item.receiptShareMessage,
        }
      : {}),
    ...(typeof item.receiptSharePhoneDigits !== "undefined"
      ? {
          receiptSharePhoneDigits: item.receiptSharePhoneDigits,
        }
      : {}),
    ...(item.paymentRecords
      ? {
          paymentRecords: item.paymentRecords,
        }
      : {}),
    ...(typeof item.requiresReceiptShare === "boolean"
      ? {
          requiresReceiptShare: item.requiresReceiptShare,
        }
      : {}),
    ...(item.receipts
      ? {
          receipts: item.receipts.map((receipt) => ({
            allReceiptsFolderId: receipt.allReceiptsFolderId,
            allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl,
            ...(typeof receipt.coveredPayments === "number"
              ? {
                  coveredPayments: receipt.coveredPayments,
                }
              : {}),
            fileId: receipt.fileId,
            fileName: receipt.fileName,
            fileViewUrl: receipt.fileViewUrl,
            monthlyFolderId: receipt.monthlyFolderId,
            monthlyFolderViewUrl: receipt.monthlyFolderViewUrl,
          })),
        }
      : {}),
    subtotal: item.subtotal,
  }));
}

/** Minimal shape of an uploaded receipt needed to attach it to an expense item. */
export interface UploadedSharedReceipt {
  allReceiptsFolderId: string;
  allReceiptsFolderViewUrl: string;
  coveredPayments: number;
  fileId: string;
  fileName: string;
  fileViewUrl: string;
  monthlyFolderId: string;
  monthlyFolderViewUrl: string;
}

/**
 * Attaches an uploaded shared receipt to the target expense item.
 *
 * The receipt is added both to the legacy `receipts` array and as a matching
 * payment record. The domain normalizer prefers `paymentRecords` over legacy
 * `receipts` when present, so an expense that already has payment records would
 * otherwise drop the newly uploaded receipt from the saved document.
 *
 * @param item - The target expense item to update.
 * @param receiptUpload - The uploaded receipt metadata returned by the upload API.
 * @returns A new expense item carrying the uploaded receipt as a payment record.
 */
export function appendUploadedReceiptToExpenseItem(
  item: MonthlyExpensesDocumentResult["items"][number],
  receiptUpload: UploadedSharedReceipt,
): MonthlyExpensesDocumentResult["items"][number] {
  const uploadedReceipt = {
    allReceiptsFolderId: receiptUpload.allReceiptsFolderId,
    allReceiptsFolderViewUrl: receiptUpload.allReceiptsFolderViewUrl,
    coveredPayments: receiptUpload.coveredPayments,
    fileId: receiptUpload.fileId,
    fileName: receiptUpload.fileName,
    fileViewUrl: receiptUpload.fileViewUrl,
    monthlyFolderId: receiptUpload.monthlyFolderId,
    monthlyFolderViewUrl: receiptUpload.monthlyFolderViewUrl,
  };

  return {
    ...item,
    folders: {
      allReceiptsFolderId: receiptUpload.allReceiptsFolderId,
      allReceiptsFolderViewUrl: receiptUpload.allReceiptsFolderViewUrl,
      monthlyFolderId: receiptUpload.monthlyFolderId,
      monthlyFolderViewUrl: receiptUpload.monthlyFolderViewUrl,
    },
    paymentRecords: [
      ...(item.paymentRecords ?? []),
      {
        coveredPayments: receiptUpload.coveredPayments,
        id: `legacy-receipt-${receiptUpload.fileId}`,
        receipt: uploadedReceipt,
        registeredAt: null,
      },
    ],
    receipts: [...(item.receipts ?? []), uploadedReceipt],
  };
}

export function getRemainingReceiptPayments({
  coveredPaymentsByReceipts,
  manualCoveredPayments,
  occurrencesPerMonth,
}: {
  coveredPaymentsByReceipts: number;
  manualCoveredPayments: number;
  occurrencesPerMonth: number;
}): number {
  const remaining =
    Math.trunc(occurrencesPerMonth) -
    Math.trunc(manualCoveredPayments) -
    Math.trunc(coveredPaymentsByReceipts);

  return Math.max(remaining, 0);
}
