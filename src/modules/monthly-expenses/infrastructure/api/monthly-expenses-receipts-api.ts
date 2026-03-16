import { z } from "zod";

import { withCorrelationIdHeaders } from "@/modules/shared/infrastructure/observability/client-correlation-id";

const uploadMonthlyExpenseReceiptRequestSchema = z.object({
  contentBase64: z.string().trim().min(1),
  coveredPayments: z.number().int().positive(),
  expenseDescription: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  mimeType: z.string().trim().min(1),
}).strict();

const deleteMonthlyExpenseReceiptRequestSchema = z.object({
  fileId: z.string().trim().min(1),
}).strict();

const monthlyExpenseReceiptResultSchema = z.object({
  allReceiptsFolderId: z.string().trim().min(1),
  allReceiptsFolderViewUrl: z.string().trim().url(),
  coveredPayments: z.number().int().positive(),
  fileId: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  fileViewUrl: z.string().trim().url(),
  monthlyFolderId: z.string().trim().min(1),
  monthlyFolderViewUrl: z.string().trim().url(),
}).strict();

const monthlyExpenseReceiptSuccessEnvelopeSchema = z.object({
  data: monthlyExpenseReceiptResultSchema,
}).strict();

const monthlyExpenseReceiptErrorEnvelopeSchema = z.object({
  error: z.string().trim().min(1),
}).strict();

export type UploadMonthlyExpenseReceiptRequest = z.infer<
  typeof uploadMonthlyExpenseReceiptRequestSchema
>;
export type MonthlyExpenseReceiptResult = z.infer<
  typeof monthlyExpenseReceiptResultSchema
>;

export class MonthlyExpenseReceiptsApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MonthlyExpenseReceiptsApiError";
  }
}

export async function uploadMonthlyExpenseReceiptViaApi(
  payload: UploadMonthlyExpenseReceiptRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<MonthlyExpenseReceiptResult> {
  const normalizedPayload = uploadMonthlyExpenseReceiptRequestSchema.parse(payload);
  const response = await fetchImplementation("/api/storage/monthly-expenses-receipts", {
    body: JSON.stringify(normalizedPayload),
    headers: withCorrelationIdHeaders({
      "Content-Type": "application/json",
    }),
    method: "POST",
  });
  const responseJson = await response.json();

  if (!response.ok) {
    const parsedError = monthlyExpenseReceiptErrorEnvelopeSchema.safeParse(
      responseJson,
    );

    throw new MonthlyExpenseReceiptsApiError(
      parsedError.success
        ? parsedError.data.error
        : "monthly-expenses-receipts-api:/api/storage/monthly-expenses-receipts returned an unexpected error response.",
    );
  }

  return monthlyExpenseReceiptSuccessEnvelopeSchema.parse(responseJson).data;
}

export async function deleteMonthlyExpenseReceiptViaApi(
  payload: z.infer<typeof deleteMonthlyExpenseReceiptRequestSchema>,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  const normalizedPayload = deleteMonthlyExpenseReceiptRequestSchema.parse(payload);
  const searchParams = new URLSearchParams({
    fileId: normalizedPayload.fileId,
  });
  const response = await fetchImplementation(
    `/api/storage/monthly-expenses-receipts?${searchParams.toString()}`,
    {
      headers: withCorrelationIdHeaders(),
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const responseJson = await response.json();
    const parsedError = monthlyExpenseReceiptErrorEnvelopeSchema.safeParse(
      responseJson,
    );

    throw new MonthlyExpenseReceiptsApiError(
      parsedError.success
        ? parsedError.data.error
        : "monthly-expenses-receipts-api:/api/storage/monthly-expenses-receipts returned an unexpected error response.",
    );
  }
}
