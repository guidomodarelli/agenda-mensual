import { z } from "zod";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import {
  createMonthlyExpensesDocument,
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

const monthlyExpenseReceiptSchema = z.object({
  allReceiptsFolderId: z.string().trim().min(1),
  allReceiptsFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  fileId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  fileViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  monthlyFolderId: z.string().trim().min(1),
  monthlyFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
}).strict();

const monthlyExpenseFoldersSchema = z.object({
  allReceiptsFolderId: z.string().trim().min(1),
  allReceiptsFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
  monthlyFolderId: z.string().trim().min(1),
  monthlyFolderViewUrl: z
    .string()
    .trim()
    .refine((value) => RECEIPT_VIEW_URL_SCHEMA.safeParse(value).success),
}).strict();

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
  loan: z
    .object({
      installmentCount: z.number().int().positive(),
      lenderId: z.string().optional(),
      lenderName: z.string().optional(),
      startMonth: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    })
    .optional(),
  occurrencesPerMonth: z.number().int().positive(),
  paymentLink: z
    .string()
    .trim()
    .refine((value) => isValidHttpPaymentLink(value))
    .transform((value) => normalizeHttpPaymentLink(value))
    .nullable()
    .optional(),
  receipt: legacyMonthlyExpenseReceiptSchema.nullable().optional(),
  receipts: z.array(monthlyExpenseReceiptSchema).optional(),
  subtotal: z.number().positive(),
}).strict();

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

  return `gastos-mensuales-${yearValue}-${monthName}.json`;
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
            loan,
            occurrencesPerMonth,
            paymentLink,
            receipts,
            subtotal,
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
                    installmentCount: loan.installmentCount,
                    ...(loan.lenderId ? { lenderId: loan.lenderId } : {}),
                    ...(loan.lenderName ? { lenderName: loan.lenderName } : {}),
                    startMonth: loan.startMonth,
                  },
                }
              : {}),
            occurrencesPerMonth,
            paymentLink,
            ...(receipts.length > 0
              ? {
                  receipts: receipts.map((receipt) => ({
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
            subtotal,
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
          ? item.receipts
          : item.receipt
          ? [
              {
                allReceiptsFolderId: item.receipt.folderId,
                allReceiptsFolderViewUrl: item.receipt.folderViewUrl,
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
          ...(item.loan ? { loan: item.loan } : {}),
          occurrencesPerMonth: item.occurrencesPerMonth,
          ...(item.paymentLink !== undefined
            ? { paymentLink: item.paymentLink }
            : {}),
          receipts: normalizedReceipts,
          subtotal: item.subtotal,
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
