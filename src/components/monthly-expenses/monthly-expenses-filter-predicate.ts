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
 * Modo de vigencia por defecto cuando el contexto no lo provee. Coincide con
 * `DEFAULT_VIGENCIA_SORT_MODE` de las preferencias de la tabla: la vigencia se
 * mide por el mes de inicio salvo que el usuario elija el mes de fin.
 */
const DEFAULT_VIGENCIA_SORT_MODE: VigenciaSortMode = "startMonth";

/**
 * Contexto necesario para evaluar los qualifiers que dependen de la cotización
 * (total/usd/subtotal comparados en ARS).
 */
export interface MonthlyExpenseFilterContext {
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  /**
   * Nombre mostrado de cada prestamista por id. Permite que el enum
   * `prestamista:<slug>` siga matcheando filas legacy que solo guardan
   * `lenderName` (sin `lenderId`), resolviendo el id seleccionado a su nombre.
   */
  lenderNamesById?: ReadonlyMap<string, string>;
  /**
   * Criterio para resolver la vigencia de la fila (`startMonth` vs
   * `loanEndMonth`), igual que la columna Vigencia. Determina qué año-mes usan
   * el matcher `vigencia:` y su predicado de presencia. Por defecto
   * `startMonth`.
   */
  vigenciaSortMode?: VigenciaSortMode;
}

/** Año-mes (`YYYY-MM`) que define la vigencia de la fila según el modo activo. */
function getVigenciaMonthValue(
  row: MonthlyExpensesEditableRow,
  context: MonthlyExpenseFilterContext,
): string {
  const vigenciaSortMode = context.vigenciaSortMode ?? DEFAULT_VIGENCIA_SORT_MODE;

  return vigenciaSortMode === "endMonth" ? row.loanEndMonth : row.startMonth;
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
 * Fallback de prestamista para filas legacy: documentos previos al id estable
 * guardan solo `lenderName` (con `lenderId` vacío) pero la tabla igual muestra
 * el nombre. Como el enum filtra por id, sin esto `prestamista:<slug>` excluiría
 * la fila visible aunque el nombre coincida. Resuelve el id seleccionado a su
 * nombre vía el contexto y lo compara, normalizado, contra el nombre mostrado.
 */
function matchesLegacyLenderByName(
  value: AppliedFilterValue,
  row: MonthlyExpensesEditableRow,
  context: MonthlyExpenseFilterContext,
): boolean {
  if (value.kind !== "enum" || row.lenderId.trim().length > 0) {
    return false;
  }

  const selectedLenderName = context.lenderNamesById?.get(value.value);

  if (!selectedLenderName) {
    return false;
  }

  const normalizedSelected = normalizeFilterSlug(selectedLenderName);

  return (
    normalizedSelected.length > 0 &&
    normalizedSelected === normalizeFilterSlug(row.lenderName)
  );
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
  "cuotas-pagadas": numberRangeMatcher((row) => row.loanPaidInstallments),
  "cuotas-restantes": numberRangeMatcher((row) => row.loanRemainingInstallments),
  "cuotas-total": numberRangeMatcher((row) => row.loanTotalInstallments),
  link: (row, value) =>
    value.kind === "textMatch"
      ? matchesTextMatch(value, stripTrailingSlashes(row.paymentLink))
      : true,
  prestamista: (row, value, context) =>
    value.kind === "textMatch"
      ? matchesTextMatch(value, row.lenderName)
      : matchesAdvancedEnumFilter(value, row.lenderId) ||
        matchesLegacyLenderByName(value, row, context),
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
      getYearMonthValue(getVigenciaMonthValue(row, context)),
    ),
};

/** `true` si un texto crudo tiene contenido (tras normalizar acentos/espacios). */
function hasText(fieldValue: string): boolean {
  return normalizeFilterSlug(fieldValue).length > 0;
}

/**
 * Quita las barras finales del link de pago para compararlo. Los links se
 * guardan normalizados con una barra final (p. ej. `https://x.com.ar/`), que de
 * otro modo rompería un filtro "termina con" (`*.com.ar`) aunque el dominio sí
 * termine ahí.
 */
function stripTrailingSlashes(link: string): string {
  return link.replace(/\/+$/, "");
}

/** `true` si un monto crudo es un número finito distinto de cero. */
function hasNonZeroAmount(rawAmount: string): boolean {
  const amount = Number(rawAmount);

  return Number.isFinite(amount) && amount !== 0;
}

type MonthlyExpensePresencePredicate = (
  row: MonthlyExpensesEditableRow,
  context: MonthlyExpenseFilterContext,
) => boolean;

/**
 * Define, por campo, qué significa que ese campo "tenga valor". Lo consumen las
 * meta-claves `tiene:<campo>` / `no:<campo>`, unificando la presencia de todos
 * los kinds (monto > 0, cantidad > 0, texto no vacío, fecha válida, etc.).
 */
export const MONTHLY_EXPENSES_PRESENCE_PREDICATES: Record<
  string,
  MonthlyExpensePresencePredicate
> = {
  subtotal: (row) => hasNonZeroAmount(row.subtotal),
  total: (row) => hasNonZeroAmount(row.total),
  usd: (row, context) => {
    const convertedUsd = getConvertedAmountForCurrency({
      currency: "USD",
      exchangeRateSnapshot: context.exchangeRateSnapshot,
      rowCurrency: row.currency,
      total: Number(row.total),
    });

    return convertedUsd != null && convertedUsd !== 0;
  },
  pagos: (row) => getPaymentProgress(row).coveredPayments > 0,
  registros: (row) => (row.paymentRecords ?? []).length > 0,
  enviados: (row) => getSentReceiptsCount(row) > 0,
  "cuotas-pagadas": (row) => (row.loanPaidInstallments ?? 0) > 0,
  "cuotas-restantes": (row) => (row.loanRemainingInstallments ?? 0) > 0,
  "cuotas-total": (row) => (row.loanTotalInstallments ?? 0) > 0,
  link: (row) => hasText(row.paymentLink),
  prestamista: (row) => hasText(row.lenderName),
  direccion: (row) => row.isLoan,
  deuda: (row) => row.isLoan && row.loanProgress.trim().length > 0,
  inicio: (row) => getYearMonthValue(row.startMonth) != null,
  fin: (row) => getYearMonthValue(row.loanEndMonth) != null,
  vigencia: (row, context) =>
    getYearMonthValue(getVigenciaMonthValue(row, context)) != null,
  carpeta: (row) => hasText(row.expenseFolderId),
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

  // Presencia (`tiene:<campo>` / `no:<campo>`): se evalúa con el predicado de
  // presencia del campo, no con su matcher de valor (que ignoraría el kind).
  if (appliedFilter.value.kind === "presence") {
    const isPresent = MONTHLY_EXPENSES_PRESENCE_PREDICATES[appliedFilter.key];

    return matchesAdvancedPresenceFilter(
      appliedFilter.value,
      isPresent ? isPresent(row, context) : true,
    );
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
