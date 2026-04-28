import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

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
export const MONTHLY_EXPENSE_LOAN_DIRECTIONS = [
  "payable",
  "receivable",
] as const;
export const MONTHLY_EXPENSE_RECEIPT_SHARE_STATUSES = [
  "pending",
  "sent",
] as const;

export type MonthlyExpenseCurrency =
  (typeof MONTHLY_EXPENSE_CURRENCIES)[number];
export type MonthlyExpenseLoanDirection =
  (typeof MONTHLY_EXPENSE_LOAN_DIRECTIONS)[number];

export type MonthlyExpenseReceiptShareStatus =
  (typeof MONTHLY_EXPENSE_RECEIPT_SHARE_STATUSES)[number];

export interface MonthlyExpenseLoanInput {
  direction?: MonthlyExpenseLoanDirection;
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
  coveredPayments?: number;
  fileId: string;
  fileName: string;
  fileViewUrl: string;
  registeredAt?: string | null;
  monthlyFolderId: string;
  monthlyFolderViewUrl: string;
}

export type MonthlyExpenseReceipt = MonthlyExpenseReceiptInput;

export interface MonthlyExpensePaymentRecordInput {
  coveredPayments: number;
  id: string;
  receipt?: MonthlyExpenseReceiptInput | null;
  registeredAt?: string | null;
}

export interface MonthlyExpensePaymentRecord {
  coveredPayments: number;
  id: string;
  receipt?: MonthlyExpenseReceipt;
  registeredAt: string | null;
}

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
  isPaid?: boolean;
  loan?: MonthlyExpenseLoanInput;
  manualCoveredPayments?: number;
  occurrencesPerMonth: number;
  paymentRecords?: MonthlyExpensePaymentRecordInput[] | null;
  paymentLink?: string | null;
  receiptShareMessage?: string | null;
  receiptSharePhoneDigits?: string | null;
  receiptShareStatus?: MonthlyExpenseReceiptShareStatus | null;
  requiresReceiptShare?: boolean;
  receipts?: MonthlyExpenseReceiptInput[] | null;
  subtotal: number;
}

export interface MonthlyExpenseItem extends MonthlyExpenseItemInput {
  folders?: MonthlyExpenseFolders;
  loan?: MonthlyExpenseLoan;
  manualCoveredPayments: number;
  paymentLink?: string | null;
  paymentRecords?: MonthlyExpensePaymentRecord[];
  receiptShareMessage?: string | null;
  receiptSharePhoneDigits?: string | null;
  receiptShareStatus?: MonthlyExpenseReceiptShareStatus | null;
  requiresReceiptShare?: boolean;
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
  hasReplicatedFromPreviousMonth?: boolean;
  items: MonthlyExpenseItemInput[];
  month: string;
}

export interface MonthlyExpensesDocument {
  exchangeRateSnapshot?: MonthlyExpensesExchangeRateSnapshot | null;
  hasReplicatedFromPreviousMonth?: boolean;
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

function isValidLoanDirection(
  direction: string,
): direction is MonthlyExpenseLoanDirection {
  return MONTHLY_EXPENSE_LOAN_DIRECTIONS.includes(
    direction as MonthlyExpenseLoanDirection,
  );
}

function isValidReceiptShareStatus(
  status: string,
): status is MonthlyExpenseReceiptShareStatus {
  return MONTHLY_EXPENSE_RECEIPT_SHARE_STATUSES.includes(
    status as MonthlyExpenseReceiptShareStatus,
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
  const direction = loan.direction ?? "payable";
  const lenderName = loan.lenderName?.trim();
  const lenderId = loan.lenderId?.trim();

  if (!isValidLoanDirection(direction)) {
    throw new Error(
      `${operationName} requires every loan direction to be payable or receivable.`,
    );
  }

  return {
    direction,
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

function validateReceiptSharePhoneDigits(
  receiptSharePhoneDigits: string | null | undefined,
  operationName: string,
): string | null {
  if (receiptSharePhoneDigits == null) {
    return null;
  }

  const normalizedPhoneValue = receiptSharePhoneDigits.trim();

  if (!normalizedPhoneValue) {
    return null;
  }

  const phoneDigits = normalizedPhoneValue.replace(/\D+/g, "");

  if (!phoneDigits) {
    throw new Error(
      `${operationName} requires every receipt share phone to contain only digits.`,
    );
  }

  const parsedPhone = parsePhoneNumberFromString(`+${phoneDigits}`);

  if (!parsedPhone || !parsedPhone.isValid()) {
    throw new Error(
      `${operationName} requires every receipt share phone to be a valid international phone number.`,
    );
  }

  return phoneDigits;
}

function normalizeReceiptShareMessage(
  receiptShareMessage: string | null | undefined,
): string | null {
  if (receiptShareMessage == null) {
    return null;
  }

  const normalizedMessage = receiptShareMessage.trim();

  return normalizedMessage.length > 0 ? normalizedMessage : null;
}

function validateReceiptShareStatus(
  receiptShareStatus: string | null | undefined,
  operationName: string,
): MonthlyExpenseReceiptShareStatus | null {
  if (receiptShareStatus == null) {
    return null;
  }

  const normalizedStatus = receiptShareStatus.trim().toLowerCase();

  if (!normalizedStatus) {
    return null;
  }

  if (!isValidReceiptShareStatus(normalizedStatus)) {
    throw new Error(
      `${operationName} requires every receipt share status to be pending or sent.`,
    );
  }

  return normalizedStatus;
}

function validateReceipts(
  receipts: MonthlyExpenseReceiptInput[] | null | undefined,
  operationName: string,
): MonthlyExpenseReceipt[] {
  if (!receipts || receipts.length === 0) {
    return [];
  }

  return receipts.map((receipt) => {
    const coveredPayments = receipt.coveredPayments ?? 1;

    if (!Number.isInteger(coveredPayments) || coveredPayments <= 0) {
      throw new Error(
        `${operationName} requires every receipt to include covered payments greater than 0.`,
      );
    }

    const normalizedReceipt = {
      allReceiptsFolderId: receipt.allReceiptsFolderId.trim(),
      allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl.trim(),
      coveredPayments,
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

/**
 * Validates the payment registration timestamp and normalizes it to ISO format.
 *
 * @param registeredAt - Raw registration timestamp value.
 * @param operationName - Operation name used in error messages.
 * @returns The normalized ISO timestamp string or null when not available.
 * @throws When the timestamp is present but not a valid ISO datetime.
 */
function validateRegisteredAt(
  registeredAt: string | null | undefined,
  operationName: string,
): string | null {
  if (registeredAt == null) {
    return null;
  }

  const normalizedRegisteredAt = registeredAt.trim();

  if (!normalizedRegisteredAt) {
    return null;
  }

  const parsedDate = new Date(normalizedRegisteredAt);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(
      `${operationName} requires every payment record date to be a valid ISO datetime.`,
    );
  }

  return parsedDate.toISOString();
}

/**
 * Builds payment records from legacy manual and receipt coverage fields.
 *
 * @param expenseId - Expense identifier used to build deterministic legacy record ids.
 * @param legacyManualCoveredPayments - Legacy manual covered payments value.
 * @param legacyReceipts - Legacy receipts list.
 * @returns A normalized list of payment records.
 */
function createPaymentRecordsFromLegacyFields({
  expenseId,
  legacyManualCoveredPayments,
  legacyReceipts,
}: {
  expenseId: string;
  legacyManualCoveredPayments: number;
  legacyReceipts: MonthlyExpenseReceipt[];
}): MonthlyExpensePaymentRecord[] {
  const paymentRecordsFromReceipts = legacyReceipts.map((legacyReceipt) => ({
    coveredPayments: legacyReceipt.coveredPayments ?? 1,
    id: `legacy-receipt-${legacyReceipt.fileId}`,
    receipt: legacyReceipt,
    registeredAt: validateRegisteredAt(
      legacyReceipt.registeredAt ?? null,
      "Creating payment records from legacy receipts",
    ),
  }));

  if (legacyManualCoveredPayments <= 0) {
    return paymentRecordsFromReceipts;
  }

  return [
    ...paymentRecordsFromReceipts,
    {
      coveredPayments: legacyManualCoveredPayments,
      id: `legacy-manual-${expenseId}`,
      registeredAt: null,
    },
  ];
}

/**
 * Validates payment records and normalizes nested receipt metadata.
 *
 * @param paymentRecords - Raw payment record collection.
 * @param operationName - Operation name used in error messages.
 * @returns A normalized list of payment records.
 * @throws When any record misses required identifiers or contains invalid numeric or date values.
 */
function validatePaymentRecords(
  paymentRecords: MonthlyExpensePaymentRecordInput[] | null | undefined,
  operationName: string,
): MonthlyExpensePaymentRecord[] {
  if (!paymentRecords || paymentRecords.length === 0) {
    return [];
  }

  return paymentRecords.map((paymentRecord) => {
    const normalizedCoveredPayments = paymentRecord.coveredPayments;

    if (
      !Number.isInteger(normalizedCoveredPayments) ||
      normalizedCoveredPayments <= 0
    ) {
      throw new Error(
        `${operationName} requires every payment record to include covered payments greater than 0.`,
      );
    }

    const normalizedPaymentRecordId = paymentRecord.id.trim();

    if (!normalizedPaymentRecordId) {
      throw new Error(
        `${operationName} requires every payment record to include an internal id.`,
      );
    }

    return {
      coveredPayments: normalizedCoveredPayments,
      id: normalizedPaymentRecordId,
      ...(paymentRecord.receipt
        ? {
            receipt: validateReceipts([paymentRecord.receipt], operationName)[0],
          }
        : {}),
      registeredAt: validateRegisteredAt(
        paymentRecord.registeredAt ?? null,
        operationName,
      ),
    };
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

  if (!normalizedFolders.allReceiptsFolderId) {
    throw new Error(
      `${operationName} requires folder metadata to include an all-receipts folder identifier.`,
    );
  }

  const hasMonthlyFolderId = normalizedFolders.monthlyFolderId.length > 0;
  const hasMonthlyFolderViewUrl = normalizedFolders.monthlyFolderViewUrl.length > 0;

  if (hasMonthlyFolderId !== hasMonthlyFolderViewUrl) {
    throw new Error(
      `${operationName} requires folder metadata to include both monthly folder fields or neither one.`,
    );
  }

  try {
    return {
      ...normalizedFolders,
      allReceiptsFolderViewUrl: RECEIPT_VIEW_URL_SCHEMA.parse(
        normalizedFolders.allReceiptsFolderViewUrl,
      ),
      monthlyFolderViewUrl: hasMonthlyFolderViewUrl
        ? RECEIPT_VIEW_URL_SCHEMA.parse(normalizedFolders.monthlyFolderViewUrl)
        : "",
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
  const {
    folders,
    isPaid,
    loan,
    manualCoveredPayments,
    paymentLink,
    receiptShareMessage,
    receiptSharePhoneDigits,
    receiptShareStatus,
    requiresReceiptShare,
    receipts,
    ...rawItem
  } = item;
  const normalizedItem = {
    ...rawItem,
    description: item.description.trim(),
    id: item.id.trim(),
  };
  const normalizedFolders = validateFolders(folders, operationName);
  const normalizedPaymentLink = validatePaymentLink(paymentLink, operationName);
  const normalizedReceiptSharePhoneDigits = validateReceiptSharePhoneDigits(
    receiptSharePhoneDigits,
    operationName,
  );
  const normalizedReceiptShareMessage = normalizeReceiptShareMessage(
    receiptShareMessage,
  );
  const normalizedReceiptShareStatus = validateReceiptShareStatus(
    receiptShareStatus,
    operationName,
  );
  const normalizedRequiresReceiptShare = requiresReceiptShare === true;
  const resolvedReceiptShareStatus = normalizedRequiresReceiptShare
    ? normalizedReceiptShareStatus ?? "pending"
    : normalizedReceiptShareStatus;
  const normalizedReceipts = validateReceipts(receipts, operationName);
  const normalizedPaymentRecordsInput = validatePaymentRecords(
    item.paymentRecords,
    operationName,
  );

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

  if (isPaid !== undefined && typeof isPaid !== "boolean") {
    throw new Error(
      `${operationName} requires every paid flag to be a boolean when provided.`,
    );
  }

  if (
    requiresReceiptShare !== undefined &&
    typeof requiresReceiptShare !== "boolean"
  ) {
    throw new Error(
      `${operationName} requires every receipt share flag to be a boolean when provided.`,
    );
  }

  if (normalizedRequiresReceiptShare && !normalizedReceiptSharePhoneDigits) {
    throw new Error(
      `${operationName} requires a valid international receipt share phone when receipt sharing is enabled.`,
    );
  }

  const normalizedManualCoveredPaymentsFromLegacy = manualCoveredPayments ??
    (isPaid === true && normalizedReceipts.length === 0
      ? normalizedItem.occurrencesPerMonth
      : 0);

  if (
    !Number.isInteger(normalizedManualCoveredPaymentsFromLegacy) ||
    normalizedManualCoveredPaymentsFromLegacy < 0
  ) {
    throw new Error(
      `${operationName} requires manual covered payments greater than or equal to 0.`,
    );
  }

  const normalizedPaymentRecords = normalizedPaymentRecordsInput.length > 0
    ? normalizedPaymentRecordsInput
    : createPaymentRecordsFromLegacyFields({
        expenseId: normalizedItem.id,
        legacyManualCoveredPayments: normalizedManualCoveredPaymentsFromLegacy,
        legacyReceipts: normalizedReceipts,
      });
  const normalizedManualCoveredPayments = normalizedPaymentRecords
    .filter((paymentRecord) => !paymentRecord.receipt)
    .reduce(
      (coveredPaymentsByManualRecords, paymentRecord) =>
        coveredPaymentsByManualRecords + paymentRecord.coveredPayments,
      0,
    );
  const normalizedReceiptsFromPaymentRecords = normalizedPaymentRecords
    .filter((paymentRecord) => Boolean(paymentRecord.receipt))
    .map((paymentRecord) => paymentRecord.receipt as MonthlyExpenseReceipt);
  const totalCoveredPayments = normalizedPaymentRecords.reduce(
    (accumulatedPayments, paymentRecord) =>
      accumulatedPayments + paymentRecord.coveredPayments,
    0,
  );
  const normalizedIsPaid =
    totalCoveredPayments >= normalizedItem.occurrencesPerMonth;

  return {
    ...normalizedItem,
    ...(normalizedFolders ? { folders: normalizedFolders } : {}),
    ...(normalizedIsPaid ? { isPaid: true } : {}),
    ...(loan ? { loan: validateLoan(loan, operationName, targetMonth) } : {}),
    manualCoveredPayments: normalizedManualCoveredPayments,
    paymentLink: normalizedPaymentLink,
    ...(normalizedReceiptShareMessage
      ? { receiptShareMessage: normalizedReceiptShareMessage }
      : {}),
    ...(normalizedReceiptSharePhoneDigits
      ? { receiptSharePhoneDigits: normalizedReceiptSharePhoneDigits }
      : {}),
    ...(resolvedReceiptShareStatus
      ? { receiptShareStatus: resolvedReceiptShareStatus }
      : {}),
    ...(normalizedRequiresReceiptShare ? { requiresReceiptShare: true } : {}),
    paymentRecords: normalizedPaymentRecords,
    receipts: normalizedReceiptsFromPaymentRecords,
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
    hasReplicatedFromPreviousMonth:
      payload.hasReplicatedFromPreviousMonth === true,
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
    ...(document.hasReplicatedFromPreviousMonth
      ? {
          hasReplicatedFromPreviousMonth: true,
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
      ...(item.isPaid === true ? { isPaid: true } : {}),
      ...(item.loan
        ? {
            loan: {
              direction: item.loan.direction,
              installmentCount: item.loan.installmentCount,
              ...(item.loan.lenderId ? { lenderId: item.loan.lenderId } : {}),
              ...(item.loan.lenderName
                ? { lenderName: item.loan.lenderName }
                : {}),
              startMonth: item.loan.startMonth,
            },
          }
        : {}),
      ...(item.manualCoveredPayments > 0
        ? {
            manualCoveredPayments: item.manualCoveredPayments,
          }
        : {}),
      ...(item.paymentRecords && item.paymentRecords.length > 0
        ? {
            paymentRecords: item.paymentRecords.map((paymentRecord) => ({
              coveredPayments: paymentRecord.coveredPayments,
              id: paymentRecord.id,
              ...(paymentRecord.receipt
                ? {
                    receipt: {
                      allReceiptsFolderId: paymentRecord.receipt.allReceiptsFolderId,
                      allReceiptsFolderViewUrl:
                        paymentRecord.receipt.allReceiptsFolderViewUrl,
                      coveredPayments: paymentRecord.receipt.coveredPayments,
                      fileId: paymentRecord.receipt.fileId,
                      fileName: paymentRecord.receipt.fileName,
                      fileViewUrl: paymentRecord.receipt.fileViewUrl,
                      ...(paymentRecord.receipt.registeredAt
                        ? { registeredAt: paymentRecord.receipt.registeredAt }
                        : {}),
                      monthlyFolderId: paymentRecord.receipt.monthlyFolderId,
                      monthlyFolderViewUrl:
                        paymentRecord.receipt.monthlyFolderViewUrl,
                    },
                  }
                : {}),
              ...(paymentRecord.registeredAt
                ? { registeredAt: paymentRecord.registeredAt }
                : {}),
            })),
          }
        : {}),
      occurrencesPerMonth: item.occurrencesPerMonth,
      paymentLink: item.paymentLink,
      ...(item.receiptShareMessage
        ? {
            receiptShareMessage: item.receiptShareMessage,
          }
        : {}),
      ...(item.receiptSharePhoneDigits
        ? {
            receiptSharePhoneDigits: item.receiptSharePhoneDigits,
          }
        : {}),
      ...(item.receiptShareStatus
        ? {
            receiptShareStatus: item.receiptShareStatus,
          }
        : {}),
      ...(item.requiresReceiptShare ? { requiresReceiptShare: true } : {}),
      ...(item.receipts.length > 0
        ? {
            receipts: item.receipts.map((receipt) => ({
              allReceiptsFolderId: receipt.allReceiptsFolderId,
              allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl,
              coveredPayments: receipt.coveredPayments,
              fileId: receipt.fileId,
              fileName: receipt.fileName,
              fileViewUrl: receipt.fileViewUrl,
              ...(receipt.registeredAt
                ? { registeredAt: receipt.registeredAt }
                : {}),
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
