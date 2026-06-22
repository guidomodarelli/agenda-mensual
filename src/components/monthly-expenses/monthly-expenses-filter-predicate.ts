import { matchesAdvancedYearMonthRangeFilter } from "@/components/ui/data-table";
import {
  normalizeFilterSlug,
  parseYearMonthSlug,
  UNASSIGNED_FOLDER_FILTER_VALUE,
  type AppliedFilter,
  type AppliedFilterValue,
  type FolderFilterValue,
  type TextMatchFilterValue,
} from "@/components/ui/filter-query-grammar";

import {
  matchesAdvancedEnumFilter,
  matchesAdvancedNumberRangeFilter,
  matchesAdvancedPresenceFilter,
} from "./monthly-expenses-advanced-filters";
import {
  getConvertedAmountForCurrency,
  getArsComparableAmount,
} from "./monthly-expenses-currency";
import { getPaymentProgress } from "./monthly-expenses-payment-progress";
import type {
  ExchangeRateSnapshot,
  MonthlyExpensesEditableRow,
  VigenciaSortMode,
} from "./monthly-expenses-table.types";

/**
 * Contexto necesario para evaluar algunos qualifiers que dependen de estado de
 * la tabla o de la cotización (total/usd en ARS, vigencia según modo de orden).
 */
export interface MonthlyExpenseFilterContext {
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  vigenciaSortMode: VigenciaSortMode;
}

type MonthlyExpenseFilterMatcher = (
  row: MonthlyExpensesEditableRow,
  value: AppliedFilterValue,
  context: MonthlyExpenseFilterContext,
) => boolean;

/** Cantidad de comprobantes enviados (registros con `sendStatus === "sent"`). */
export function getSentReceiptsCount(row: MonthlyExpensesEditableRow): number {
  return (row.paymentRecords ?? []).filter(
    (paymentRecord) => paymentRecord.sendStatus === "sent",
  ).length;
}

/** Valor interno de dirección de préstamo para el matcher enum. */
function getLoanDirectionFilterValue(row: MonthlyExpensesEditableRow): string {
  if (!row.isLoan) {
    return "none";
  }

  return row.loanDirection ?? "payable";
}

/** Año-mes comparable (`AAAAMM`) de un campo `YYYY-MM`, o `null`. */
function getYearMonthValue(monthValue: string): number | null {
  return parseYearMonthSlug(monthValue);
}

/**
 * Evalúa un qualifier de texto contra un campo de la fila. Compara de forma
 * case/acento-insensible usando el mismo normalizador que el parser.
 */
export function matchesTextMatch(
  value: TextMatchFilterValue,
  fieldValue: string | null,
): boolean {
  const normalizedField = normalizeFilterSlug(fieldValue ?? "");
  const hasValue = normalizedField.length > 0;

  if (value.op === "has") {
    return hasValue;
  }

  if (value.op === "notHas") {
    return !hasValue;
  }

  const text = value.text ?? "";

  if (!hasValue || !text) {
    return false;
  }

  if (value.op === "startsWith") {
    return normalizedField.startsWith(text);
  }

  if (value.op === "endsWith") {
    return normalizedField.endsWith(text);
  }

  if (value.op === "equals") {
    return normalizedField === text;
  }

  return normalizedField.includes(text);
}

/** Evalúa un qualifier de carpeta contra la carpeta asignada de la fila. */
export function matchesFolder(
  value: FolderFilterValue,
  expenseFolderId: string,
): boolean {
  if (value.folderId === UNASSIGNED_FOLDER_FILTER_VALUE) {
    return !expenseFolderId;
  }

  return expenseFolderId === value.folderId;
}

function numberRangeMatcher(
  getFieldValue: (
    row: MonthlyExpensesEditableRow,
    context: MonthlyExpenseFilterContext,
  ) => number | null,
): MonthlyExpenseFilterMatcher {
  return (row, value, context) =>
    matchesAdvancedNumberRangeFilter(value, getFieldValue(row, context));
}

/**
 * Registro de matchers por clave de qualifier. Reutiliza los matchers de
 * filtros avanzados y desacopla el filtrado de las columnas de TanStack.
 */
export const MONTHLY_EXPENSES_FILTER_MATCHERS: Record<
  string,
  MonthlyExpenseFilterMatcher
> = {
  subtotal: numberRangeMatcher((row, context) =>
    getArsComparableAmount({
      exchangeRateSnapshot: context.exchangeRateSnapshot,
      rowCurrency: row.currency,
      value: row.subtotal,
    }),
  ),
  total: numberRangeMatcher((row, context) =>
    getArsComparableAmount({
      exchangeRateSnapshot: context.exchangeRateSnapshot,
      rowCurrency: row.currency,
      value: row.total,
    }),
  ),
  usd: numberRangeMatcher((row, context) =>
    getConvertedAmountForCurrency({
      currency: "USD",
      exchangeRateSnapshot: context.exchangeRateSnapshot,
      rowCurrency: row.currency,
      total: Number(row.total),
    }),
  ),
  pagos: numberRangeMatcher((row) => getPaymentProgress(row).coveredPayments),
  registros: numberRangeMatcher((row) => (row.paymentRecords ?? []).length),
  enviados: numberRangeMatcher((row) => getSentReceiptsCount(row)),
  enviado: (row, value) =>
    matchesAdvancedPresenceFilter(value, getSentReceiptsCount(row) > 0),
  "cuotas-pagadas": numberRangeMatcher((row) => row.loanPaidInstallments),
  "cuotas-restantes": numberRangeMatcher((row) => row.loanRemainingInstallments),
  "cuotas-total": numberRangeMatcher((row) => row.loanTotalInstallments),
  link: (row, value) =>
    value.kind === "textMatch"
      ? matchesTextMatch(value, row.paymentLink)
      : true,
  prestamista: (row, value) =>
    value.kind === "textMatch"
      ? matchesTextMatch(value, row.lenderName)
      : true,
  direccion: (row, value) =>
    matchesAdvancedEnumFilter(value, getLoanDirectionFilterValue(row)),
  deuda: (row, value) =>
    matchesAdvancedPresenceFilter(
      value,
      row.isLoan && row.loanProgress.trim().length > 0,
    ),
  inicio: (row, value) =>
    matchesAdvancedYearMonthRangeFilter(value, getYearMonthValue(row.startMonth)),
  fin: (row, value) =>
    matchesAdvancedYearMonthRangeFilter(
      value,
      getYearMonthValue(row.loanEndMonth),
    ),
  vigencia: (row, value, context) =>
    matchesAdvancedYearMonthRangeFilter(
      value,
      getYearMonthValue(
        context.vigenciaSortMode === "endMonth"
          ? row.loanEndMonth
          : row.startMonth,
      ),
    ),
};

/** `true` si la fila satisface un único filtro aplicado (sin negación). */
function matchesAppliedFilter(
  row: MonthlyExpensesEditableRow,
  appliedFilter: AppliedFilter,
  context: MonthlyExpenseFilterContext,
): boolean {
  if (appliedFilter.value.kind === "folder") {
    return matchesFolder(appliedFilter.value, row.expenseFolderId);
  }

  const matcher = MONTHLY_EXPENSES_FILTER_MATCHERS[appliedFilter.key];

  // Sin matcher conocido, el filtro no excluye filas (no-op defensivo).
  return matcher ? matcher(row, appliedFilter.value, context) : true;
}

/**
 * Construye el predicado de filtrado a partir de los filtros aplicados. ANDea
 * todos los filtros no-folder (aplicando negación por filtro), exige al menos
 * una coincidencia entre los `carpeta:` positivos (OR) y excluye las filas que
 * matcheen cualquier `-carpeta:` (AND-NOT).
 */
export function buildMonthlyExpensesQueryPredicate(
  appliedFilters: AppliedFilter[],
  context: MonthlyExpenseFilterContext,
): (row: MonthlyExpensesEditableRow) => boolean {
  const folderIncludes: AppliedFilter[] = [];
  const folderExcludes: AppliedFilter[] = [];
  const otherFilters: AppliedFilter[] = [];

  for (const appliedFilter of appliedFilters) {
    if (appliedFilter.value.kind === "folder") {
      (appliedFilter.negated ? folderExcludes : folderIncludes).push(
        appliedFilter,
      );
      continue;
    }

    otherFilters.push(appliedFilter);
  }

  return (row) => {
    for (const appliedFilter of otherFilters) {
      const matches = matchesAppliedFilter(row, appliedFilter, context);

      if (appliedFilter.negated ? matches : !matches) {
        return false;
      }
    }

    if (
      folderIncludes.length > 0 &&
      !folderIncludes.some((appliedFilter) =>
        matchesAppliedFilter(row, appliedFilter, context),
      )
    ) {
      return false;
    }

    for (const appliedFilter of folderExcludes) {
      if (matchesAppliedFilter(row, appliedFilter, context)) {
        return false;
      }
    }

    return true;
  };
}
