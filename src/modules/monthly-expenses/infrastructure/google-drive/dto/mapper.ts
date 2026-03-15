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

function sanitizeLegacyPaymentLink(paymentLink: unknown): unknown {
  if (typeof paymentLink !== "string") {
    return paymentLink;
  }

  const normalizedPaymentLink = paymentLink.trim();

  if (!normalizedPaymentLink) {
    return null;
  }

  try {
    return normalizeHttpPaymentLink(normalizedPaymentLink);
  } catch {
    return null;
  }
}

function sanitizeLegacyMonthlyExpensesContent(rawContent: unknown): unknown {
  if (!rawContent || typeof rawContent !== "object" || Array.isArray(rawContent)) {
    return rawContent;
  }

  const contentRecord = rawContent as Record<string, unknown>;
  const rawItems = contentRecord.items;

  if (!Array.isArray(rawItems)) {
    return rawContent;
  }

  return {
    ...contentRecord,
    items: rawItems.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return item;
      }

      const itemRecord = item as Record<string, unknown>;

      if (!Object.hasOwn(itemRecord, "paymentLink")) {
        return item;
      }

      return {
        ...itemRecord,
        paymentLink: sanitizeLegacyPaymentLink(itemRecord.paymentLink),
      };
    }),
  };
}

const googleDriveMonthlyExpenseItemSchema = z.object({
  currency: z.enum(["ARS", "USD"]),
  description: z.string().trim().min(1),
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
  subtotal: z.number().positive(),
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
});

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
            id,
            loan,
            occurrencesPerMonth,
            paymentLink,
            subtotal,
          }) => ({
            currency,
            description,
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
    const sanitizedContent = sanitizeLegacyMonthlyExpensesContent(rawContent);
    const parsedDto =
      googleDriveMonthlyExpensesDocumentSchema.parse(sanitizedContent);

    return createMonthlyExpensesDocument(parsedDto, operationName);
  } catch (error) {
    throw new Error(
      `${operationName} could not parse the stored monthly expenses document.`,
      { cause: error },
    );
  }
}
