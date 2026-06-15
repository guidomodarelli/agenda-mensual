import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import {
  createMonthlyExpensesDocument,
  MAX_OCCURRENCES_UNIT_LENGTH,
  type MonthlyExpensesDocument,
} from "../../../domain/value-objects/monthly-expenses-document";
import type { GoogleDriveMonthlyExpensesFileDto } from "./google-drive-monthly-expenses-file.dto";

const PAYMENT_LINK_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PAYMENT_LINK_URL_SCHEMA = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});
const RECEIPT_VIEW_URL_SCHEMA = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});
const RECEIPT_SHARE_STATUSES = ["pending", "sent"] as const;

function normalizeHttpPaymentLink(value: string): string {
  const normalizedValue = value.trim();
  const paymentLinkWithProtocol = PAYMENT_LINK_PROTOCOL_PATTERN.test(
    normalizedValue,
  )
    ? normalizedValue
    : `https://${normalizedValue}`;

  return PAYMENT_LINK_URL_SCHEMA.parse(paymentLinkWithProtocol);
}

function isValidHttpPaymentLink(value: string): boolean {
  try {
    normalizeHttpPaymentLink(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeReceiptSharePhoneDigits(value: string): string {
  const phoneDigits = value.trim().replace(/\D+/g, "");
  const parsedPhone = parsePhoneNumberFromString(`+${phoneDigits}`);

  if (!phoneDigits || !parsedPhone || !parsedPhone.isValid()) {
    throw new Error(
      "monthly-expenses mapper requires receiptSharePhoneDigits to be a valid international phone number.",
    );
  }

  return phoneDigits;
}

function isValidReceiptSharePhoneDigits(value: string): boolean {
  try {
    normalizeReceiptSharePhoneDigits(value);
    return true;
  } catch {
    return false;
  }
}

const receiptSharePhoneDigitsSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  },
  z
    .string()
    .refine((value) => isValidReceiptSharePhoneDigits(value))
    .transform((value) => normalizeReceiptSharePhoneDigits(value))
    .nullable(),
);

const receiptShareMessageSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  },
  z.string().trim().nullable(),
);

const monthlyExpenseReceiptSchema = z.object({
  allReceiptsFolderId: z.string().trim().min(1),
  allReceiptsFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  coveredPayments: z.number().int().positive().optional(),
  fileId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  fileViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  registeredAt: z.string().datetime().nullable().optional(),
  monthlyFolderId: z.string().trim().min(1),
  monthlyFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
}).strict();

const monthlyExpensePaymentRecordSchema = z.object({
  coveredPayments: z.number().int().positive(),
  id: z.string().trim().min(1),
  receipt: monthlyExpenseReceiptSchema.nullable().optional(),
  registeredAt: z.string().datetime().nullable().optional(),
}).strict();

const monthlyExpenseFoldersSchema = z.object({
  allReceiptsFolderId: z.string().trim().min(1),
  allReceiptsFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  monthlyFolderId: z.string().trim(),
  monthlyFolderViewUrl: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success,
    ),
}).strict().superRefine((value, context) => {
  const hasMonthlyFolderId = value.monthlyFolderId.length > 0;
  const hasMonthlyFolderViewUrl = value.monthlyFolderViewUrl.length > 0;

  if (hasMonthlyFolderId !== hasMonthlyFolderViewUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "monthly-expenses mapper requires monthly folder metadata to include both fields or neither one.",
      path: ["monthlyFolderId"],
    });
  }
});

const legacyMonthlyExpenseReceiptSchema = z.object({
  fileId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  fileViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  folderId: z.string().trim().min(1),
  folderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
}).strict();

const googleDriveMonthlyExpenseItemSchema = z.object({
  currency: z.enum(["ARS", "USD"]),
  description: z.string().trim().min(1),
  folders: monthlyExpenseFoldersSchema.nullable().optional(),
  id: z.string().trim().min(1),
  isPaid: z.boolean().optional(),
  loan: z
    .object({
      direction: z.enum(["payable", "receivable"]).optional(),
      installmentCount: z.number().int().positive(),
      lenderId: z.string().optional(),
      lenderName: z.string().optional(),
      startMonth: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    })
    .optional(),
  manualCoveredPayments: z.number().int().nonnegative().optional(),
  occurrencesPerMonth: z.number().int().positive(),
  occurrencesUnit: z
    .string()
    .trim()
    .min(1)
    .max(MAX_OCCURRENCES_UNIT_LENGTH)
    .optional(),
  paymentRecords: z.array(monthlyExpensePaymentRecordSchema).optional(),
  paymentLink: z
    .string()
    .trim()
    .refine((value) => isValidHttpPaymentLink(value))
    .transform((value) => normalizeHttpPaymentLink(value))
    .nullable()
    .optional(),
  receiptShareMessage: receiptShareMessageSchema.optional(),
  receiptSharePhoneDigits: receiptSharePhoneDigitsSchema.optional(),
  receiptShareStatus: z.enum(RECEIPT_SHARE_STATUSES).nullable().optional(),
  requiresReceiptShare: z.boolean().optional(),
  receipt: legacyMonthlyExpenseReceiptSchema.nullable().optional(),
  receipts: z.array(monthlyExpenseReceiptSchema).optional(),
  subtotal: z.number().positive(),
  subtotalUnit: z.enum(["occurrence", "hour"]).optional(),
}).strict().superRefine((value, context) => {
  if (value.requiresReceiptShare === true && !value.receiptSharePhoneDigits) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "monthly-expenses mapper requires receiptSharePhoneDigits when requiresReceiptShare is true.",
      path: ["receiptSharePhoneDigits"],
    });
  }
});

const googleDriveMonthlyExpensesDocumentSchema = z.object({
  exchangeRateSnapshot: z
    .object({
      blueRate: z.number().positive(),
      month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      officialRate: z.number().positive(),
      solidarityRate: z.number().positive(),
    })
    .optional(),
  items: z.array(googleDriveMonthlyExpenseItemSchema),
  month: z.string().trim().min(1),
}).strict();

const MONTHLY_EXPENSES_MIME_TYPE = "application/json";
const SPANISH_MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function createMonthlyExpensesFileName(month: string): string {
  const [yearValue, monthValue] = month.split("-");
  const monthIndex = Number(monthValue) - 1;
  const monthName = SPANISH_MONTH_NAMES[monthIndex];

  if (!yearValue || !monthName) {
    throw new Error(
      `Cannot create a monthly expenses Drive file name from invalid month "${month}".`,
    );
  }

  return `control-mensual-${yearValue}-${monthName}.json`;
}

export function mapMonthlyExpensesDocumentToGoogleDriveFile(
  document: MonthlyExpensesDocument,
): {
  content: string;
  mimeType: string;
  name: string;
} {
  return {
    content: JSON.stringify(
      {
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
        items: document.items.map(
          ({
            currency,
            description,
            folders,
            id,
            isPaid,
            loan,
            manualCoveredPayments,
            occurrencesPerMonth,
            occurrencesUnit,
            paymentRecords,
            paymentLink,
            receiptShareMessage,
            receiptSharePhoneDigits,
            receiptShareStatus,
            requiresReceiptShare,
            receipts,
            subtotal,
            subtotalUnit,
          }) => ({
            currency,
            description,
            ...(folders
              ? {
                  folders: {
                    allReceiptsFolderId: folders.allReceiptsFolderId,
                    allReceiptsFolderViewUrl: folders.allReceiptsFolderViewUrl,
                    monthlyFolderId: folders.monthlyFolderId,
                    monthlyFolderViewUrl: folders.monthlyFolderViewUrl,
                  },
                }
              : {}),
            id,
            ...(loan
              ? {
                  loan: {
                    direction: loan.direction ?? "payable",
                    installmentCount: loan.installmentCount,
                    ...(loan.lenderId ? { lenderId: loan.lenderId } : {}),
                    ...(loan.lenderName ? { lenderName: loan.lenderName } : {}),
                    startMonth: loan.startMonth,
                  },
                }
              : {}),
            ...(manualCoveredPayments > 0
              ? { manualCoveredPayments }
              : {}),
            ...(paymentRecords && paymentRecords.length > 0
              ? {
                  paymentRecords: paymentRecords.map((paymentRecord) => ({
                    coveredPayments: paymentRecord.coveredPayments,
                    id: paymentRecord.id,
                    ...(paymentRecord.receipt
                      ? {
                          receipt: {
                            allReceiptsFolderId:
                              paymentRecord.receipt.allReceiptsFolderId,
                            allReceiptsFolderViewUrl:
                              paymentRecord.receipt.allReceiptsFolderViewUrl,
                            coveredPayments: paymentRecord.receipt.coveredPayments,
                            fileId: paymentRecord.receipt.fileId,
                            fileName: paymentRecord.receipt.fileName,
                            fileViewUrl: paymentRecord.receipt.fileViewUrl,
                            ...(paymentRecord.receipt.registeredAt
                              ? {
                                  registeredAt:
                                    paymentRecord.receipt.registeredAt,
                                }
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
            ...(isPaid === true ? { isPaid: true } : {}),
            occurrencesPerMonth,
            ...(occurrencesUnit ? { occurrencesUnit } : {}),
            paymentLink,
            ...(receiptShareMessage
              ? { receiptShareMessage }
              : {}),
            ...(receiptSharePhoneDigits
              ? { receiptSharePhoneDigits }
              : {}),
            ...(receiptShareStatus
              ? { receiptShareStatus }
              : {}),
            ...(requiresReceiptShare ? { requiresReceiptShare: true } : {}),
            ...(receipts.length > 0
              ? {
                  receipts: receipts.map((receipt) => ({
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
            subtotal,
            ...(subtotalUnit === "hour" ? { subtotalUnit } : {}),
          }),
        ),
        month: document.month,
      },
      null,
      2,
    ),
    mimeType: MONTHLY_EXPENSES_MIME_TYPE,
    name: createMonthlyExpensesFileName(document.month),
  };
}

export function mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument(
  dto: GoogleDriveMonthlyExpensesFileDto,
  month: string,
): StoredMonthlyExpensesDocument {
  if (!dto.id || !dto.name) {
    throw new Error(
      "Cannot map a Google Drive monthly expenses file DTO without id and name.",
    );
  }

  return {
    id: dto.id,
    month,
    name: dto.name,
    viewUrl: dto.webViewLink ?? null,
  };
}

export function parseGoogleDriveMonthlyExpensesContent(
  content: unknown,
  operationName: string,
): MonthlyExpensesDocument {
  try {
    const rawContent =
      typeof content === "string" ? JSON.parse(content) : content ?? {};
    const parsedDto = googleDriveMonthlyExpensesDocumentSchema.parse(rawContent);

    const normalizedDto = {
      ...parsedDto,
      items: parsedDto.items.map((item) => {
        const normalizedReceipts = item.receipts && item.receipts.length > 0
          ? item.receipts.map((receipt) => ({
              ...receipt,
              coveredPayments: receipt.coveredPayments ?? 1,
            }))
          : item.receipt
          ? [
              {
                allReceiptsFolderId: item.receipt.folderId,
                allReceiptsFolderViewUrl: item.receipt.folderViewUrl,
                coveredPayments: 1,
                fileId: item.receipt.fileId,
                fileName: item.receipt.fileName,
                fileViewUrl: item.receipt.fileViewUrl,
                monthlyFolderId: item.receipt.folderId,
                monthlyFolderViewUrl: item.receipt.folderViewUrl,
              },
            ]
          : [];
        const normalizedFolders = item.folders
          ? item.folders
          : normalizedReceipts[0]
          ? {
              allReceiptsFolderId: normalizedReceipts[0].allReceiptsFolderId,
              allReceiptsFolderViewUrl:
                normalizedReceipts[0].allReceiptsFolderViewUrl,
              monthlyFolderId: normalizedReceipts[0].monthlyFolderId,
              monthlyFolderViewUrl: normalizedReceipts[0].monthlyFolderViewUrl,
            }
          : undefined;

        return {
          currency: item.currency,
          description: item.description,
          ...(normalizedFolders ? { folders: normalizedFolders } : {}),
          id: item.id,
          ...(item.isPaid === true ? { isPaid: true } : {}),
          ...(item.loan ? { loan: item.loan } : {}),
          ...(item.manualCoveredPayments !== undefined
            ? { manualCoveredPayments: item.manualCoveredPayments }
            : {}),
          ...(item.paymentRecords !== undefined
            ? { paymentRecords: item.paymentRecords }
            : {}),
          occurrencesPerMonth: item.occurrencesPerMonth,
          ...(item.occurrencesUnit !== undefined
            ? { occurrencesUnit: item.occurrencesUnit }
            : {}),
          ...(item.paymentLink !== undefined
            ? { paymentLink: item.paymentLink }
            : {}),
          ...(item.receiptShareMessage !== undefined
            ? { receiptShareMessage: item.receiptShareMessage }
            : {}),
          ...(item.receiptSharePhoneDigits !== undefined
            ? { receiptSharePhoneDigits: item.receiptSharePhoneDigits }
            : {}),
          ...(item.receiptShareStatus !== undefined
            ? { receiptShareStatus: item.receiptShareStatus }
            : {}),
          ...(item.requiresReceiptShare === true
            ? { requiresReceiptShare: true }
            : {}),
          receipts: normalizedReceipts,
          subtotal: item.subtotal,
          ...(item.subtotalUnit !== undefined
            ? { subtotalUnit: item.subtotalUnit }
            : {}),
        };
      }),
    };

    return createMonthlyExpensesDocument(normalizedDto, operationName);
  } catch (error) {
    throw new Error(
      `${operationName} could not parse the stored monthly expenses document.`,
      { cause: error },
    );
  }
}
