import { z } from "zod";

import type { SaveMonthlyExpensesCommand } from "../../application/commands/save-monthly-expenses-command";
import type { StoredMonthlyExpensesDocumentResult } from "../../application/results/stored-monthly-expenses-document-result";

const monthlyExpenseItemSchema = z.object({
  currency: z.enum(["ARS", "USD"]),
  description: z.string().trim().min(1),
  id: z.string().trim().min(1),
  occurrencesPerMonth: z.number().int().positive(),
  subtotal: z.number().positive(),
});

const monthlyExpensesRequestSchema = z.object({
  items: z.array(monthlyExpenseItemSchema),
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const storedMonthlyExpensesDocumentSchema = z.object({
  id: z.string().trim().min(1),
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  name: z.string().trim().min(1),
  viewUrl: z.string().trim().url().nullable().optional(),
});

const monthlyExpensesSuccessEnvelopeSchema = z.object({
  data: storedMonthlyExpensesDocumentSchema,
});

const monthlyExpensesErrorEnvelopeSchema = z.object({
  error: z.string().trim().min(1),
});

export class MonthlyExpensesApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MonthlyExpensesApiError";
  }
}

export async function saveMonthlyExpensesDocumentViaApi(
  payload: SaveMonthlyExpensesCommand,
  fetchImplementation: typeof fetch = fetch,
): Promise<StoredMonthlyExpensesDocumentResult> {
  const normalizedPayload = monthlyExpensesRequestSchema.parse(payload);
  const response = await fetchImplementation("/api/storage/monthly-expenses", {
    body: JSON.stringify(normalizedPayload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const responseJson = await response.json();

  if (!response.ok) {
    const parsedError =
      monthlyExpensesErrorEnvelopeSchema.safeParse(responseJson);

    throw new MonthlyExpensesApiError(
      parsedError.success
        ? parsedError.data.error
        : "monthly-expenses-api:/api/storage/monthly-expenses returned an unexpected error response.",
    );
  }

  return monthlyExpensesSuccessEnvelopeSchema.parse(responseJson)
    .data as StoredMonthlyExpensesDocumentResult;
}
