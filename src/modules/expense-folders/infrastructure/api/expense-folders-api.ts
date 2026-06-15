import { z } from "zod";

import { withCorrelationIdHeaders } from "@/modules/shared/infrastructure/observability/client-correlation-id";
import {
  type TechnicalErrorCode,
} from "@/modules/shared/infrastructure/errors/technical-error-codes";
import {
  parseTechnicalErrorResponse,
} from "@/modules/shared/infrastructure/errors/technical-error";

import type { SaveExpenseFoldersCatalogCommand } from "../../application/commands/save-expense-folders-catalog-command";
import type { ExpenseFoldersCatalogDocumentResult } from "../../application/results/expense-folders-catalog-document-result";
import type { StoredExpenseFoldersCatalogResult } from "../../application/results/stored-expense-folders-catalog-result";
import {
  EXPENSE_FOLDER_COLORS,
  EXPENSE_FOLDER_ICONS,
} from "../../domain/value-objects/expense-folders-catalog-document";

const expenseFolderSchema = z.object({
  color: z.enum(EXPENSE_FOLDER_COLORS).nullish(),
  icon: z.enum(EXPENSE_FOLDER_ICONS).nullish(),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  position: z.number().int().min(0).optional(),
});

const expenseFoldersRequestSchema = z.object({
  folders: z.array(expenseFolderSchema),
});

const expenseFoldersCatalogResponseSchema = z.object({
  data: z.object({
    folders: z.array(expenseFolderSchema),
  }),
});

const storedExpenseFoldersResponseSchema = z.object({
  data: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
});

export class ExpenseFoldersApiError extends Error {
  readonly errorCode: TechnicalErrorCode | null;

  constructor(
    message: string,
    options?: ErrorOptions & {
      errorCode?: TechnicalErrorCode | null;
    },
  ) {
    super(message, options);
    this.name = "ExpenseFoldersApiError";
    this.errorCode = options?.errorCode ?? null;
  }
}

export async function getExpenseFoldersCatalogViaApi(
  fetchImplementation: typeof fetch = fetch,
): Promise<ExpenseFoldersCatalogDocumentResult> {
  const response = await fetchImplementation("/api/storage/expense-folders", {
    headers: withCorrelationIdHeaders(),
  });
  const responseJson = await response.json();

  if (!response.ok) {
    const parsedError = parseTechnicalErrorResponse(responseJson);

    throw new ExpenseFoldersApiError(
      parsedError?.error ??
        "expense-folders-api:/api/storage/expense-folders returned an unexpected error response.",
      {
        errorCode: parsedError?.errorCode ?? null,
      },
    );
  }

  return expenseFoldersCatalogResponseSchema.parse(responseJson)
    .data as ExpenseFoldersCatalogDocumentResult;
}

export async function saveExpenseFoldersCatalogViaApi(
  payload: SaveExpenseFoldersCatalogCommand,
  fetchImplementation: typeof fetch = fetch,
): Promise<StoredExpenseFoldersCatalogResult> {
  const normalizedPayload = expenseFoldersRequestSchema.parse(payload);
  const response = await fetchImplementation("/api/storage/expense-folders", {
    body: JSON.stringify(normalizedPayload),
    headers: withCorrelationIdHeaders({
      "Content-Type": "application/json",
    }),
    method: "POST",
  });
  const responseJson = await response.json();

  if (!response.ok) {
    const parsedError = parseTechnicalErrorResponse(responseJson);

    throw new ExpenseFoldersApiError(
      parsedError?.error ??
        "expense-folders-api:/api/storage/expense-folders returned an unexpected error response.",
      {
        errorCode: parsedError?.errorCode ?? null,
      },
    );
  }

  return storedExpenseFoldersResponseSchema.parse(responseJson)
    .data as StoredExpenseFoldersCatalogResult;
}
