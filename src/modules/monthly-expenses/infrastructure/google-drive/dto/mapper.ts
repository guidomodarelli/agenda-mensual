import { z } from "zod";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import {
  createMonthlyExpensesDocument,
  type MonthlyExpensesDocument,
} from "../../../domain/value-objects/monthly-expenses-document";
import type { GoogleDriveMonthlyExpensesFileDto } from "./google-drive-monthly-expenses-file.dto";

const googleDriveMonthlyExpenseItemSchema = z.object({
  currency: z.enum(["ARS", "USD"]),
  description: z.string().trim().min(1),
  id: z.string().trim().min(1),
  occurrencesPerMonth: z.number().int().positive(),
  subtotal: z.number().positive(),
});

const googleDriveMonthlyExpensesDocumentSchema = z.object({
  items: z.array(googleDriveMonthlyExpenseItemSchema),
  month: z.string().trim().min(1),
});

const MONTHLY_EXPENSES_MIME_TYPE = "application/json";

export function createMonthlyExpensesFileName(month: string): string {
  return `monthly-expenses-${month}.json`;
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
        items: document.items.map(
          ({ currency, description, id, occurrencesPerMonth, subtotal }) => ({
            currency,
            description,
            id,
            occurrencesPerMonth,
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

    return createMonthlyExpensesDocument(parsedDto, operationName);
  } catch (error) {
    throw new Error(
      `${operationName} could not parse the stored monthly expenses document.`,
      { cause: error },
    );
  }
}
