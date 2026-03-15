import { z } from "zod";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAYMENT_LINK_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PAYMENT_LINK_URL_SCHEMA = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});
const RECEIPT_VIEW_URL_SCHEMA = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});

export const MONTHLY_EXPENSE_CURRENCIES = ["ARS", "USD"] as const;

export type MonthlyExpenseCurrency =
  (typeof MONTHLY_EXPENSE_CURRENCIES)[number];

export interface MonthlyExpenseLoanInput {
  installmentCount: number;
  lenderId?: string;
  lenderName?: string;
  startMonth: string;
}

export interface MonthlyExpenseLoan extends MonthlyExpenseLoanInput {
  endMonth: string;
  paidInstallments: number;
}

export interface MonthlyExpenseReceiptInput {
  allReceiptsFolderId: string;
  allReceiptsFolderViewUrl: string;
  fileId: string;
  fileName: string;
  fileViewUrl: string;
  monthlyFolderId: string;
  monthlyFolderViewUrl: string;
}

export type MonthlyExpenseReceipt = MonthlyExpenseReceiptInput;

export interface MonthlyExpenseFoldersInput {
  allReceiptsFolderId: string;
  allReceiptsFolderViewUrl: string;
  monthlyFolderId: string;
  monthlyFolderViewUrl: string;
}

export type MonthlyExpenseFolders = MonthlyExpenseFoldersInput;

export interface MonthlyExpenseItemInput {
  currency: MonthlyExpenseCurrency;
  description: string;
  folders?: MonthlyExpenseFoldersInput | null;
  id: string;
  loan?: MonthlyExpenseLoanInput;
  occurrencesPerMonth: number;
  paymentLink?: string | null;
  receipts?: MonthlyExpenseReceiptInput[] | null;
  subtotal: number;
}

export interface MonthlyExpenseItem extends MonthlyExpenseItemInput {
  folders?: MonthlyExpenseFolders;
  loan?: MonthlyExpenseLoan;
  paymentLink?: string | null;
  receipts: MonthlyExpenseReceipt[];
  total: number;
}

export interface MonthlyExpensesExchangeRateSnapshotInput {
  blueRate: number;
  month: string;
  officialRate: number;
  solidarityRate: number;
}

export type MonthlyExpensesExchangeRateSnapshot =
  MonthlyExpensesExchangeRateSnapshotInput;

export interface MonthlyExpensesDocumentInput {
  exchangeRateSnapshot?: MonthlyExpensesExchangeRateSnapshotInput;
  items: MonthlyExpenseItemInput[];
  month: string;
}

export interface MonthlyExpensesDocument {
  exchangeRateSnapshot?: MonthlyExpensesExchangeRateSnapshot | null;
  items: MonthlyExpenseItem[];
  month: string;
}

export function calculateMonthlyExpenseTotal({
  occurrencesPerMonth,
  subtotal,
}: {
  occurrencesPerMonth: number;
  subtotal: number;
}): number {
  return Number((subtotal * occurrencesPerMonth).toFixed(2));
}

function parseMonthIdentifier(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    monthIndex: year * 12 + (monthNumber - 1),
    normalizedMonth: `${year}-${String(monthNumber).padStart(2, "0")}`,
  };
}

function formatMonthFromIndex(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const monthNumber = (monthIndex % 12) + 1;

  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function isValidCurrency(currency: string): currency is MonthlyExpenseCurrency {
  return MONTHLY_EXPENSE_CURRENCIES.includes(
    currency as MonthlyExpenseCurrency,
  );
}

function validateMonth(
  month: string,
  operationName: string,
  fieldName: string = "a month",
): string {
  const normalizedMonth = month.trim();

  if (!MONTH_PATTERN.test(normalizedMonth)) {
    throw new Error(
      `${operationName} requires ${fieldName} in YYYY-MM format.`,
    );
  }

  return normalizedMonth;
}

function validatePositiveInteger(
  value: number,
  operationName: string,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${operationName} requires ${fieldName} greater than 0.`);
  }

  return value;
}

export function calculateLoanEndMonth({
  installmentCount,
  startMonth,
}: MonthlyExpenseLoanInput): string {
  const normalizedStartMonth = validateMonth(
    startMonth,
    "Calculating the loan end month",
  );
  const normalizedInstallmentCount = validatePositiveInteger(
    installmentCount,
    "Calculating the loan end month",
    "an installment count",
  );
  const { monthIndex } = parseMonthIdentifier(normalizedStartMonth);

  return formatMonthFromIndex(monthIndex + normalizedInstallmentCount - 1);
}

export function calculatePaidLoanInstallments({
  installmentCount,
  startMonth,
  targetMonth,
}: MonthlyExpenseLoanInput & {
  targetMonth: string;
}): number {
  const normalizedStartMonth = validateMonth(
    startMonth,
    "Calculating paid loan installments",
  );
  const normalizedTargetMonth = validateMonth(
    targetMonth,
    "Calculating paid loan installments",
  );
  const normalizedInstallmentCount = validatePositiveInteger(
    installmentCount,
    "Calculating paid loan installments",
    "an installment count",
  );
  const { monthIndex: startMonthIndex } = parseMonthIdentifier(
    normalizedStartMonth,
  );
  const { monthIndex: targetMonthIndex } = parseMonthIdentifier(
    normalizedTargetMonth,
  );

  if (targetMonthIndex < startMonthIndex) {
    return 0;
  }

  return Math.min(
    targetMonthIndex - startMonthIndex + 1,
    normalizedInstallmentCount,
  );
}

function validateLoan(
  loan: MonthlyExpenseLoanInput,
  operationName: string,
  targetMonth: string,
): MonthlyExpenseLoan {
  const startMonth = validateMonth(
    loan.startMonth,
    operationName,
    "a loan start month",
  );
  const installmentCount = validatePositiveInteger(
    loan.installmentCount,
    operationName,
    "a loan installment count",
  );
  const lenderName = loan.lenderName?.trim();
  const lenderId = loan.lenderId?.trim();

  return {
    ...(lenderId ? { lenderId } : {}),
    ...(lenderName ? { lenderName } : {}),
    endMonth: calculateLoanEndMonth({
      installmentCount,
      startMonth,
    }),
    installmentCount,
    paidInstallments: calculatePaidLoanInstallments({
      installmentCount,
      startMonth,
      targetMonth,
    }),
    startMonth,
  };
}

function validatePaymentLink(
  paymentLink: string | null | undefined,
  operationName: string,
): string | null {
  if (paymentLink == null) {
    return null;
  }

  const normalizedPaymentLink = paymentLink.trim();

  if (!normalizedPaymentLink) {
    return null;
  }

  try {
    const paymentLinkWithProtocol = PAYMENT_LINK_PROTOCOL_PATTERN.test(
      normalizedPaymentLink,
    )
      ? normalizedPaymentLink
      : `https://${normalizedPaymentLink}`;

    return PAYMENT_LINK_URL_SCHEMA.parse(paymentLinkWithProtocol);
  } catch {
    throw new Error(
      `${operationName} requires every payment link to be a valid URL.`,
    );
  }
}

function validateReceipts(
  receipts: MonthlyExpenseReceiptInput[] | null | undefined,
  operationName: string,
): MonthlyExpenseReceipt[] {
  if (!receipts || receipts.length === 0) {
    return [];
  }

  return receipts.map((receipt) => {
    const normalizedReceipt = {
      allReceiptsFolderId: receipt.allReceiptsFolderId.trim(),
      allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl.trim(),
      fileId: receipt.fileId.trim(),
      fileName: receipt.fileName.trim(),
      fileViewUrl: receipt.fileViewUrl.trim(),
      monthlyFolderId: receipt.monthlyFolderId.trim(),
      monthlyFolderViewUrl: receipt.monthlyFolderViewUrl.trim(),
    };

    if (
      !normalizedReceipt.fileId ||
      !normalizedReceipt.fileName ||
      !normalizedReceipt.monthlyFolderId ||
      !normalizedReceipt.allReceiptsFolderId
    ) {
      throw new Error(
        `${operationName} requires every receipt to include file and folder identifiers.`,
      );
    }

    try {
      return {
        ...normalizedReceipt,
        allReceiptsFolderViewUrl: RECEIPT_VIEW_URL_SCHEMA.parse(
          normalizedReceipt.allReceiptsFolderViewUrl,
        ),
        fileViewUrl: RECEIPT_VIEW_URL_SCHEMA.parse(
          normalizedReceipt.fileViewUrl,
        ),
        monthlyFolderViewUrl: RECEIPT_VIEW_URL_SCHEMA.parse(
          normalizedReceipt.monthlyFolderViewUrl,
        ),
      };
    } catch {
      throw new Error(
        `${operationName} requires every receipt to include valid Drive URLs.`,
      );
    }
  });
}

function validateFolders(
  folders: MonthlyExpenseFoldersInput | null | undefined,
  operationName: string,
): MonthlyExpenseFolders | undefined {
  if (!folders) {
    return undefined;
  }

  const normalizedFolders = {
    allReceiptsFolderId: folders.allReceiptsFolderId.trim(),
    allReceiptsFolderViewUrl: folders.allReceiptsFolderViewUrl.trim(),
    monthlyFolderId: folders.monthlyFolderId.trim(),
    monthlyFolderViewUrl: folders.monthlyFolderViewUrl.trim(),
  };

  if (!normalizedFolders.monthlyFolderId || !normalizedFolders.allReceiptsFolderId) {
    throw new Error(
      `${operationName} requires folder metadata to include monthly and all-receipts folder identifiers.`,
    );
  }

  try {
    return {
      ...normalizedFolders,
      allReceiptsFolderViewUrl: RECEIPT_VIEW_URL_SCHEMA.parse(
        normalizedFolders.allReceiptsFolderViewUrl,
      ),
      monthlyFolderViewUrl: RECEIPT_VIEW_URL_SCHEMA.parse(
        normalizedFolders.monthlyFolderViewUrl,
      ),
    };
  } catch {
    throw new Error(
      `${operationName} requires folder metadata to include valid Drive URLs.`,
    );
  }
}

function validateItem(
  item: MonthlyExpenseItemInput,
  operationName: string,
  targetMonth: string,
): MonthlyExpenseItem {
  const { folders, loan, paymentLink, receipts, ...rawItem } = item;
  const normalizedItem = {
    ...rawItem,
    description: item.description.trim(),
    id: item.id.trim(),
  };
  const normalizedFolders = validateFolders(folders, operationName);
  const normalizedPaymentLink = validatePaymentLink(paymentLink, operationName);
  const normalizedReceipts = validateReceipts(receipts, operationName);

  if (!normalizedItem.id) {
    throw new Error(
      `${operationName} requires every expense to include an internal id.`,
    );
  }

  if (!isValidCurrency(normalizedItem.currency)) {
    throw new Error(
      `${operationName} requires every expense to use ARS or USD currency.`,
    );
  }

  if (
    !normalizedItem.description ||
    !Number.isFinite(normalizedItem.subtotal) ||
    normalizedItem.subtotal <= 0 ||
    !Number.isInteger(normalizedItem.occurrencesPerMonth) ||
    normalizedItem.occurrencesPerMonth <= 0
  ) {
    throw new Error(
      `${operationName} requires every expense to include a description, a subtotal greater than 0, and occurrences per month greater than 0.`,
    );
  }

  return {
    ...normalizedItem,
    ...(normalizedFolders ? { folders: normalizedFolders } : {}),
    ...(loan ? { loan: validateLoan(loan, operationName, targetMonth) } : {}),
    paymentLink: normalizedPaymentLink,
    receipts: normalizedReceipts,
    total: calculateMonthlyExpenseTotal(normalizedItem),
  };
}

function validateExchangeRateSnapshot(
  exchangeRateSnapshot: MonthlyExpensesExchangeRateSnapshotInput,
  operationName: string,
  targetMonth: string,
): MonthlyExpensesExchangeRateSnapshot {
  const month = validateMonth(
    exchangeRateSnapshot.month,
    operationName,
    "an exchange rate snapshot month",
  );

  if (month !== targetMonth) {
    throw new Error(
      `${operationName} requires the exchange rate snapshot month to match the document month.`,
    );
  }

  const numericRates = [
    exchangeRateSnapshot.officialRate,
    exchangeRateSnapshot.blueRate,
    exchangeRateSnapshot.solidarityRate,
  ];

  if (numericRates.some((rate) => !Number.isFinite(rate) || rate <= 0)) {
    throw new Error(
      `${operationName} requires exchange rate snapshot values greater than 0.`,
    );
  }

  return {
    blueRate: exchangeRateSnapshot.blueRate,
    month,
    officialRate: exchangeRateSnapshot.officialRate,
    solidarityRate: exchangeRateSnapshot.solidarityRate,
  };
}

export function createMonthlyExpensesDocument(
  payload: MonthlyExpensesDocumentInput,
  operationName: string,
): MonthlyExpensesDocument {
  const month = validateMonth(payload.month, operationName);

  return {
    ...(payload.exchangeRateSnapshot
      ? {
          exchangeRateSnapshot: validateExchangeRateSnapshot(
            payload.exchangeRateSnapshot,
            operationName,
            month,
          ),
        }
      : {}),
    items: payload.items.map((item) => validateItem(item, operationName, month)),
    month,
  };
}

export function createEmptyMonthlyExpensesDocument(
  month: string,
): MonthlyExpensesDocument {
  return createMonthlyExpensesDocument(
    {
      items: [],
      month,
    },
    "Creating an empty monthly expenses document",
  );
}

export function toMonthlyExpensesDocumentInput(
  document: MonthlyExpensesDocument,
): MonthlyExpensesDocumentInput {
  return {
    ...(document.exchangeRateSnapshot
      ? {
          exchangeRateSnapshot: {
            blueRate: document.exchangeRateSnapshot.blueRate,
            month: document.exchangeRateSnapshot.month,
            officialRate: document.exchangeRateSnapshot.officialRate,
            solidarityRate: document.exchangeRateSnapshot.solidarityRate,
          },
        }
      : {}),
    items: document.items.map((item) => ({
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
      ...(item.loan
        ? {
            loan: {
              installmentCount: item.loan.installmentCount,
              ...(item.loan.lenderId ? { lenderId: item.loan.lenderId } : {}),
              ...(item.loan.lenderName
                ? { lenderName: item.loan.lenderName }
                : {}),
              startMonth: item.loan.startMonth,
            },
          }
        : {}),
      occurrencesPerMonth: item.occurrencesPerMonth,
      paymentLink: item.paymentLink,
      ...(item.receipts.length > 0
        ? {
            receipts: item.receipts.map((receipt) => ({
              allReceiptsFolderId: receipt.allReceiptsFolderId,
              allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl,
              fileId: receipt.fileId,
              fileName: receipt.fileName,
              fileViewUrl: receipt.fileViewUrl,
              monthlyFolderId: receipt.monthlyFolderId,
              monthlyFolderViewUrl: receipt.monthlyFolderViewUrl,
            })),
          }
        : {}),
      subtotal: item.subtotal,
    })),
    month: document.month,
  };
}
