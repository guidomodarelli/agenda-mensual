import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type DataTableAdvancedFilterConfig,
  matchesAdvancedYearMonthRangeFilter,
} from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Highlighter,
} from "@/components/ui/highlighter";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Link2,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { ExpenseRowActions } from "@/components/monthly-expenses/expense-row-actions";
import {
  ExpenseSheet,
  type ExpenseEditableFieldName,
} from "@/components/monthly-expenses/expense-sheet";

import {
  getExactMatchIndices,
  getFuzzyMatchRank,
  getFuzzyMatchIndices,
  normalizeSearchValue,
  renderHighlightedText,
} from "./fuzzy-search";
import {
  formatCurrencyDisplayWithOptions,
  normalizeCurrencyInput,
} from "./currency-input-format";
import { LoanInfoPopover } from "./loan-info-popover";
import type { LenderOption } from "./lender-picker";
import type { ExpenseFolderOption } from "./expense-folder-picker";
import { UNASSIGNED_EXPENSE_FOLDER_FILTER_ID } from "./expense-folder-visuals";
import {
  ExpenseFolderFilterBar,
  ExpenseFolderRowBadge,
} from "./expense-folder-organizer";
import {
  formatReceiptSharePhoneDisplay,
  normalizeReceiptSharePhoneDigits,
  RECEIPT_SHARE_PHONE_REQUIRED_ERROR_MESSAGE,
  validateHourDuration,
  validateOccurrencesPerMonth,
  validateOccurrencesUnit,
  validateReceiptSharePhoneDigits,
  validateSubtotalAmount,
} from "./expense-edit-validation";
import { OccurrenceDurationInput } from "./occurrence-duration-input";
import { formatSubtotalMultiplierLabel } from "./occurrences-unit";
import {
  formatConvertedAmount,
  formatCurrencyAmount,
  formatExchangeRateAmount,
  getArsComparableAmount,
  getConvertedAmountForCurrency,
  getConvertedTotalAmount,
} from "./monthly-expenses-currency";
import {
  getPaymentProgress,
  isPaymentCompleted,
} from "./monthly-expenses-payment-progress";
import { getNormalizedReceiptShareStatus } from "./monthly-expenses-receipt-share";
import {
  matchesAdvancedEnumFilter,
  matchesAdvancedPresenceFilter,
  matchesAdvancedNumberRangeFilter,
} from "./monthly-expenses-advanced-filters";
import {
  buildMonthlyExpensesFilterQualifiers,
  COLUMN_BACKED_QUALIFIER_KEYS,
} from "./monthly-expenses-filter-qualifiers";
import { buildMonthlyExpensesQueryPredicate } from "./monthly-expenses-filter-predicate";
import type { AppliedFilter } from "@/components/ui/filter-query-grammar";
import {
  compareValuesKeepingInvalidLast,
  getColumnSortDirection,
} from "./monthly-expenses-sort-comparators";
import {
  BULK_SELECTION_COLUMN_ID,
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  LOAN_SORT_COLUMN_ID,
} from "./monthly-expenses-table-column-ids";
import { PaymentHistoryCell } from "./payment-history-cell";
import { PaymentProgressRing } from "./payment-progress-ring";
import {
  DEFAULT_LOAN_SORT_MODE,
  DEFAULT_VIGENCIA_SORT_MODE,
  getPersistedMonthlyExpensesTablePreferences,
  MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY,
  persistMonthlyExpensesTablePreferences,
} from "./monthly-expenses-table-preferences";
import {
  getValidPaymentLink as getValidPaymentLinkUrl,
  PAYMENT_LINK_VALIDATION_ERROR_MESSAGE,
} from "./payment-link";
import styles from "./monthly-expenses-table.module.scss";

import type {
  ExchangeRateSnapshot,
  LoanSortMode,
  MonthlyExpenseCurrency,
  MonthlyExpenseDriveResourceStatus,
  MonthlyExpenseLoanDirection,
  MonthlyExpenseReceiptShareStatus,
  MonthlyExpenseSubtotalUnit,
  MonthlyExpensesEditableRow,
  MonthlyExpensesReplicableOption,
  TechnicalErrorCode,
  VigenciaSortMode,
} from "./monthly-expenses-table.types";

export type {
  MonthlyExpenseDriveResourceStatus,
  MonthlyExpenseLoanDirection,
  MonthlyExpenseSubtotalUnit,
  MonthlyExpensesEditablePaymentRecord,
  MonthlyExpensesEditableReceipt,
  MonthlyExpensesEditableRow,
  MonthlyExpensesReplicableOption,
} from "./monthly-expenses-table.types";
const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MOVE_COMPLETED_TO_END_LABEL = "Mover completados al final";
const MOVE_COMPLETED_TO_END_WITH_SORTING_HELPER_TEXT =
  "Desactivado mientras haya un orden manual.";
/**
 * Cantidad máxima de caracteres que se muestran en la descripción de la fila
 * antes de truncar con ellipsis y exponer el texto completo en un tooltip.
 */
const DESCRIPTION_TRUNCATE_CHAR_LIMIT = 32;
const MONTHLY_EXPENSES_EMPTY_MESSAGE = "No hay gastos cargados para este mes.";
const MONTHLY_EXPENSES_FILTERED_EMPTY_MESSAGE =
  "No hay resultados para los filtros actuales.";
const LOAN_SORT_OPTIONS: Array<{ label: string; value: LoanSortMode }> = [
  {
    label: "Cuotas pagadas",
    value: "paidInstallments",
  },
  {
    label: "Cuotas restantes",
    value: "remainingInstallments",
  },
  {
    label: "Total de cuotas",
    value: "totalInstallments",
  },
];
const LOAN_SORT_DIRECTION_OPTIONS: Array<{
  label: string;
  value: "asc" | "desc";
}> = [
  {
    label: "Ascendente",
    value: "asc",
  },
  {
    label: "Descendente",
    value: "desc",
  },
];
const VIGENCIA_SORT_OPTIONS: Array<{ label: string; value: VigenciaSortMode }> = [
  {
    label: "Inicio cuota",
    value: "startMonth",
  },
  {
    label: "Fin cuota",
    value: "endMonth",
  },
];
const LOAN_DIRECTION_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  {
    label: "Yo debo",
    value: "payable",
  },
  {
    label: "Me deben",
    value: "receivable",
  },
  {
    label: "Sin deuda/préstamo",
    value: "none",
  },
];

function areSetsEqual<TValue>(leftSet: Set<TValue>, rightSet: Set<TValue>): boolean {
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }

  return true;
}
const MONTHLY_EXPENSES_ADVANCED_FILTERS_CONFIG: DataTableAdvancedFilterConfig[] = [
  {
    columnId: "subtotal",
    label: "Subtotal",
    type: "numberRange",
  },
  {
    columnId: "total",
    label: "Total",
    type: "numberRange",
  },
  {
    columnId: "usd",
    label: "USD",
    type: "numberRange",
  },
  {
    columnId: "paymentsProgress",
    label: "Pagos",
    type: "numberRange",
  },
  {
    columnId: "paymentHistory",
    label: "Registros",
    type: "numberRange",
  },
  {
    columnId: LOAN_SORT_COLUMN_ID,
    label: "Deuda / cuotas",
    type: "presence",
  },
  {
    columnId: "lenderName",
    enumOptions: LOAN_DIRECTION_FILTER_OPTIONS,
    label: "Dirección",
    type: "enum",
  },
  {
    columnId: LOAN_INSTALLMENT_RANGE_COLUMN_ID,
    label: "Vigencia",
    type: "yearMonthRange",
  },
];

const MONTHLY_EXPENSES_QUERY_FILTER_LABEL = "Filtro unificado de gastos";
const MONTHLY_EXPENSES_QUERY_FILTER_PLACEHOLDER =
  "Filtrar por campo o palabra (ej. total:>1000 direccion:me-deben)";

function buildLoanSortingState(direction: "asc" | "desc"): SortingState {
  return [
    {
      desc: direction === "desc",
      id: LOAN_SORT_COLUMN_ID,
    },
  ];
}

function buildVigenciaSortingState(direction: "asc" | "desc"): SortingState {
  return [
    {
      desc: direction === "desc",
      id: LOAN_INSTALLMENT_RANGE_COLUMN_ID,
    },
  ];
}

interface SortModeColumnHeaderProps<TMode extends string> {
  column: {
    getCanHide: () => boolean;
    getCanSort: () => boolean;
    getIsSorted: () => false | "asc" | "desc";
    toggleVisibility: (value?: boolean) => void;
  };
  label: string;
  onApplySort: (args: { direction: "asc" | "desc"; mode: TMode }) => void;
  optionIdPrefix: string;
  sortMode: TMode;
  sortOptions: ReadonlyArray<{ label: string; value: TMode }>;
}

function SortModeColumnHeader<TMode extends string>({
  column,
  label,
  onApplySort,
  optionIdPrefix,
  sortMode,
  sortOptions,
}: SortModeColumnHeaderProps<TMode>) {
  const canSort = column.getCanSort();
  const currentSortDirection = column.getIsSorted() === "desc" ? "desc" : "asc";
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [draftSortMode, setDraftSortMode] = useState<TMode>(sortMode);
  const [draftSortDirection, setDraftSortDirection] = useState<"asc" | "desc">(
    currentSortDirection,
  );

  function handlePopoverOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftSortMode(sortMode);
      setDraftSortDirection(currentSortDirection);
    }

    setIsPopoverOpen(nextOpen);
  }

  if (!canSort) {
    return (
      <span className={styles.sortableHeader}>
        <span className={styles.headLabel}>{label}</span>
      </span>
    );
  }

  const sorted = column.getIsSorted();
  const SortIcon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className={styles.loanSortHeader}>
      <span className={styles.sortableHeader}>
        <span className={styles.headLabel}>{label}</span>
        <Popover onOpenChange={handlePopoverOpenChange} open={isPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label={`Ordenar ${label}`}
              className={styles.sortIconButton}
              type="button"
            >
              <SortIcon aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className={styles.loanSortPopover}>
            <p className={styles.loanSortPopoverTitle}>Criterio</p>

            <RadioGroup
              aria-label={`Criterio de orden para ${label}`}
              className={styles.loanSortOptions}
              onValueChange={(value) => setDraftSortMode(value as TMode)}
              value={draftSortMode}
            >
              {sortOptions.map((option) => {
                const radioId = `${optionIdPrefix}-mode-${option.value}`;

                return (
                  <div className={styles.loanSortOption} key={option.value}>
                    <RadioGroupItem
                      aria-label={option.label}
                      id={radioId}
                      value={option.value}
                    />
                    <Label className={styles.loanSortOptionLabel} htmlFor={radioId}>
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            <p className={styles.loanSortPopoverTitle}>Dirección</p>

            <RadioGroup
              aria-label={`Dirección de orden para ${label}`}
              className={styles.loanSortOptions}
              onValueChange={(value) =>
                setDraftSortDirection(value as "asc" | "desc")
              }
              value={draftSortDirection}
            >
              {LOAN_SORT_DIRECTION_OPTIONS.map((option) => {
                const radioId = `${optionIdPrefix}-direction-${option.value}`;

                return (
                  <div className={styles.loanSortOption} key={option.value}>
                    <RadioGroupItem
                      aria-label={option.label}
                      id={radioId}
                      value={option.value}
                    />
                    <Label className={styles.loanSortOptionLabel} htmlFor={radioId}>
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            <p className={styles.loanSortHint}>Los cambios se aplican al presionar Aplicar.</p>

            <div className={styles.loanSortActions}>
              <Button
                className={styles.loanSortDiscardButton}
                onClick={() => {
                  setIsPopoverOpen(false);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Descartar
              </Button>
              <Button
                className={styles.loanSortApplyButton}
                onClick={() => {
                  onApplySort({
                    direction: draftSortDirection,
                    mode: draftSortMode,
                  });
                  setIsPopoverOpen(false);
                }}
                size="sm"
                type="button"
              >
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </span>
    </div>
  );
}

interface MonthlyExpensesTableProps {
  actionDisabled: boolean;
  changedFields: Set<string>;
  draft: MonthlyExpensesEditableRow | null;
  exchangeRateLoadError: string | null;
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  expenseFolders: ExpenseFolderOption[];
  folderFilterId: string;
  feedbackMessage: string;
  feedbackErrorCode?: TechnicalErrorCode | null;
  feedbackTone: "default" | "error" | "success";
  isCopyFromDisabled: boolean;
  isExpenseSheetOpen: boolean;
  isMonthTransitionPending: boolean;
  isSubmitting: boolean;
  lenders: LenderOption[];
  loadError: string | null;
  loadErrorCode?: TechnicalErrorCode | null;
  month: string;
  pendingMonth: string | null;
  onAddExpense: () => void;
  onAddLender: () => void;
  onCopyFromMonth: () => void;
  onCopyFromMonthDialogOpenChange: (isOpen: boolean) => void;
  onConfirmCopyFromMonth: (selectedOptionIds: string[]) => void;
  onToggleAllReplicableOptions: () => void;
  onToggleReplicableOption: (optionId: string) => void;
  onCancelRecurrence: (expenseId: string) => void | Promise<void>;
  onReactivateRecurrence: (expenseId: string) => void | Promise<void>;
  onDeleteAllReceiptsFolderReference: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  onDeleteExpenses: (expenseIds: string[]) => Promise<boolean>;
  onDeleteExpenseReceiptShare: (expenseId: string) => void | Promise<void>;
  onDeletePaymentLink: (expenseId: string) => void | Promise<void>;
  onDeleteMonthlyFolderReference: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onExpenseFieldChange: (
    fieldName: ExpenseEditableFieldName,
    value: string,
  ) => void;
  onExpenseFolderSelect: (folderId: string | null) => void;
  onFolderFilterChange: (folderId: string) => void;
  onManageFolders: () => void;
  onMoveExpenseToFolder: (args: {
    expenseId: string;
    folderId: string | null;
  }) => void;
  onReorderFolders: (orderedFolderIds: string[]) => void;
  onExpenseLenderSelect: (lenderId: string | null) => void;
  onExpenseLoanToggle: (checked: boolean) => void;
  onExpenseRecurringToggle: (checked: boolean) => void;
  onExpenseReceiptShareToggle: (checked: boolean) => void;
  onMonthChange: (value: string) => void;
  onDeleteReceipt: (args: {
    expenseId: string;
    receiptFileId: string;
  }) => void;
  onEditReceiptCoverage: (args: {
    expenseId: string;
    receiptFileId: string;
  }) => void;
  onRegisterPaymentRecord: (args: {
    coveredPayments: number;
    expenseId: string;
    file: File | null;
  }) => Promise<boolean>;
  onEditManualPaymentRecord: (args: {
    expenseId: string;
    paymentRecordId: string;
  }) => void;
  onDeleteManualPaymentRecord: (args: {
    expenseId: string;
    paymentRecordId: string;
  }) => void;
  onUpdatePaymentLink: (args: {
    expenseId: string;
    paymentLink: string;
  }) => void | Promise<void>;
  onUpdateExpenseDetails: (args: {
    expenseId: string;
    occurrencesPerMonth: number;
    occurrencesUnit: string;
    subtotal: number;
    subtotalUnit: MonthlyExpenseSubtotalUnit;
  }) => void | Promise<void>;
  onUpdateExpenseReceiptShare: (args: {
    expenseId: string;
    receiptShareMessage: string;
    receiptSharePhoneDigits: string;
  }) => void | Promise<void>;
  onUpdatePaymentRecordSendStatus: (args: {
    expenseId: string;
    paymentRecordId: string;
    sendStatus: MonthlyExpenseReceiptShareStatus;
  }) => void | Promise<void>;
  onRequestCloseExpenseSheet: () => void;
  onSaveExpense: () => void;
  onSaveUnsavedChanges: () => void;
  onUnsavedChangesClose: () => void;
  onUnsavedChangesDiscard: () => void;
  replicateFromPreviousMonthDialogOpen: boolean;
  replicateFromPreviousMonthOptions: MonthlyExpensesReplicableOption[];
  selectedReplicableOptionIds: string[];
  rows: MonthlyExpensesEditableRow[];
  sheetMode: "create" | "edit";
  showCopyFromControls: boolean;
  showUnsavedChangesDialog: boolean;
  validationMessage: string | null;
}

interface PaymentLinkDialogState {
  expenseDescription: string;
  expenseId: string;
  mode: "create" | "edit";
}

interface ExpenseDetailsDialogState {
  currency: MonthlyExpenseCurrency;
  expenseDescription: string;
  expenseId: string;
}

interface ExpenseReceiptShareDialogState {
  expenseDescription: string;
  expenseId: string;
  mode: "create" | "edit";
}

function getSortableHeader(label: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      getCanHide: () => boolean;
      getCanSort: () => boolean;
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (desc?: boolean) => void;
      toggleVisibility: (value?: boolean) => void;
    };
  }) {
    if (!column.getCanSort()) {
      return (
        <span className={styles.sortableHeader}>
          <span className={styles.headLabel}>{label}</span>
        </span>
      );
    }

    const sorted = column.getIsSorted();
    const SortIcon =
      sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

    return (
      <span className={styles.sortableHeader}>
        <span className={styles.headLabel}>{label}</span>
        <button
          aria-label={`Ordenar ${label}`}
          className={styles.sortIconButton}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          type="button"
        >
          <SortIcon aria-hidden="true" />
        </button>
      </span>
    );
  };
}

/**
 * Unified muted placeholder for columns that only apply to loans (loan progress,
 * lender, validity range). Keeps every empty loan cell visually quiet and
 * consistent instead of mixing "N/A" and "-" glyphs.
 */
function EmptyCellPlaceholder() {
  return <span className={styles.emptyCellPlaceholder}>—</span>;
}

function getLoanSortModeLabel(loanSortMode: LoanSortMode): string {
  const option = LOAN_SORT_OPTIONS.find((entry) => entry.value === loanSortMode);

  if (!option) {
    return "Cuotas pagadas";
  }

  return option.label;
}

function getVigenciaSortModeLabel(vigenciaSortMode: VigenciaSortMode): string {
  const option = VIGENCIA_SORT_OPTIONS.find(
    (entry) => entry.value === vigenciaSortMode,
  );

  if (!option) {
    return "Inicio cuota";
  }

  return option.label;
}

function parseYearMonth(value: string): { month: string; year: string } | null {
  const normalizedValue = value.trim();
  const match = YEAR_MONTH_PATTERN.exec(normalizedValue);

  if (!match) {
    return null;
  }

  const [, year, month] = match;

  return {
    month,
    year,
  };
}

function formatYearMonth(value: string): string {
  const parsedValue = parseYearMonth(value);

  if (!parsedValue) {
    return "-";
  }

  return `${parsedValue.month}/${parsedValue.year.slice(-2)}`;
}

function getLoanDirectionLabel(
  direction: MonthlyExpenseLoanDirection,
): string {
  return direction === "payable" ? "Yo debo" : "Me deben";
}

function getLoanDirectionFilterValue(row: MonthlyExpensesEditableRow): string {
  if (!row.isLoan) {
    return "none";
  }

  return row.loanDirection ?? "payable";
}

function getYearMonthSortValue(value: string): number | null {
  const parsedValue = parseYearMonth(value);

  if (!parsedValue) {
    return null;
  }

  return Number(`${parsedValue.year}${parsedValue.month}`);
}

function getVigenciaSortValue(
  row: MonthlyExpensesEditableRow,
  vigenciaSortMode: VigenciaSortMode,
): number | null {
  return getYearMonthSortValue(
    vigenciaSortMode === "endMonth" ? row.loanEndMonth : row.startMonth,
  );
}

function getLoanSortValue(
  row: MonthlyExpensesEditableRow,
  loanSortMode: LoanSortMode,
): number | null {
  switch (loanSortMode) {
    case "paidInstallments":
      return row.loanPaidInstallments;
    case "remainingInstallments":
      return row.loanRemainingInstallments;
    case "totalInstallments":
      return row.loanTotalInstallments;
  }
}

function hasExactDescriptionMatch(value: string, query: string): boolean {
  return getExactMatchIndices(value, query) !== null;
}

function hasFuzzyDescriptionMatch(value: string, query: string): boolean {
  return getFuzzyMatchIndices(value, query) !== null;
}

function includesExcludedDescription(
  description: string,
  excludedDescriptionFilters: string[],
): boolean {
  return excludedDescriptionFilters.some(
    (excludedDescriptionFilter) =>
      hasExactDescriptionMatch(description, excludedDescriptionFilter),
  );
}

function getNonEmptyDescriptionFilters(descriptionFilters: string[]): string[] {
  return descriptionFilters
    .map((descriptionFilter) => descriptionFilter.trim())
    .filter((descriptionFilter) => descriptionFilter.length > 0);
}

function getPrimaryDescriptionFilter(descriptionFilter: string): string {
  const normalizedDescriptionFilter = descriptionFilter.trimStart();

  if (!normalizedDescriptionFilter.startsWith("-")) {
    return descriptionFilter;
  }

  return "";
}

function getRowsMatchingDescriptionFilter(
  rows: MonthlyExpensesEditableRow[],
  descriptionFilter: string,
): MonthlyExpensesEditableRow[] {
  const normalizedDescriptionFilter = descriptionFilter.trim();

  if (!normalizedDescriptionFilter) {
    return rows;
  }

  return rows.filter((row) =>
    hasFuzzyDescriptionMatch(row.description, normalizedDescriptionFilter),
  );
}

function getRowsWithCompletedAtEnd(
  rows: MonthlyExpensesEditableRow[],
): MonthlyExpensesEditableRow[] {
  const pendingRows: MonthlyExpensesEditableRow[] = [];
  const completedRows: MonthlyExpensesEditableRow[] = [];

  for (const row of rows) {
    if (isPaymentCompleted(row)) {
      completedRows.push(row);
      continue;
    }

    pendingRows.push(row);
  }

  return pendingRows.concat(completedRows);
}

function getExcludeFilterMetrics(
  rows: MonthlyExpensesEditableRow[],
  excludedDescriptionFilters: string[],
): {
  excludeFilterRowsCountByValue: Record<string, number>;
  excludeFilterUniqueRowsCount: number;
} {
  const excludeFilterRowsCountByValue: Record<string, number> = {};
  const excludedRowIds = new Set<string>();

  for (const excludedDescriptionFilter of excludedDescriptionFilters) {
    let excludedRowsCount = 0;

    for (const row of rows) {
      if (!hasExactDescriptionMatch(row.description, excludedDescriptionFilter)) {
        continue;
      }

      excludedRowsCount += 1;
      excludedRowIds.add(row.id);
    }

    excludeFilterRowsCountByValue[excludedDescriptionFilter] = excludedRowsCount;
  }

  return {
    excludeFilterRowsCountByValue,
    excludeFilterUniqueRowsCount: excludedRowIds.size,
  };
}

function formatArsWithUsdSecondary({
  exchangeRateSnapshot,
  rowCurrency,
  value,
}: {
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rowCurrency: MonthlyExpenseCurrency;
  value: string;
}) {
  if (rowCurrency === "ARS") {
    return formatCurrencyAmount("ARS", value);
  }

  const arsAmount = getConvertedAmountForCurrency({
    currency: "ARS",
    exchangeRateSnapshot,
    rowCurrency,
    total: Number(value),
  });

  return (
    <span className={styles.convertedCurrencyValue}>
      <span>{formatConvertedAmount("ARS", arsAmount)}</span>
      <span className={styles.convertedCurrencySecondaryValue}>
        ({formatCurrencyAmount("USD", value)})
      </span>
    </span>
  );
}

function getValidHttpUrl(value: string): string | null {
  return getValidPaymentLinkUrl(value);
}

function isBrokenDriveStatus(
  status: MonthlyExpenseDriveResourceStatus | undefined,
): boolean {
  return status === "trashed" || status === "missing";
}

/**
 * Clase de fila para gastos completados. Se define a nivel de módulo (referencia
 * estable) para no recrearla en cada render: una función inline invalidaría la
 * memo del cuerpo de la tabla en `DataTable` y forzaría un re-render completo de
 * todas las filas en cada tecla, aunque las filas no hayan cambiado.
 */
function getMonthlyExpenseRowClassName(
  row: MonthlyExpensesEditableRow,
): string | undefined {
  return isPaymentCompleted(row) ? styles.paidRow : undefined;
}

export function MonthlyExpensesTable({
  actionDisabled,
  changedFields,
  draft,
  exchangeRateLoadError,
  exchangeRateSnapshot,
  expenseFolders,
  folderFilterId,
  feedbackMessage,
  feedbackErrorCode = null,
  feedbackTone,
  isCopyFromDisabled,
  isExpenseSheetOpen,
  isMonthTransitionPending,
  isSubmitting,
  lenders,
  loadError,
  loadErrorCode = null,
  month,
  pendingMonth,
  onAddExpense,
  onAddLender,
  onExpenseFolderSelect,
  onFolderFilterChange,
  onManageFolders,
  onMoveExpenseToFolder,
  onReorderFolders,
  onCopyFromMonth,
  onCopyFromMonthDialogOpenChange,
  onConfirmCopyFromMonth,
  onToggleAllReplicableOptions,
  onToggleReplicableOption,
  onDeleteAllReceiptsFolderReference,
  onCancelRecurrence,
  onReactivateRecurrence,
  onDeleteExpense,
  onDeleteExpenses,
  onDeleteExpenseReceiptShare,
  onDeletePaymentLink,
  onDeleteMonthlyFolderReference,
  onEditExpense,
  onExpenseFieldChange,
  onExpenseLenderSelect,
  onExpenseLoanToggle,
  onExpenseRecurringToggle,
  onExpenseReceiptShareToggle,
  onDeleteReceipt,
  onEditReceiptCoverage,
  onRegisterPaymentRecord,
  onDeleteManualPaymentRecord,
  onEditManualPaymentRecord,
  onUpdatePaymentLink,
  onUpdateExpenseDetails,
  onUpdateExpenseReceiptShare,
  onUpdatePaymentRecordSendStatus,
  onMonthChange,
  onRequestCloseExpenseSheet,
  onSaveExpense,
  onSaveUnsavedChanges,
  onUnsavedChangesClose,
  onUnsavedChangesDiscard,
  replicateFromPreviousMonthDialogOpen,
  replicateFromPreviousMonthOptions,
  selectedReplicableOptionIds,
  rows,
  sheetMode,
  showCopyFromControls,
  showUnsavedChangesDialog,
  validationMessage,
}: MonthlyExpensesTableProps) {
  const hasSkippedInitialPersistence = useRef(false);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [isTableHorizontallyScrolled, setIsTableHorizontallyScrolled] =
    useState(false);
  const [loanSortMode, setLoanSortMode] =
    useState<LoanSortMode>(DEFAULT_LOAN_SORT_MODE);
  const [vigenciaSortMode, setVigenciaSortMode] = useState<VigenciaSortMode>(
    DEFAULT_VIGENCIA_SORT_MODE,
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY,
  );
  const [moveCompletedToEnd, setMoveCompletedToEnd] = useState(false);
  const [isRestoringTablePreferences, setIsRestoringTablePreferences] =
    useState(true);
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [excludedDescriptionFilters, setExcludedDescriptionFilters] = useState<
    string[]
  >([]);
  const [queryAppliedFilters, setQueryAppliedFilters] = useState<AppliedFilter[]>(
    [],
  );
  const monthlyExpensesFilterQualifiers = useMemo(
    () => buildMonthlyExpensesFilterQualifiers({ expenseFolders }),
    [expenseFolders],
  );
  const [paymentLinkDialogState, setPaymentLinkDialogState] =
    useState<PaymentLinkDialogState | null>(null);
  const [paymentLinkDraftValue, setPaymentLinkDraftValue] = useState("");
  const [paymentLinkDraftError, setPaymentLinkDraftError] =
    useState<string | null>(null);
  const [detailsDialogState, setDetailsDialogState] =
    useState<ExpenseDetailsDialogState | null>(null);
  const [subtotalDraftValue, setSubtotalDraftValue] = useState("");
  const [subtotalDraftError, setSubtotalDraftError] = useState<string | null>(null);
  const [subtotalUnitDraftValue, setSubtotalUnitDraftValue] =
    useState<MonthlyExpenseSubtotalUnit>("occurrence");
  const [occurrencesDraftValue, setOccurrencesDraftValue] = useState("");
  const [occurrencesUnitDraftValue, setOccurrencesUnitDraftValue] = useState("");
  const [occurrencesDraftError, setOccurrencesDraftError] =
    useState<string | null>(null);
  const [occurrencesUnitDraftError, setOccurrencesUnitDraftError] =
    useState<string | null>(null);
  const [receiptShareDialogState, setReceiptShareDialogState] =
    useState<ExpenseReceiptShareDialogState | null>(null);
  const [receiptSharePhoneDraftValue, setReceiptSharePhoneDraftValue] = useState("");
  const [receiptShareMessageDraftValue, setReceiptShareMessageDraftValue] = useState("");
  const [receiptShareDraftError, setReceiptShareDraftError] =
    useState<string | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [visibleExpenseIds, setVisibleExpenseIds] = useState<Set<string> | null>(
    null,
  );
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkActionsMenuOpen, setIsBulkActionsMenuOpen] = useState(false);
  const handleDialogInputAutoFocus = useCallback(
    (event: Event, inputId: string) => {
      event.preventDefault();

      window.requestAnimationFrame(() => {
        const inputElement = document.getElementById(inputId);

        if (
          inputElement instanceof HTMLInputElement ||
          inputElement instanceof HTMLTextAreaElement
        ) {
          inputElement.focus();

          if (inputElement instanceof HTMLTextAreaElement) {
            const selectionPosition = inputElement.value.length;
            inputElement.setSelectionRange(selectionPosition, selectionPosition);
          }
        }
      });
    },
    [],
  );
  const focusDialogInputById = useCallback((inputId: string) => {
    const focusTimeoutId = window.setTimeout(() => {
      const inputElement = document.getElementById(inputId);

      if (
        inputElement instanceof HTMLInputElement ||
        inputElement instanceof HTMLTextAreaElement
      ) {
        inputElement.focus();

        if (inputElement instanceof HTMLTextAreaElement) {
          const selectionPosition = inputElement.value.length;
          inputElement.setSelectionRange(selectionPosition, selectionPosition);
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(focusTimeoutId);
    };
  }, []);

  useEffect(() => {
    const wrapper = tableWrapperRef.current;

    if (!wrapper) {
      return;
    }

    const scrollContainer = wrapper.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    );

    if (!scrollContainer) {
      return;
    }

    const updateHorizontalScrollState = () => {
      setIsTableHorizontallyScrolled(scrollContainer.scrollLeft > 0);
    };

    updateHorizontalScrollState();
    scrollContainer.addEventListener("scroll", updateHorizontalScrollState, {
      passive: true,
    });

    const resizeObserver = new ResizeObserver(updateHorizontalScrollState);
    resizeObserver.observe(scrollContainer);

    const tableElement = scrollContainer.querySelector("table");

    if (tableElement) {
      resizeObserver.observe(tableElement);
    }

    return () => {
      scrollContainer.removeEventListener(
        "scroll",
        updateHorizontalScrollState,
      );
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!detailsDialogState) {
      return;
    }

    return focusDialogInputById("subtotal-dialog-input");
  }, [focusDialogInputById, detailsDialogState]);

  useEffect(() => {
    if (!receiptShareDialogState) {
      return;
    }

    return focusDialogInputById("receipt-share-phone-dialog-input");
  }, [focusDialogInputById, receiptShareDialogState]);

  useEffect(() => {
    if (!paymentLinkDialogState) {
      return;
    }

    return focusDialogInputById("payment-link-dialog-input");
  }, [focusDialogInputById, paymentLinkDialogState]);

  useEffect(() => {
    const persistedPreferences = getPersistedMonthlyExpensesTablePreferences();

    const restoreFrameId = window.requestAnimationFrame(() => {
      if (persistedPreferences) {
        setLoanSortMode(persistedPreferences.loanSortMode);
        setVigenciaSortMode(persistedPreferences.vigenciaSortMode);
        setMoveCompletedToEnd(persistedPreferences.moveCompletedToEnd);
        setSorting(persistedPreferences.sorting);
        setColumnVisibility(persistedPreferences.columnVisibility);
      }

      setIsRestoringTablePreferences(false);
    });

    return () => {
      window.cancelAnimationFrame(restoreFrameId);
    };
  }, []);

  useEffect(() => {
    if (!hasSkippedInitialPersistence.current) {
      hasSkippedInitialPersistence.current = true;
      return;
    }

    persistMonthlyExpensesTablePreferences({
      columnVisibility,
      loanSortMode,
      moveCompletedToEnd,
      sorting,
      vigenciaSortMode,
    });
  }, [columnVisibility, loanSortMode, moveCompletedToEnd, sorting, vigenciaSortMode]);

  const getSortDirection = useCallback(
    (columnId: string) => getColumnSortDirection(sorting, columnId),
    [sorting],
  );
  const loanInstallmentRangeSortDirection = getColumnSortDirection(
    sorting,
    LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  );
  const nonEmptyExcludedDescriptionFilters = useMemo(
    () => getNonEmptyDescriptionFilters(excludedDescriptionFilters),
    [excludedDescriptionFilters],
  );
  const primaryDescriptionFilter = useMemo(
    () => getPrimaryDescriptionFilter(descriptionFilter),
    [descriptionFilter],
  );
  const rowsMatchingDescriptionFilter = useMemo(
    () => getRowsMatchingDescriptionFilter(rows, primaryDescriptionFilter),
    [primaryDescriptionFilter, rows],
  );
  const excludeFilterMetrics = useMemo(
    () =>
      getExcludeFilterMetrics(
        rowsMatchingDescriptionFilter,
        nonEmptyExcludedDescriptionFilters,
      ),
    [nonEmptyExcludedDescriptionFilters, rowsMatchingDescriptionFilter],
  );
  const hasActiveDescriptionFiltering =
    primaryDescriptionFilter.trim().length > 0 ||
    nonEmptyExcludedDescriptionFilters.length > 0;
  const rowsExcludingDescriptions = useMemo(
    () =>
      rows.filter(
        (row) =>
          !includesExcludedDescription(
            row.description,
            nonEmptyExcludedDescriptionFilters,
          ),
      ),
    [nonEmptyExcludedDescriptionFilters, rows],
  );
  // Qualifiers que NO usan el path de columnas de TanStack (sin columna) o que
  // están negados se aplican con el predicado de dominio, desacoplado de las
  // columnas. Los respaldados por columna y no negados los filtra TanStack.
  const queryPredicateFilters = useMemo(
    () =>
      queryAppliedFilters.filter(
        (appliedFilter) =>
          appliedFilter.negated ||
          !COLUMN_BACKED_QUALIFIER_KEYS.has(appliedFilter.key),
      ),
    [queryAppliedFilters],
  );
  const rowsMatchingQueryPredicate = useMemo(() => {
    if (queryPredicateFilters.length === 0) {
      return rowsExcludingDescriptions;
    }

    const matchesQuery = buildMonthlyExpensesQueryPredicate(
      queryPredicateFilters,
      { exchangeRateSnapshot, vigenciaSortMode },
    );

    return rowsExcludingDescriptions.filter(matchesQuery);
  }, [
    exchangeRateSnapshot,
    queryPredicateFilters,
    rowsExcludingDescriptions,
    vigenciaSortMode,
  ]);
  const hasManualSorting = sorting.length > 0;
  const rowsMatchingFolderFilter = useMemo(() => {
    if (!folderFilterId) {
      return rowsMatchingQueryPredicate;
    }

    if (folderFilterId === UNASSIGNED_EXPENSE_FOLDER_FILTER_ID) {
      return rowsMatchingQueryPredicate.filter((row) => !row.expenseFolderId);
    }

    return rowsMatchingQueryPredicate.filter(
      (row) => row.expenseFolderId === folderFilterId,
    );
  }, [folderFilterId, rowsMatchingQueryPredicate]);
  const rowsForTable = useMemo(() => {
    if (!moveCompletedToEnd || hasManualSorting) {
      return rowsMatchingFolderFilter;
    }

    return getRowsWithCompletedAtEnd(rowsMatchingFolderFilter);
  }, [hasManualSorting, moveCompletedToEnd, rowsMatchingFolderFilter]);
  const selectedExpenseIdsInCurrentRows = useMemo(() => {
    const availableExpenseIds = new Set(rows.map((row) => row.id));

    return new Set(
      Array.from(selectedExpenseIds).filter((expenseId) =>
        availableExpenseIds.has(expenseId),
      ),
    );
  }, [rows, selectedExpenseIds]);
  const effectiveVisibleExpenseIds = useMemo(() => {
    if (visibleExpenseIds !== null) {
      return visibleExpenseIds;
    }

    return new Set(rowsForTable.map((row) => row.id));
  }, [rowsForTable, visibleExpenseIds]);
  const selectedVisibleExpenseIds = useMemo(
    () =>
      Array.from(selectedExpenseIdsInCurrentRows).filter((expenseId) =>
        effectiveVisibleExpenseIds.has(expenseId),
      ),
    [effectiveVisibleExpenseIds, selectedExpenseIdsInCurrentRows],
  );
  const selectedVisibleCount = selectedVisibleExpenseIds.length;
  const hasVisibleRows = effectiveVisibleExpenseIds.size > 0;
  const areAllVisibleRowsSelected =
    hasVisibleRows && selectedVisibleCount === effectiveVisibleExpenseIds.size;
  const areSomeVisibleRowsSelected =
    selectedVisibleCount > 0 && !areAllVisibleRowsSelected;
  const handleVisibleRowsChange = useCallback((visibleRows: MonthlyExpensesEditableRow[]) => {
    const nextVisibleExpenseIds = new Set(visibleRows.map((row) => row.id));

    setVisibleExpenseIds((previousVisibleExpenseIds) =>
      previousVisibleExpenseIds !== null &&
      areSetsEqual(previousVisibleExpenseIds, nextVisibleExpenseIds)
        ? previousVisibleExpenseIds
        : nextVisibleExpenseIds,
    );
  }, []);
  const handleToggleExpenseSelection = useCallback((expenseId: string, checked: boolean) => {
    setSelectedExpenseIds((previousSelectedExpenseIds) => {
      const nextSelectedExpenseIds = new Set(previousSelectedExpenseIds);

      if (checked) {
        nextSelectedExpenseIds.add(expenseId);
      } else {
        nextSelectedExpenseIds.delete(expenseId);
      }

      return nextSelectedExpenseIds;
    });
  }, []);
  const handleToggleAllVisibleRowsSelection = useCallback(() => {
    setSelectedExpenseIds((previousSelectedExpenseIds) => {
      const nextSelectedExpenseIds = new Set(previousSelectedExpenseIds);

      if (areAllVisibleRowsSelected) {
        for (const visibleExpenseId of effectiveVisibleExpenseIds) {
          nextSelectedExpenseIds.delete(visibleExpenseId);
        }
      } else {
        for (const visibleExpenseId of effectiveVisibleExpenseIds) {
          nextSelectedExpenseIds.add(visibleExpenseId);
        }
      }

      return nextSelectedExpenseIds;
    });
  }, [
    areAllVisibleRowsSelected,
    effectiveVisibleExpenseIds,
  ]);
  const handleTableCellClick = useCallback(
    (
      event: React.MouseEvent<HTMLTableCellElement>,
      row: MonthlyExpensesEditableRow,
      columnId: string,
    ) => {
      if (event.defaultPrevented) {
        return;
      }

      if (columnId !== BULK_SELECTION_COLUMN_ID) {
        return;
      }

      handleToggleExpenseSelection(
        row.id,
        !selectedExpenseIdsInCurrentRows.has(row.id),
      );
    },
    [handleToggleExpenseSelection, selectedExpenseIdsInCurrentRows],
  );
  const isBulkActionsDisabled =
    selectedVisibleCount === 0 || actionDisabled || isSubmitting;
  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedVisibleExpenseIds.length === 0) {
      setIsBulkDeleteDialogOpen(false);
      return;
    }

    const wasSaved = await onDeleteExpenses(selectedVisibleExpenseIds);

    if (!wasSaved) {
      return;
    }

    setSelectedExpenseIds((previousSelectedExpenseIds) => {
      const nextSelectedExpenseIds = new Set(previousSelectedExpenseIds);

      for (const selectedVisibleExpenseId of selectedVisibleExpenseIds) {
        nextSelectedExpenseIds.delete(selectedVisibleExpenseId);
      }

      return nextSelectedExpenseIds;
    });
    setIsBulkDeleteDialogOpen(false);
  }, [onDeleteExpenses, selectedVisibleExpenseIds]);
  const completedPendingReceiptShareCount = useMemo(() => {
    let pendingCount = 0;

    for (const row of rows) {
      if (!isPaymentCompleted(row)) {
        continue;
      }

      const normalizedStatus = getNormalizedReceiptShareStatus(row);

      if (!normalizedStatus) {
        continue;
      }

      if (normalizedStatus === "pending") {
        pendingCount += 1;
      }
    }

    return pendingCount;
  }, [rows]);
  const completedPendingReceiptShareExpenses = useMemo(() => {
    const pendingExpenses: Array<{
      displayDescription: string;
      expenseId: string;
      rawDescription: string;
    }> = [];

    for (const row of rows) {
      if (!isPaymentCompleted(row)) {
        continue;
      }

      const normalizedStatus = getNormalizedReceiptShareStatus(row);

      if (normalizedStatus !== "pending") {
        continue;
      }

      pendingExpenses.push({
        displayDescription: row.description.trim() || "Compromiso sin descripción",
        expenseId: row.id,
        rawDescription: row.description,
      });
    }

    return pendingExpenses;
  }, [rows]);
  const completedPendingReceiptShareMessage = useMemo(() => {
    const hasSinglePendingReceipt = completedPendingReceiptShareCount === 1;
    const completedLabel = hasSinglePendingReceipt ? "completo" : "completos";

    return `${completedPendingReceiptShareCount} pago${hasSinglePendingReceipt ? "" : "s"} ${completedLabel} con comprobante${hasSinglePendingReceipt ? "" : "s"} pendiente${hasSinglePendingReceipt ? "" : "s"} de envío:`;
  }, [completedPendingReceiptShareCount]);

  const handleOpenPaymentLinkDialog = useCallback(({
    expenseDescription,
    expenseId,
    mode,
    paymentLink,
  }: {
    expenseDescription: string;
    expenseId: string;
    mode: "create" | "edit";
    paymentLink: string;
  }) => {
    setPaymentLinkDialogState({
      expenseDescription,
      expenseId,
      mode,
    });
    setPaymentLinkDraftValue(paymentLink);
    setPaymentLinkDraftError(null);
  }, []);

  const handleClosePaymentLinkDialog = () => {
    setPaymentLinkDialogState(null);
    setPaymentLinkDraftValue("");
    setPaymentLinkDraftError(null);
  };

  const handleSavePaymentLink = async () => {
    if (!paymentLinkDialogState) {
      return;
    }

    const normalizedPaymentLink = getValidPaymentLinkUrl(paymentLinkDraftValue);

    if (!normalizedPaymentLink) {
      setPaymentLinkDraftError(PAYMENT_LINK_VALIDATION_ERROR_MESSAGE);
      return;
    }

    setPaymentLinkDraftError(null);
    await onUpdatePaymentLink({
      expenseId: paymentLinkDialogState.expenseId,
      paymentLink: normalizedPaymentLink,
    });
    handleClosePaymentLinkDialog();
  };

  const handleOpenDetailsDialog = useCallback(({
    currency,
    expenseDescription,
    expenseId,
    occurrencesPerMonth,
    occurrencesUnit,
    subtotal,
    subtotalUnit,
  }: {
    currency: MonthlyExpenseCurrency;
    expenseDescription: string;
    expenseId: string;
    occurrencesPerMonth: string;
    occurrencesUnit: string;
    subtotal: string;
    subtotalUnit: MonthlyExpenseSubtotalUnit;
  }) => {
    setDetailsDialogState({
      currency,
      expenseDescription,
      expenseId,
    });
    setSubtotalDraftValue(subtotal);
    setSubtotalDraftError(null);
    setSubtotalUnitDraftValue(subtotalUnit);
    setOccurrencesDraftValue(occurrencesPerMonth);
    setOccurrencesUnitDraftValue(occurrencesUnit);
    setOccurrencesDraftError(null);
    setOccurrencesUnitDraftError(null);
  }, []);

  const handleCloseDetailsDialog = () => {
    setDetailsDialogState(null);
    setSubtotalDraftValue("");
    setSubtotalDraftError(null);
    setSubtotalUnitDraftValue("occurrence");
    setOccurrencesDraftValue("");
    setOccurrencesUnitDraftValue("");
    setOccurrencesDraftError(null);
    setOccurrencesUnitDraftError(null);
  };

  const handleSaveDetails = async () => {
    if (!detailsDialogState) {
      return;
    }

    const normalizedSubtotal = Number(subtotalDraftValue);
    const subtotalValidationError = validateSubtotalAmount(normalizedSubtotal);

    if (subtotalValidationError) {
      setSubtotalDraftError(subtotalValidationError);
      return;
    }

    setSubtotalDraftError(null);

    const isHourlySubtotal = subtotalUnitDraftValue === "hour";
    // Hourly subtotals are billed once per month and multiplied by the monthly
    // duration, so the occurrence count is fixed at 1 and the editable quantity
    // becomes the duration instead.
    const normalizedOccurrences = isHourlySubtotal
      ? 1
      : Number(occurrencesDraftValue);

    if (!isHourlySubtotal) {
      const occurrencesValidationError =
        validateOccurrencesPerMonth(normalizedOccurrences);

      if (occurrencesValidationError) {
        setOccurrencesDraftError(occurrencesValidationError);
        return;
      }
    }

    const occurrencesUnitForSave = occurrencesUnitDraftValue.trim();
    const occurrencesUnitValidationError =
      validateOccurrencesUnit(occurrencesUnitForSave) ??
      (isHourlySubtotal ? validateHourDuration(occurrencesUnitForSave) : null);

    if (occurrencesUnitValidationError) {
      setOccurrencesUnitDraftError(occurrencesUnitValidationError);
      return;
    }

    setOccurrencesDraftError(null);
    setOccurrencesUnitDraftError(null);
    await onUpdateExpenseDetails({
      expenseId: detailsDialogState.expenseId,
      occurrencesPerMonth: normalizedOccurrences,
      occurrencesUnit: occurrencesUnitForSave,
      subtotal: normalizedSubtotal,
      subtotalUnit: subtotalUnitDraftValue,
    });
    handleCloseDetailsDialog();
  };

  const handleOpenReceiptShareDialog = useCallback(({
    expenseDescription,
    expenseId,
    mode,
    receiptShareMessage,
    receiptSharePhoneDigits,
  }: {
    expenseDescription: string;
    expenseId: string;
    mode: "create" | "edit";
    receiptShareMessage: string;
    receiptSharePhoneDigits: string;
  }) => {
    setReceiptShareDialogState({
      expenseDescription,
      expenseId,
      mode,
    });
    setReceiptSharePhoneDraftValue(receiptSharePhoneDigits);
    setReceiptShareMessageDraftValue(receiptShareMessage);
    setReceiptShareDraftError(null);
  }, []);

  const handleCloseReceiptShareDialog = () => {
    setReceiptShareDialogState(null);
    setReceiptSharePhoneDraftValue("");
    setReceiptShareMessageDraftValue("");
    setReceiptShareDraftError(null);
  };

  const handleSaveReceiptShare = async () => {
    if (!receiptShareDialogState) {
      return;
    }

    const normalizedPhoneDigits = normalizeReceiptSharePhoneDigits(
      receiptSharePhoneDraftValue,
    );

    if (!normalizedPhoneDigits) {
      setReceiptShareDraftError(RECEIPT_SHARE_PHONE_REQUIRED_ERROR_MESSAGE);
      return;
    }

    const receiptSharePhoneValidationError =
      validateReceiptSharePhoneDigits(normalizedPhoneDigits);

    if (receiptSharePhoneValidationError) {
      setReceiptShareDraftError(receiptSharePhoneValidationError);
      return;
    }

    setReceiptShareDraftError(null);
    await onUpdateExpenseReceiptShare({
      expenseId: receiptShareDialogState.expenseId,
      receiptShareMessage: receiptShareMessageDraftValue,
      receiptSharePhoneDigits: normalizedPhoneDigits,
    });
    handleCloseReceiptShareDialog();
  };

  // El comparador de relevancia lee el filtro vigente desde una ref para
  // mantener una identidad estable entre renders. Si dependiera de
  // `primaryDescriptionFilter` directamente, cambiaría en cada tecla y obligaría
  // a reconstruir todo el array de `columns` (y con él, el row model de TanStack
  // y todas las filas), duplicando el costo de cada pulsación.
  const primaryDescriptionFilterRef = useRef(primaryDescriptionFilter);
  useEffect(() => {
    primaryDescriptionFilterRef.current = primaryDescriptionFilter;
  }, [primaryDescriptionFilter]);
  const compareRowsByDescriptionFilterRelevance = useCallback(
    (
      leftRow: MonthlyExpensesEditableRow,
      rightRow: MonthlyExpensesEditableRow,
    ): number => {
      const normalizedFilterValue = primaryDescriptionFilterRef.current.trim();

      if (!normalizedFilterValue) {
        return 0;
      }

      const normalizedFilterToken = normalizeSearchValue(normalizedFilterValue);
      const normalizedPrefixToken = normalizedFilterToken.slice(
        0,
        Math.min(2, normalizedFilterToken.length),
      );
      const normalizedLeftDescription = normalizeSearchValue(leftRow.description);
      const normalizedRightDescription = normalizeSearchValue(rightRow.description);
      const leftHasPrefixMatch =
        normalizedPrefixToken.length > 0 &&
        normalizedLeftDescription.startsWith(normalizedPrefixToken);
      const rightHasPrefixMatch =
        normalizedPrefixToken.length > 0 &&
        normalizedRightDescription.startsWith(normalizedPrefixToken);

      const leftRank = getFuzzyMatchRank(
        leftRow.description,
        normalizedFilterValue,
      );
      const rightRank = getFuzzyMatchRank(
        rightRow.description,
        normalizedFilterValue,
      );

      if (!leftRank && !rightRank) {
        return 0;
      }

      if (!leftRank) {
        return 1;
      }

      if (!rightRank) {
        return -1;
      }

      if (leftHasPrefixMatch !== rightHasPrefixMatch) {
        return leftHasPrefixMatch ? -1 : 1;
      }

      if (leftRank.span !== rightRank.span) {
        return leftRank.span - rightRank.span;
      }

      if (leftRank.gapCount !== rightRank.gapCount) {
        return leftRank.gapCount - rightRank.gapCount;
      }

      if (leftRank.maxGap !== rightRank.maxGap) {
        return leftRank.maxGap - rightRank.maxGap;
      }

      if (leftRank.startIndex !== rightRank.startIndex) {
        return leftRank.startIndex - rightRank.startIndex;
      }

      if (leftRank.longestRun !== rightRank.longestRun) {
        return rightRank.longestRun - leftRank.longestRun;
      }

      return 0;
    },
    [],
  );

  const foldersById = useMemo(() => {
    const folderMap = new Map<string, ExpenseFolderOption>();

    for (const folder of expenseFolders) {
      folderMap.set(folder.id, folder);
    }

    return folderMap;
  }, [expenseFolders]);
  const folderCounts = useMemo(() => {
    const countsByFolderId: Record<string, number> = {};
    let unassignedCount = 0;

    for (const row of rows) {
      if (row.expenseFolderId && foldersById.has(row.expenseFolderId)) {
        countsByFolderId[row.expenseFolderId] =
          (countsByFolderId[row.expenseFolderId] ?? 0) + 1;
        continue;
      }

      unassignedCount += 1;
    }

    return { countsByFolderId, totalCount: rows.length, unassignedCount };
  }, [foldersById, rows]);

  const columns = useMemo<ColumnDef<MonthlyExpensesEditableRow>[]>(
    () => [
      {
        id: BULK_SELECTION_COLUMN_ID,
        cell: ({ row }) => {
          const expenseDescription =
            row.original.description.trim() || "compromiso sin descripción";
          const checkboxId = `bulk-selection-row-${row.original.id}`;

          return (
            <div className={styles.selectionCell}>
              <input
                aria-label={`Seleccionar compromiso ${expenseDescription}`}
                checked={selectedExpenseIdsInCurrentRows.has(row.original.id)}
                className={styles.selectionCheckbox}
                id={checkboxId}
                onChange={(event) =>
                  handleToggleExpenseSelection(row.original.id, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
                type="checkbox"
              />
            </div>
          );
        },
        enableHiding: false,
        enableSorting: false,
        header: () => (
          <div className={styles.selectionCell}>
            <input
              aria-label="Seleccionar todas las filas visibles"
              checked={areAllVisibleRowsSelected}
              className={styles.selectionCheckbox}
              onChange={() => undefined}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleAllVisibleRowsSelection();
              }}
              ref={(element) => {
                if (!element) {
                  return;
                }

                element.indeterminate = areSomeVisibleRowsSelected;
              }}
              type="checkbox"
            />
          </div>
        ),
        meta: {
          cellClassName: styles.selectionTableCell,
          headerClassName: styles.selectionTableCell,
          isClickable: true,
          label: "Selección",
          onHeaderClick: (event: React.MouseEvent<HTMLTableCellElement>) => {
            event.stopPropagation();
            handleToggleAllVisibleRowsSelection();
          },
        },
      },
      {
        accessorKey: "description",
        cell: ({ row, table }) => {
          const description = row.original.description;
          const folder =
            row.original.expenseFolderId &&
            foldersById.has(row.original.expenseFolderId)
              ? foldersById.get(row.original.expenseFolderId) ?? null
              : null;
          const folderBadge =
            expenseFolders.length > 0 ? (
              <ExpenseFolderRowBadge
                expenseId={row.original.id}
                folder={folder}
                folders={expenseFolders}
                onSelectFolder={(folderId) =>
                  onMoveExpenseToFolder({
                    expenseId: row.original.id,
                    folderId,
                  })
                }
              />
            ) : null;
          const filterValue = String(
            table.getColumn("description")?.getFilterValue() ?? "",
          );
          const matchIndices = description
            ? getFuzzyMatchIndices(description, filterValue)
            : null;
          const descriptionContent = !description
            ? "Sin descripción"
            : matchIndices && matchIndices.length > 0
            ? renderHighlightedText(
                description,
                matchIndices,
                styles.descriptionHighlight,
                "description",
              )
            : description;

          const paymentLinkUrl = getValidPaymentLinkUrl(row.original.paymentLink);
          const expenseDescriptionLabel =
            row.original.description.trim() || "compromiso";
          const monthlyFolderViewUrl = getValidHttpUrl(
            row.original.monthlyFolderViewUrl,
          );
          const allReceiptsFolderViewUrl = getValidHttpUrl(
            row.original.allReceiptsFolderViewUrl,
          );
          const canDeleteMonthlyFolderReference = isBrokenDriveStatus(
            row.original.monthlyFolderStatus,
          );
          const canDeleteAllReceiptsFolderReference = isBrokenDriveStatus(
            row.original.allReceiptsFolderStatus,
          );
          const hasPaymentLink = paymentLinkUrl != null;
          const rowActions = (
            <ExpenseRowActions
              actionDisabled={actionDisabled}
              allReceiptsFolderViewUrl={allReceiptsFolderViewUrl}
              canDeleteAllReceiptsFolderReference={
                canDeleteAllReceiptsFolderReference
              }
              canDeleteMonthlyFolderReference={canDeleteMonthlyFolderReference}
              description={row.original.description}
              hasPaymentLink={hasPaymentLink}
              isRecurring={row.original.isRecurring}
              isRecurrenceCancelled={Boolean(row.original.recurrenceEndMonth)}
              monthlyFolderViewUrl={monthlyFolderViewUrl}
              onCancelRecurrence={() => onCancelRecurrence(row.original.id)}
              onDelete={() => onDeleteExpense(row.original.id)}
              onDeleteAllReceiptsFolderReference={() =>
                onDeleteAllReceiptsFolderReference(row.original.id)}
              onDeleteMonthlyFolderReference={() =>
                onDeleteMonthlyFolderReference(row.original.id)}
              onDeletePaymentLink={() => onDeletePaymentLink(row.original.id)}
              onEdit={() => onEditExpense(row.original.id)}
              onReactivateRecurrence={() =>
                onReactivateRecurrence(row.original.id)}
              onManagePaymentLink={() =>
                handleOpenPaymentLinkDialog({
                  expenseDescription: expenseDescriptionLabel,
                  expenseId: row.original.id,
                  mode: hasPaymentLink ? "edit" : "create",
                  paymentLink: row.original.paymentLink,
                })}
            />
          );
          const paymentLinkAnchor = paymentLinkUrl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  asChild
                  className={styles.descriptionPaymentLinkChip}
                  variant="outline"
                >
                  <a
                    aria-label={`Abrir link de pago de ${expenseDescriptionLabel}`}
                    href={paymentLinkUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Link2 aria-hidden="true" />
                    Link
                  </a>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Abrir página de pago</TooltipContent>
            </Tooltip>
          ) : null;

          const isDescriptionTruncated =
            description.length > DESCRIPTION_TRUNCATE_CHAR_LIMIT;
          const descriptionTextNode = isDescriptionTruncated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={styles.descriptionTruncated}>
                  {descriptionContent}
                </span>
              </TooltipTrigger>
              <TooltipContent>{description}</TooltipContent>
            </Tooltip>
          ) : (
            descriptionContent
          );

          const descriptionTextContent = paymentLinkAnchor ? (
            <span className={styles.descriptionTextRow}>
              {descriptionTextNode}
              {paymentLinkAnchor}
            </span>
          ) : (
            descriptionTextNode
          );

          const expenseInformation = folderBadge ? (
            <span className={styles.descriptionInfo}>
              {descriptionTextContent}
              {folderBadge}
            </span>
          ) : (
            descriptionTextContent
          );

          return (
            <>
              {expenseInformation}
              <div className={styles.descriptionActions}>{rowActions}</div>
            </>
          );
        },
        enableHiding: false,
        filterFn: (row, columnId, filterValue) => {
          const description = String(row.getValue(columnId) ?? "");
          const query = String(filterValue ?? "");
          const matchesDescriptionFilter = hasFuzzyDescriptionMatch(
            description,
            query,
          );

          if (!matchesDescriptionFilter) {
            return false;
          }
          return true;
        },
        header: getSortableHeader("Descripción"),
        meta: {
          cellClassName: styles.stickyDescriptionCell,
          label: "Descripción",
        },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          return compareValuesKeepingInvalidLast({
            compareValidValues: (leftValue, rightValue) =>
              leftValue.localeCompare(rightValue, "es", {
                sensitivity: "base",
              }),
            leftValue: rowA.original.description,
            rightValue: rowB.original.description,
            sortDirection: getSortDirection("description"),
          });
        },
      },
      {
        accessorKey: "total",
        cell: ({ row }) => {
          const expenseDescription =
            row.original.description.trim() || "compromiso";
          const occurrencesPerMonth = Number(row.original.occurrencesPerMonth);
          const subtotalUnit = row.original.subtotalUnit ?? "occurrence";
          const hasSubtotalBreakdown =
            Number.isFinite(occurrencesPerMonth) &&
            (subtotalUnit === "hour" || occurrencesPerMonth !== 1);
          const formatRowArsAmount = (value: string) =>
            formatArsWithUsdSecondary({
              exchangeRateSnapshot,
              rowCurrency: row.original.currency,
              value,
            });

          return (
            <div className={styles.totalCell}>
              <div className={styles.totalSummary}>
                <span className={styles.totalAmount}>
                  {formatRowArsAmount(row.original.total)}
                </span>
                {hasSubtotalBreakdown ? (
                  <span className={styles.totalSubtotalBreakdown}>
                    <span className={styles.totalSubtotalAmount}>
                      {formatRowArsAmount(row.original.subtotal)}
                      {subtotalUnit === "hour" ? (
                        <span className={styles.subtotalRateSuffix}>/h</span>
                      ) : null}
                    </span>
                    <span className={styles.subtotalMultiplier}>
                      {formatSubtotalMultiplierLabel(
                        occurrencesPerMonth,
                        row.original.occurrencesUnit,
                        subtotalUnit,
                      )}
                    </span>
                  </span>
                ) : null}
              </div>
              <div className={styles.subtotalTrailing}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Abrir acciones de subtotal y cantidad para ${expenseDescription}`}
                      className={styles.paymentLinkActionButton}
                      disabled={actionDisabled}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <MoreVertical
                        aria-hidden="true"
                        className={styles.paymentLinkIcon}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        window.setTimeout(() => {
                          handleOpenDetailsDialog({
                            currency: row.original.currency,
                            expenseDescription,
                            expenseId: row.original.id,
                            occurrencesPerMonth:
                              row.original.occurrencesPerMonth,
                            occurrencesUnit: row.original.occurrencesUnit,
                            subtotal: row.original.subtotal,
                            subtotalUnit,
                          });
                        }, 0);
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      Editar subtotal y cantidad
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        },
        footer: ({ table }) => {
          const arsTotal = getConvertedTotalAmount({
            currency: "ARS",
            exchangeRateSnapshot,
            rows: table.getFilteredRowModel().rows.map((row) => row.original),
          });

          return (
            <span className={styles.totalFooterValue}>
              {formatConvertedAmount("ARS", arsTotal)}
            </span>
          );
        },
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedNumberRangeFilter(
            filterValue,
            getArsComparableAmount({
              exchangeRateSnapshot,
              rowCurrency: row.original.currency,
              value: row.original.total,
            }),
          ),
        header: getSortableHeader("Total"),
        meta: { label: "Total" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          return compareValuesKeepingInvalidLast({
            compareValidValues: (leftValue, rightValue) => leftValue - rightValue,
            leftValue: getArsComparableAmount({
              exchangeRateSnapshot,
              rowCurrency: rowA.original.currency,
              value: rowA.original.total,
            }),
            rightValue: getArsComparableAmount({
              exchangeRateSnapshot,
              rowCurrency: rowB.original.currency,
              value: rowB.original.total,
            }),
            sortDirection: getSortDirection("total"),
          });
        },
      },
      {
        accessorKey: "usd",
        cell: ({ row }) => {
          const total = Number(row.original.total);
          const usdAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: row.original.currency,
            total,
          });

          return formatConvertedAmount("USD", usdAmount);
        },
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedNumberRangeFilter(
            filterValue,
            getConvertedAmountForCurrency({
              currency: "USD",
              exchangeRateSnapshot,
              rowCurrency: row.original.currency,
              total: Number(row.original.total),
            }),
          ),
        footer: ({ table }) => {
          const usdTotal = getConvertedTotalAmount({
            currency: "USD",
            exchangeRateSnapshot,
            rows: table.getFilteredRowModel().rows.map((row) => row.original),
          });

          return (
            <span className={styles.totalFooterValue}>
              {formatConvertedAmount("USD", usdTotal)}
            </span>
          );
        },
        header: getSortableHeader("USD"),
        meta: { label: "USD" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          const leftAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: rowA.original.currency,
            total: Number(rowA.original.total),
          });
          const rightAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: rowB.original.currency,
            total: Number(rowB.original.total),
          });

          return compareValuesKeepingInvalidLast({
            compareValidValues: (leftValue, rightValue) => leftValue - rightValue,
            leftValue: leftAmount,
            rightValue: rightAmount,
            sortDirection: getSortDirection("usd"),
          });
        },
      },
      {
        id: "paymentsProgress",
        accessorFn: (row) => {
          const { coveredPayments, requiredPayments } = getPaymentProgress(row);

          return requiredPayments > 0 ? coveredPayments / requiredPayments : 0;
        },
        cell: ({ row }) => {
          const { coveredPayments, requiredPayments } = getPaymentProgress(
            row.original,
          );
          const normalizedCoveredPayments = Math.max(coveredPayments, 0);
          const isComplete = coveredPayments >= requiredPayments;
          const completionFraction =
            requiredPayments > 0
              ? normalizedCoveredPayments / requiredPayments
              : 0;

          return (
            <span
              className={cn(
                styles.paymentProgressPlain,
                isComplete
                  ? "text-green-700 dark:text-green-300"
                  : "text-yellow-700 dark:text-yellow-300",
              )}
            >
              <PaymentProgressRing fraction={completionFraction} />
              {normalizedCoveredPayments} / {requiredPayments}
            </span>
          );
        },
        filterFn: (row, _columnId, filterValue) => {
          const paymentProgress = getPaymentProgress(row.original);

          return matchesAdvancedNumberRangeFilter(
            filterValue,
            paymentProgress.coveredPayments,
          );
        },
        header: getSortableHeader("Pagos"),
        meta: { label: "Pagos" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          const leftProgress = getPaymentProgress(rowA.original);
          const rightProgress = getPaymentProgress(rowB.original);

          const leftIsDone =
            leftProgress.requiredPayments > 0 &&
            leftProgress.coveredPayments >= leftProgress.requiredPayments
              ? 1
              : 0;
          const rightIsDone =
            rightProgress.requiredPayments > 0 &&
            rightProgress.coveredPayments >= rightProgress.requiredPayments
              ? 1
              : 0;

          if (leftIsDone !== rightIsDone) {
            return leftIsDone - rightIsDone;
          }

          return leftProgress.coveredPayments - rightProgress.coveredPayments;
        },
      },
      {
        id: "paymentHistory",
        accessorFn: (row) => (row.paymentRecords ?? []).length,
        cell: ({ row }) => {
          const { coveredPayments, requiredPayments } = getPaymentProgress(
            row.original,
          );
          const maxManualCoveredPayments = Math.max(
            requiredPayments - coveredPayments,
            0,
          );
          const expenseDescription = row.original.description.trim() || "compromiso";

          return (
            <PaymentHistoryCell
              actionDisabled={actionDisabled}
              expenseDescription={expenseDescription}
              expenseId={row.original.id}
              maxPaymentsPerRecord={maxManualCoveredPayments}
              onRegisterPaymentRecord={onRegisterPaymentRecord}
              onDeleteManualPaymentRecord={onDeleteManualPaymentRecord}
              onDeleteReceipt={onDeleteReceipt}
              onDeleteExpenseReceiptShare={onDeleteExpenseReceiptShare}
              onEditManualPaymentRecord={onEditManualPaymentRecord}
              onEditReceiptCoverage={onEditReceiptCoverage}
              onOpenReceiptShareDialog={handleOpenReceiptShareDialog}
              onUpdatePaymentRecordSendStatus={onUpdatePaymentRecordSendStatus}
              paymentRecords={row.original.paymentRecords ?? []}
              receiptShareMessage={row.original.receiptShareMessage}
              receiptSharePhoneDigits={row.original.receiptSharePhoneDigits}
              requiresReceiptShare={row.original.requiresReceiptShare}
            />
          );
        },
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedNumberRangeFilter(
            filterValue,
            (row.original.paymentRecords ?? []).length,
          ),
        header: getSortableHeader("Registros"),
        meta: { label: "Registros" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          return (
            (rowA.original.paymentRecords ?? []).length -
            (rowB.original.paymentRecords ?? []).length
          );
        },
      },
      {
        accessorKey: "loanProgress",
        cell: ({ row }) => {
          if (!row.original.isLoan) {
            return <EmptyCellPlaceholder />;
          }

          if (!row.original.loanProgress) {
            return "Completá datos de la deuda";
          }

          const paidInstallments = row.original.loanPaidInstallments ?? 0;
          const totalInstallments = row.original.loanTotalInstallments ?? 0;
          const progressPercent =
            totalInstallments > 0
              ? Math.min(
                  100,
                  Math.round((paidInstallments / totalInstallments) * 100),
                )
              : 0;

          return (
            <div className={styles.loanProgressCell}>
              <span>{`${paidInstallments} de ${totalInstallments} cuotas`}</span>
              <div
                aria-hidden="true"
                className={styles.loanProgressBarTrack}
              >
                <div
                  className={styles.loanProgressBarFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className={styles.loanProgressRemaining}>
                {`${row.original.loanRemainingInstallments ?? 0} restantes`}
              </span>
            </div>
          );
        },
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedPresenceFilter(
            filterValue,
            row.original.isLoan && row.original.loanProgress.trim().length > 0,
          ),
        header: ({ column }) => (
          <SortModeColumnHeader
            column={column}
            label="Deuda / cuotas"
            onApplySort={({ direction, mode }) => {
              setLoanSortMode(mode);
              setSorting(buildLoanSortingState(direction));
            }}
            optionIdPrefix="loan-sort"
            sortMode={loanSortMode}
            sortOptions={LOAN_SORT_OPTIONS}
          />
        ),
        meta: { label: "Deuda / cuotas" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          const leftValue = rowA.original.isLoan
            ? getLoanSortValue(rowA.original, loanSortMode)
            : null;
          const rightValue = rowB.original.isLoan
            ? getLoanSortValue(rowB.original, loanSortMode)
            : null;

          return compareValuesKeepingInvalidLast({
            compareValidValues: (leftNumericValue, rightNumericValue) => {
              const difference = leftNumericValue - rightNumericValue;

              if (difference !== 0) {
                return difference;
              }

              return rowA.original.description.localeCompare(
                rowB.original.description,
                "es",
              );
            },
            leftValue,
            rightValue,
            sortDirection: getSortDirection(LOAN_SORT_COLUMN_ID),
          });
        },
      },
      {
        accessorKey: "lenderName",
        cell: ({ row }) => {
          const lenderName = row.original.lenderName.trim();

          return (
            <div className={styles.lenderCell}>
              <span className={styles.lenderName}>
                {lenderName.length > 0 ? lenderName : <EmptyCellPlaceholder />}
              </span>
              {row.original.isLoan ? (
                <Badge className={styles.lenderDirectionBadge} variant="outline">
                  {getLoanDirectionLabel(row.original.loanDirection ?? "payable")}
                </Badge>
              ) : null}
            </div>
          );
        },
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedEnumFilter(
            filterValue,
            getLoanDirectionFilterValue(row.original),
          ),
        header: getSortableHeader("Prestamista"),
        meta: { label: "Prestamista" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          return compareValuesKeepingInvalidLast({
            compareValidValues: (leftValue, rightValue) =>
              leftValue.localeCompare(rightValue, "es", {
                sensitivity: "base",
              }),
            leftValue: rowA.original.lenderName.trim(),
            rightValue: rowB.original.lenderName.trim(),
            sortDirection: getSortDirection("lenderName"),
          });
        },
      },
      {
        id: LOAN_INSTALLMENT_RANGE_COLUMN_ID,
        accessorFn: (row) => getVigenciaSortValue(row, vigenciaSortMode),
        cell: ({ row }) => {
          const startLabel = formatYearMonth(row.original.startMonth);
          const endLabel = formatYearMonth(row.original.loanEndMonth);

          if (startLabel === "-" && endLabel === "-") {
            return <EmptyCellPlaceholder />;
          }

          return (
            <span className={styles.loanInstallmentRangeCell}>
              <span>{startLabel}</span>
              <span
                aria-hidden="true"
                className={styles.loanInstallmentRangeArrow}
              >
                →
              </span>
              <span>{endLabel}</span>
            </span>
          );
        },
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedYearMonthRangeFilter(
            filterValue,
            getVigenciaSortValue(row.original, vigenciaSortMode),
          ),
        header: ({ column }) => (
          <SortModeColumnHeader
            column={column}
            label="Vigencia"
            onApplySort={({ direction, mode }) => {
              setVigenciaSortMode(mode);
              setSorting(buildVigenciaSortingState(direction));
            }}
            optionIdPrefix="vigencia-sort"
            sortMode={vigenciaSortMode}
            sortOptions={VIGENCIA_SORT_OPTIONS}
          />
        ),
        meta: { label: "Vigencia" },
        sortingFn: (rowA, rowB) => {
          const relevanceComparison = compareRowsByDescriptionFilterRelevance(
            rowA.original,
            rowB.original,
          );

          if (relevanceComparison !== 0) {
            return relevanceComparison;
          }

          const leftValue = getVigenciaSortValue(rowA.original, vigenciaSortMode);
          const rightValue = getVigenciaSortValue(rowB.original, vigenciaSortMode);

          return compareValuesKeepingInvalidLast({
            compareValidValues: (leftNumericValue, rightNumericValue) => {
              const difference = leftNumericValue - rightNumericValue;

              if (difference !== 0) {
                return difference;
              }

              return rowA.original.description.localeCompare(
                rowB.original.description,
                "es",
              );
            },
            leftValue,
            rightValue,
            sortDirection: loanInstallmentRangeSortDirection,
          });
        },
      },
    ],
    [
      actionDisabled,
      areAllVisibleRowsSelected,
      areSomeVisibleRowsSelected,
      exchangeRateSnapshot,
      getSortDirection,
      handleToggleAllVisibleRowsSelection,
      handleToggleExpenseSelection,
      loanInstallmentRangeSortDirection,
      loanSortMode,
      onCancelRecurrence,
      onReactivateRecurrence,
      onDeleteAllReceiptsFolderReference,
      onDeleteExpense,
      onDeletePaymentLink,
      onDeleteExpenseReceiptShare,
      onDeleteMonthlyFolderReference,
      onDeleteReceipt,
      onDeleteManualPaymentRecord,
      onEditReceiptCoverage,
      onEditManualPaymentRecord,
      onEditExpense,
      onMoveExpenseToFolder,
      onRegisterPaymentRecord,
      onUpdatePaymentRecordSendStatus,
      compareRowsByDescriptionFilterRelevance,
      handleOpenDetailsDialog,
      handleOpenReceiptShareDialog,
      handleOpenPaymentLinkDialog,
      selectedExpenseIdsInCurrentRows,
      expenseFolders,
      foldersById,
      vigenciaSortMode,
    ],
  );

  const allReplicableOptionIds = replicateFromPreviousMonthOptions.map(
    (option) => option.id,
  );
  const selectedReplicableOptionIdSet = new Set(selectedReplicableOptionIds);
  const areAllReplicableOptionsSelected =
    allReplicableOptionIds.length > 0 &&
    allReplicableOptionIds.every((optionId) =>
      selectedReplicableOptionIdSet.has(optionId),
    );
  const isAnyReplicableOptionSelected = selectedReplicableOptionIds.length > 0;

  return (
    <section
      aria-busy={isMonthTransitionPending || isRestoringTablePreferences}
      className={styles.section}
    >
      <div className={styles.content}>
        <div className={styles.headerTopRow}>
          <div className={styles.header}>
            <p className={styles.pageDescription}>
              <Highlighter
                action="underline"
                animationDuration={450}
                color="#2fbf91"
                isView
                iterations={1}
                strokeWidth={2}
              >
                Cargá, editá y guardá
              </Highlighter>{" "}
              tu control mensual: pagos, deudas, cuotas, prestamos y comprobantes.
            </p>
          </div>
        </div>

        {loadError ? (
          <p className={cn(styles.feedback, styles.errorText)} role="alert">
            <span>{loadError}</span>
            {loadErrorCode ? (
              <span className={styles.feedbackErrorCode}>{`Code: ${loadErrorCode}`}</span>
            ) : null}
          </p>
        ) : null}

        <div className={styles.tableContent}>
          <div className={styles.toolbar}>
            <div className={styles.monthField}>
              <div className={styles.monthLabelRow}>
                <Label htmlFor="monthly-expenses-month">Mes</Label>
                <LoanInfoPopover
                  closeLabel="Cerrar información de Mes"
                  message="Cambiá el mes para guardar o consultar otra planilla mensual."
                  triggerLabel="Información sobre el campo Mes"
                />
              </div>
              <Input
                disabled={isMonthTransitionPending}
                id="monthly-expenses-month"
                onChange={(event) => onMonthChange(event.target.value)}
                type="month"
                value={month}
              />
            </div>
          </div>
          {showCopyFromControls ? (
            <div className={styles.copyField}>
              <div className={styles.copyActions}>
                <Button
                  disabled={isCopyFromDisabled}
                  onClick={() => {
                    onCopyFromMonth();
                  }}
                  type="button"
                  variant="outline"
                >
                  Replicar gastos del mes anterior
                </Button>
              </div>
            </div>
          ) : null}

          {exchangeRateSnapshot ? (
            <div className={styles.exchangeRateSummary}>
              <p className={styles.exchangeRateLine}>
                Dólar oficial:
                <span className={styles.exchangeRateValue}>
                  {formatExchangeRateAmount(exchangeRateSnapshot.officialRate)}
                </span>
              </p>
              <p className={styles.exchangeRateLine}>
                Dólar solidario:
                <span className={styles.exchangeRateValue}>
                  {formatExchangeRateAmount(exchangeRateSnapshot.solidarityRate)}
                </span>
              </p>
            </div>
          ) : exchangeRateLoadError ? (
            <p className={styles.exchangeRateFallback}>{exchangeRateLoadError}</p>
          ) : null}

          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Detalle del mes</h2>
            <p className={styles.tableDescription}>
              Editá cada compromiso desde su menú de acciones.
            </p>
            <div className={styles.tableAddAction}>
              <Button
                disabled={actionDisabled || isMonthTransitionPending}
                onClick={onAddExpense}
                type="button"
                variant="outline"
              >
                Agregar compromiso
              </Button>
              <Button
                onClick={onManageFolders}
                type="button"
                variant="outline"
              >
                Administrar carpetas
              </Button>
            </div>
          </div>

          <div
            className={cn(
              styles.tableWrapper,
              isTableHorizontallyScrolled && styles.tableWrapperScrolled,
            )}
            ref={tableWrapperRef}
          >
            {completedPendingReceiptShareCount > 0 ? (
              <div
                aria-live="polite"
                className={cn(styles.receiptShareSummary, styles.receiptShareSummaryInfo)}
                role="status"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className={styles.receiptShareSummaryIcon}
                />
                <div className={styles.receiptShareSummaryContent}>
                  <p className={styles.receiptShareSummaryText}>
                    {completedPendingReceiptShareMessage}
                  </p>
                  <ul className={styles.receiptShareSummaryList}>
                    {completedPendingReceiptShareExpenses.map((expense) => (
                      <li
                        key={expense.expenseId}
                        className={styles.receiptShareSummaryListItem}
                      >
                        <span className={styles.receiptShareSummaryListDescription}>
                          {expense.displayDescription}
                        </span>
                        <Button
                          aria-label={`Filtrar compromiso ${expense.displayDescription}`}
                          className={styles.receiptShareSummaryFilterButton}
                          onClick={() => setDescriptionFilter(expense.rawDescription)}
                          type="button"
                          variant="ghost"
                        >
                          Filtrar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            {isRestoringTablePreferences || isMonthTransitionPending ? (
              <div
                aria-label={
                  isMonthTransitionPending && pendingMonth
                    ? `Cargando mes ${pendingMonth}`
                    : "Cargando configuración de tabla"
                }
                aria-live="polite"
                className={styles.tableLoadingOverlay}
                role="status"
              >
                <div className={styles.tableLoadingContent}>
                  <span
                    aria-hidden="true"
                    className={styles.tableLoadingSpinner}
                  />
                  <span className={styles.tableLoadingText}>
                    {isMonthTransitionPending && pendingMonth
                      ? `Cargando ${pendingMonth}...`
                      : "Cargando configuración de tabla..."}
                  </span>
                </div>
              </div>
            ) : null}
            <ExpenseFolderFilterBar
              countsByFolderId={folderCounts.countsByFolderId}
              folders={expenseFolders}
              onMoveExpenseToFolder={onMoveExpenseToFolder}
              onReorderFolders={onReorderFolders}
              onSelectFilter={onFolderFilterChange}
              selectedFilterId={folderFilterId}
              totalCount={folderCounts.totalCount}
              unassignedCount={folderCounts.unassignedCount}
            />
            <DataTable
              advancedFiltersButtonLabel="Filtros avanzados"
              advancedFiltersConfig={MONTHLY_EXPENSES_ADVANCED_FILTERS_CONFIG}
              advancedFiltersDescription="Aplicá filtros por columna para acotar los resultados."
              advancedFiltersDialogTitle="Filtros avanzados"
              applyAdvancedFiltersLabel="Aplicar"
              clearAdvancedFiltersLabel="Limpiar"
              columnVisibility={columnVisibility}
              columnVisibilityButtonLabel="Columnas"
              columnVisibilityMenuLabel="Mostrar columnas"
              columns={columns}
              hideableColumnsDefaultVisibility={
                MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY
              }
              data={rowsForTable}
              emptyMessage={
                hasActiveDescriptionFiltering
                  ? MONTHLY_EXPENSES_FILTERED_EMPTY_MESSAGE
                  : MONTHLY_EXPENSES_EMPTY_MESSAGE
              }
              excludeFilterLabel="Excluir resultados"
              excludeFilterPlaceholder="Excluir gastos por descripción"
              excludeFilterRowsCountByValue={
                excludeFilterMetrics.excludeFilterRowsCountByValue
              }
              excludeFilterUniqueRowsCount={
                excludeFilterMetrics.excludeFilterUniqueRowsCount
              }
              excludeFilterValues={excludedDescriptionFilters}
              filterColumnId="description"
              filterExtraContent={(
                <div className={styles.completedOrderFilter}>
                  <label className={styles.completedOrderFilterLabel}>
                    <input
                      checked={moveCompletedToEnd}
                      className={styles.completedOrderFilterCheckbox}
                      disabled={hasManualSorting}
                      onChange={(event) => {
                        setMoveCompletedToEnd(event.target.checked);
                      }}
                      type="checkbox"
                    />
                    <span>{MOVE_COMPLETED_TO_END_LABEL}</span>
                  </label>
                  {hasManualSorting ? (
                    <p className={styles.completedOrderFilterHint}>
                      {MOVE_COMPLETED_TO_END_WITH_SORTING_HELPER_TEXT}
                    </p>
                  ) : null}
                </div>
              )}
              filterLabel="Filtrar gastos"
              filterPlaceholder="Filtrar gastos por descripción"
              filterValue={descriptionFilter}
              onExcludeFilterValuesChange={setExcludedDescriptionFilters}
              getRowClassName={getMonthlyExpenseRowClassName}
              onCellClick={handleTableCellClick}
              onAppliedFiltersChange={setQueryAppliedFilters}
              onFilterValueChange={setDescriptionFilter}
              onVisibleRowsChange={handleVisibleRowsChange}
              onColumnVisibilityChange={setColumnVisibility}
              onSortingChange={setSorting}
              queryFilterConfig={monthlyExpensesFilterQualifiers}
              queryFilterLabel={MONTHLY_EXPENSES_QUERY_FILTER_LABEL}
              queryFilterPlaceholder={MONTHLY_EXPENSES_QUERY_FILTER_PLACEHOLDER}
              selectAllColumnsLabel="Restablecer"
              showExcludeFilterToggle
              showColumnVisibilityToggle={true}
              sortingBadgeLabelOverrides={{
                [LOAN_SORT_COLUMN_ID]: `Deuda / cuotas (${getLoanSortModeLabel(loanSortMode)})`,
                [LOAN_INSTALLMENT_RANGE_COLUMN_ID]: `Vigencia (${getVigenciaSortModeLabel(vigenciaSortMode)})`,
              }}
              sorting={sorting}
              toolbarActions={
                <DropdownMenu
                  onOpenChange={setIsBulkActionsMenuOpen}
                  open={isBulkActionsMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label="Acciones masivas"
                      disabled={isBulkActionsDisabled}
                      type="button"
                      variant="outline"
                    >
                      Acciones masivas
                      {isBulkActionsMenuOpen ? (
                        <ChevronUp aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={isBulkActionsDisabled}
                      onSelect={(event) => {
                        event.preventDefault();
                        setIsBulkDeleteDialogOpen(true);
                      }}
                    >
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </div>

          {feedbackMessage.trim().length > 0 ? (
            <p
              aria-live="polite"
              className={cn(
                styles.feedback,
                feedbackTone === "error" && styles.errorText,
                feedbackTone === "success" && styles.successText,
              )}
              role={feedbackTone === "error" ? "alert" : undefined}
            >
              <span>{feedbackMessage}</span>
              {feedbackTone === "error" && feedbackErrorCode ? (
                <span className={styles.feedbackErrorCode}>{`Code: ${feedbackErrorCode}`}</span>
              ) : null}
            </p>
          ) : null}
        </div>

        <AlertDialog
          onOpenChange={setIsBulkDeleteDialogOpen}
          open={isBulkDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Querés eliminar los gastos seleccionados?</AlertDialogTitle>
              <AlertDialogDescription>
                {`Se eliminarán ${selectedVisibleCount} compromiso${selectedVisibleCount === 1 ? " seleccionado" : "s seleccionados"} de la tabla visible.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirmBulkDelete();
                }}
                type="button"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          onOpenChange={onCopyFromMonthDialogOpenChange}
          open={replicateFromPreviousMonthDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seleccioná los gastos a replicar</DialogTitle>
              <DialogDescription>
                Mostramos los gastos faltantes y vigentes del mes anterior.
                Todos empiezan seleccionados.
              </DialogDescription>
            </DialogHeader>
            <div className={styles.copySelectionList}>
              <label className={styles.copySelectionToggleAll}>
                <input
                  checked={areAllReplicableOptionsSelected}
                  onChange={onToggleAllReplicableOptions}
                  type="checkbox"
                />
                <span>Seleccionar todos</span>
              </label>
              {replicateFromPreviousMonthOptions.map((option) => (
                <label key={option.id} className={styles.copySelectionOption}>
                  <input
                    checked={selectedReplicableOptionIdSet.has(option.id)}
                    onChange={() => onToggleReplicableOption(option.id)}
                    type="checkbox"
                  />
                  <span>{option.description}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button
                onClick={() => onCopyFromMonthDialogOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                aria-label="Confirmar replicación de gastos del mes anterior"
                disabled={isCopyFromDisabled || !isAnyReplicableOptionSelected}
                onClick={() => {
                  onConfirmCopyFromMonth(selectedReplicableOptionIds);
                }}
                type="button"
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ExpenseSheet
          actionDisabled={actionDisabled || isSubmitting}
          changedFields={changedFields}
          draft={draft}
          expenseFolders={expenseFolders}
          isOpen={isExpenseSheetOpen}
          isSubmitting={isSubmitting}
          lenders={lenders}
          mode={sheetMode}
          onAddLender={onAddLender}
          onFieldChange={onExpenseFieldChange}
          onFolderSelect={onExpenseFolderSelect}
          onManageFolders={onManageFolders}
          onLenderSelect={onExpenseLenderSelect}
          onLoanToggle={onExpenseLoanToggle}
          onRecurringToggle={onExpenseRecurringToggle}
          onReceiptShareToggle={onExpenseReceiptShareToggle}
          onRequestClose={onRequestCloseExpenseSheet}
          onSave={onSaveExpense}
          onUnsavedChangesClose={onUnsavedChangesClose}
          onUnsavedChangesDiscard={onUnsavedChangesDiscard}
          onUnsavedChangesSave={onSaveUnsavedChanges}
          showUnsavedChangesDialog={showUnsavedChangesDialog}
          validationMessage={validationMessage}
        />

        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              handleCloseDetailsDialog();
            }
          }}
          open={detailsDialogState != null}
        >
          <AlertDialogContent
            className={styles.paymentLinkDialogContent}
            onOpenAutoFocus={(event) => {
              handleDialogInputAutoFocus(event, "subtotal-dialog-input");
            }}
            size="sm"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Editar subtotal y cantidad</AlertDialogTitle>
              <AlertDialogDescription>
                {subtotalUnitDraftValue === "hour"
                  ? `Actualizá el subtotal por hora y la duración mensual de ${detailsDialogState?.expenseDescription ?? "este compromiso"}.`
                  : `Actualizá el subtotal, su unidad y la cantidad mensual de ${detailsDialogState?.expenseDescription ?? "este compromiso"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="subtotal-dialog-input">Subtotal</Label>
              <InputGroup>
                <InputGroupAddon align="inline-start" aria-hidden="true">
                  {detailsDialogState?.currency === "USD" ? "US$" : "$"}
                </InputGroupAddon>
                <InputGroupInput
                  aria-invalid={subtotalDraftError ? "true" : "false"}
                  aria-label={`Subtotal de ${detailsDialogState?.expenseDescription ?? "compromiso"}`}
                  autoFocus
                  id="subtotal-dialog-input"
                  inputMode="decimal"
                  onChange={(event) => {
                    setSubtotalDraftValue(
                      normalizeCurrencyInput(event.target.value),
                    );

                    if (subtotalDraftError) {
                      setSubtotalDraftError(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveDetails();
                    }
                  }}
                  placeholder="0"
                  type="text"
                  value={formatCurrencyDisplayWithOptions(subtotalDraftValue, {
                    preserveExplicitFractionDigits: true,
                  })}
                />
                {subtotalUnitDraftValue === "hour" ? (
                  <InputGroupAddon align="inline-end" aria-hidden="true">
                    /h
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              {subtotalDraftError ? (
                <p className={styles.paymentLinkDialogError} role="alert">
                  {subtotalDraftError}
                </p>
              ) : null}
            </div>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="subtotal-unit-dialog-select">
                Unidad del subtotal
              </Label>
              <Select
                onValueChange={(nextValue) => {
                  setSubtotalUnitDraftValue(
                    nextValue === "hour" ? "hour" : "occurrence",
                  );
                }}
                value={subtotalUnitDraftValue}
              >
                <SelectTrigger
                  aria-label={`Unidad del subtotal de ${detailsDialogState?.expenseDescription ?? "compromiso"}`}
                  id="subtotal-unit-dialog-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="occurrence">Por ocurrencia</SelectItem>
                  <SelectItem value="hour">Por hora</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {subtotalUnitDraftValue === "hour" ? (
              <div className={styles.paymentLinkDialogField}>
                <OccurrenceDurationInput
                  durationHoursAriaLabel={`Duración mensual en horas de ${detailsDialogState?.expenseDescription ?? "compromiso"}`}
                  durationMinutesAriaLabel={`Duración mensual en minutos de ${detailsDialogState?.expenseDescription ?? "compromiso"}`}
                  label="Duración mensual"
                  onChange={(nextUnit) => {
                    setOccurrencesUnitDraftValue(nextUnit);

                    if (occurrencesUnitDraftError) {
                      setOccurrencesUnitDraftError(null);
                    }
                  }}
                  value={occurrencesUnitDraftValue}
                />
                {occurrencesUnitDraftError ? (
                  <p className={styles.paymentLinkDialogError} role="alert">
                    {occurrencesUnitDraftError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className={styles.paymentLinkDialogField}>
                <Label htmlFor="occurrences-dialog-input">Cantidad por mes</Label>
                <Input
                  aria-invalid={occurrencesDraftError ? "true" : "false"}
                  aria-label={`Cantidad por mes de ${detailsDialogState?.expenseDescription ?? "compromiso"}`}
                  id="occurrences-dialog-input"
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => {
                    setOccurrencesDraftValue(event.target.value);

                    if (occurrencesDraftError) {
                      setOccurrencesDraftError(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveDetails();
                    }
                  }}
                  step="1"
                  type="number"
                  value={occurrencesDraftValue}
                />
                {occurrencesDraftError ? (
                  <p className={styles.paymentLinkDialogError} role="alert">
                    {occurrencesDraftError}
                  </p>
                ) : null}
              </div>
            )}

            <AlertDialogFooter className={styles.paymentLinkDialogActions}>
              <Button
                onClick={handleCloseDetailsDialog}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={actionDisabled}
                onClick={() => {
                  void handleSaveDetails();
                }}
                type="button"
              >
                Guardar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              handleCloseReceiptShareDialog();
            }
          }}
          open={receiptShareDialogState != null}
        >
          <AlertDialogContent
            className={styles.paymentLinkDialogContent}
            onOpenAutoFocus={(event) => {
              handleDialogInputAutoFocus(event, "receipt-share-phone-dialog-input");
            }}
            size="sm"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {receiptShareDialogState?.mode === "create"
                  ? "Agregar datos de envío"
                  : "Editar datos de envío"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {`Completá WhatsApp y mensaje opcional para ${receiptShareDialogState?.expenseDescription ?? "este compromiso"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="receipt-share-phone-dialog-input">
                Número de WhatsApp
              </Label>
              <Input
                aria-invalid={receiptShareDraftError ? "true" : "false"}
                aria-label={`Número de WhatsApp de ${receiptShareDialogState?.expenseDescription ?? "compromiso"}`}
                autoFocus
                id="receipt-share-phone-dialog-input"
                inputMode="numeric"
                onChange={(event) => {
                  setReceiptSharePhoneDraftValue(
                    normalizeReceiptSharePhoneDigits(event.target.value),
                  );

                  if (receiptShareDraftError) {
                    setReceiptShareDraftError(null);
                  }
                }}
                placeholder="5491123456789"
                type="tel"
                value={formatReceiptSharePhoneDisplay(receiptSharePhoneDraftValue)}
              />
              <Label htmlFor="receipt-share-message-dialog-input">
                Mensaje opcional
              </Label>
              <Textarea
                aria-label={`Mensaje opcional de ${receiptShareDialogState?.expenseDescription ?? "compromiso"}`}
                id="receipt-share-message-dialog-input"
                onChange={(event) => {
                  setReceiptShareMessageDraftValue(event.target.value);
                }}
                placeholder="Opcional"
                value={receiptShareMessageDraftValue}
              />
              {receiptShareDraftError ? (
                <p className={styles.paymentLinkDialogError} role="alert">
                  {receiptShareDraftError}
                </p>
              ) : null}
            </div>

            <AlertDialogFooter className={styles.paymentLinkDialogActions}>
              <Button
                onClick={handleCloseReceiptShareDialog}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={actionDisabled}
                onClick={() => {
                  void handleSaveReceiptShare();
                }}
                type="button"
              >
                Guardar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              handleClosePaymentLinkDialog();
            }
          }}
          open={paymentLinkDialogState != null}
        >
          <AlertDialogContent
            className={styles.paymentLinkDialogContent}
            onOpenAutoFocus={(event) => {
              handleDialogInputAutoFocus(event, "payment-link-dialog-input");
            }}
            size="sm"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {paymentLinkDialogState?.mode === "edit"
                  ? "Editar link de pago"
                  : "Agregar link de pago"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {`Completá el link para ${paymentLinkDialogState?.expenseDescription ?? "este compromiso"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="payment-link-dialog-input">Link de pago</Label>
              <Textarea
                aria-invalid={paymentLinkDraftError ? "true" : "false"}
                aria-label={`Link de pago de ${paymentLinkDialogState?.expenseDescription ?? "compromiso"}`}
                autoFocus
                id="payment-link-dialog-input"
                onChange={(event) => {
                  setPaymentLinkDraftValue(event.target.value);

                  if (paymentLinkDraftError) {
                    setPaymentLinkDraftError(null);
                  }
                }}
                placeholder="https://..."
                value={paymentLinkDraftValue}
              />
              {paymentLinkDraftError ? (
                <p className={styles.paymentLinkDialogError} role="alert">
                  {paymentLinkDraftError}
                </p>
              ) : null}
            </div>

            <AlertDialogFooter className={styles.paymentLinkDialogActions}>
              <Button
                onClick={handleClosePaymentLinkDialog}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={actionDisabled}
                onClick={() => {
                  void handleSavePaymentLink();
                }}
                type="button"
              >
                Guardar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
