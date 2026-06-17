import { z } from "zod";

import { withCorrelationIdHeaders } from "@/modules/shared/infrastructure/observability/client-correlation-id";
import {
  type TechnicalErrorCode,
} from "@/modules/shared/infrastructure/errors/technical-error-codes";
import {
  parseTechnicalErrorResponse,
} from "@/modules/shared/infrastructure/errors/technical-error";

import type { MonthlyExpensesLoansReportResult } from "../../application/results/monthly-expenses-loans-report-result";

const monthlyExpensesReportEntrySchema = z.object({
  activeLoanCount: z.number().int().nonnegative(),
  direction: z.enum(["payable", "receivable"]),
  expenseDescriptions: z.array(
    z.object({
      count: z.number().int().positive(),
      description: z.string(),
    }),
  ),
  firstDebtMonth: z.string().nullable(),
  lenderId: z.string().nullable(),
  lenderName: z.string().trim().min(1),
  lenderType: z.enum(["bank", "family", "friend", "other", "unassigned"]),
  latestRecordedMonth: z.string().nullable(),
  remainingAmount: z.number().nonnegative(),
  trackedLoanCount: z.number().int().nonnegative(),
});

const monthlyExpensesReportSchema = z.object({
  data: z.object({
    entries: z.array(monthlyExpensesReportEntrySchema),
    summary: z.object({
      activeLoanCount: z.number().int().nonnegative(),
      lenderCount: z.number().int().nonnegative(),
      netRemainingAmount: z.number(),
      payableRemainingAmount: z.number().nonnegative(),
      receivableRemainingAmount: z.number().nonnegative(),
      remainingAmount: z.number().nonnegative(),
      trackedLoanCount: z.number().int().nonnegative(),
    }),
  }),
});

export class MonthlyExpensesReportApiError extends Error {
  readonly errorCode: TechnicalErrorCode | null;

  constructor(
    message: string,
    options?: ErrorOptions & {
      errorCode?: TechnicalErrorCode | null;
    },
  ) {
    super(message, options);
    this.name = "MonthlyExpensesReportApiError";
    this.errorCode = options?.errorCode ?? null;
  }
}

export async function getMonthlyExpensesLoansReportViaApi(
  fetchImplementation: typeof fetch = fetch,
): Promise<MonthlyExpensesLoansReportResult> {
  const response = await fetchImplementation("/api/storage/monthly-expenses-report", {
    headers: withCorrelationIdHeaders(),
  });
  const responseJson = await response.json();

  if (!response.ok) {
    const parsedError = parseTechnicalErrorResponse(responseJson);

    throw new MonthlyExpensesReportApiError(
      parsedError?.error ??
        "monthly-expenses-report-api:/api/storage/monthly-expenses-report returned an unexpected error response.",
      {
        errorCode: parsedError?.errorCode ?? null,
      },
    );
  }

  return monthlyExpensesReportSchema.parse(responseJson)
    .data as MonthlyExpensesLoansReportResult;
}
