import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Highlighter,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  FilterPresetSaveButton,
  FilterPresetsBar,
  ProgressRing,
  cn,
  getExactMatchIndices,
  getFuzzyMatchIndices,
  getFuzzyMatchRank,
  matchesAdvancedYearMonthRangeFilter,
  normalizeSearchValue,
  renderHighlightedText,
  type AppliedFilter,
  type DataTableQueryFilterControls,
  type FilterPreset,
  type FilterPresetLabels,
} from "beez-ui";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Link2,
  MoreVertical,
  Pencil,
  Repeat,
} from "lucide-react";
import { ExpenseRowActions } from "@/components/monthly-expenses/expense-row-actions";
import { QuickAddExpenseForm } from "@/components/monthly-expenses/quick-add-expense-form";
import {
  ExpenseSheet,
  type ExpenseEditableFieldName,
} from "@/components/monthly-expenses/expense-sheet";

import {
  formatCurrencyDisplayWithOptions,
  normalizeCurrencyInput,
} from "./currency-input-format";
import { LoanInfoPopover } from "./loan-info-popover";
import {
  getAdjacentYearMonth,
  getCurrentYearMonth,
} from "./month-navigation";
import {
  getPersistedMonthlyExpensesFilterPresets,
  persistMonthlyExpensesFilterPresets,
} from "./monthly-expenses-filter-presets";
import type { LenderOption } from "./lender-picker";
import {
  ExpenseFolderPicker,
  type ExpenseFolderOption,
} from "./expense-folder-picker";
import {
  ExpenseFolderFilterBar,
  ExpenseFolderRowBadge,
} from "./expense-folder-organizer";
import {
  ExpenseFolderIconGlyph,
  resolveExpenseFolderColorHex,
  UNASSIGNED_EXPENSE_FOLDER_FILTER_ID,
} from "./expense-folder-visuals";
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
  getUsdRateForRow,
} from "./monthly-expenses-currency";
import { getUsdRateBadgeLabel } from "./usd-rate-type-labels";
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

import {
  compareValuesKeepingInvalidLast,
  getColumnSortDirection,
} from "./monthly-expenses-sort-comparators";
import {
  BULK_SELECTION_COLUMN_ID,
  GROUP_POSITION_COLUMN_ID,
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  LOAN_SORT_COLUMN_ID,
} from "./monthly-expenses-table-column-ids";
import { PaymentHistoryCell } from "./payment-history-cell";
import {
  DEFAULT_LOAN_SORT_MODE,
  DEFAULT_MOVE_COMPLETED_TO_END,
  DEFAULT_VIGENCIA_SORT_MODE,
  getPersistedMonthlyExpensesTablePreferences,
  MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY,
  persistMonthlyExpensesTablePreferences,
} from "./monthly-expenses-table-preferences";
import {
  getGroupKeyForMode,
  getGroupLabelForMode,
  getGroupPositionForMode,
  GROUP_BY_MODE_LABELS,
  GROUP_BY_MODE_MENU_OPTIONS,
} from "./monthly-expenses-table-group-modes";
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
  MonthlyExpensesGroupByMode,
  MonthlyExpensesReplicableOption,
  MonthlyExpenseUsdRateBase,
  MonthlyExpenseUsdRateSettings,
  TechnicalErrorCode,
  VigenciaSortMode,
} from "./monthly-expenses-table.types";
import { DEFAULT_USD_RATE_SETTINGS } from "./monthly-expenses-table.types";

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
const MANUAL_SORTING_DISABLED_HELPER_TEXT =
  "Desactivado mientras haya un orden manual.";

/** Modo de agrupado visual de la tabla; v1 solo soporta carpeta. */

/**
 * Entrada de orden que ancla el agrupado: siempre primera en el estado de
 * sorting mientras hay agrupado, para que cualquier orden de usuario (header o
 * menú «Ordenar por») aplique dentro de cada grupo.
 */
const GROUP_POSITION_SORT_ENTRY = {
  desc: false,
  id: GROUP_POSITION_COLUMN_ID,
} as const;

/** El badge "Ordenado por" y su "Quitar orden" ignoran la columna fantasma. */
const SORTING_BADGE_IGNORED_COLUMN_IDS: ReadonlySet<string> = new Set([
  GROUP_POSITION_COLUMN_ID,
]);

/**
 * Etiquetas de criterio para el menú «Ordenar por», en el orden en que se
 * listan sus opciones (espejo del orden de las columnas de la tabla).
 * «Deuda / cuotas» no está acá: se ofrece como submenú con sus tres criterios
 * reales (cuotas pagadas/restantes/totales) y su etiqueta sale del modo activo.
 */
const SORT_LABELS_BY_COLUMN_ID: Record<string, string> = {
  description: "Descripción",
  total: "Total",
  usd: "USD",
  paymentsProgress: "Pagos",
  lenderName: "Contraparte",
  [LOAN_INSTALLMENT_RANGE_COLUMN_ID]: "Vigencia",
};

const SORT_MENU_OPTIONS: ReadonlyArray<{ id: string; label: string }> =
  Object.entries(SORT_LABELS_BY_COLUMN_ID).map(([columnId, label]) => ({
    id: columnId,
    label,
  }));
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

const MONTHLY_EXPENSES_QUERY_FILTER_LABEL = "Filtro unificado de gastos";
/** Placeholders of the saved-filter editors, with examples from this table. */
const MONTHLY_EXPENSES_FILTER_PRESET_LABELS: Partial<FilterPresetLabels> = {
  presetNamePlaceholder: "Deudas grandes",
  presetQueryPlaceholder: "total:>1000 direccion:me-deben",
};
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
  onDuplicateExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onExpenseFieldChange: (
    fieldName: ExpenseEditableFieldName,
    value: string,
  ) => void;
  onExpenseFolderSelect: (folderId: string | null) => void;
  onManageFolders: () => void;
  onMoveExpenseToFolder: (args: {
    expenseId: string;
    folderId: string | null;
  }) => void;
  onMoveExpensesToFolder: (args: {
    expenseIds: string[];
    folderId: string | null;
  }) => Promise<boolean>;
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
  onUpdateUsdRate: (args: {
    expenseId: string;
    usdRate: MonthlyExpenseUsdRateSettings;
  }) => void | Promise<void>;
  /** Quick action: covers the expense's remaining payments for the month. */
  onMarkExpensePaid: (expenseId: string) => void;
  /** Quick add: creates an expense with defaults (once a month, no folder). */
  onQuickAddExpense: (args: {
    currency: MonthlyExpenseCurrency;
    description: string;
    subtotal: number;
  }) => void;
  /** Duplicates the expense into another month without leaving this one. */
  onDuplicateExpenseToMonth: (args: {
    expenseId: string;
    targetMonth: string;
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

interface CustomUsdRateDialogState {
  expenseDescription: string;
  expenseId: string;
}

interface DuplicateToMonthDialogState {
  expenseDescription: string;
  expenseId: string;
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
      clearSorting: () => void;
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
          onClick={() => {
            // Ciclo de tres estados: sin orden -> ascendente -> descendente
            // -> sin orden.
            const currentSorted = column.getIsSorted();

            if (currentSorted === false) {
              column.toggleSorting(false);
              return;
            }

            if (currentSorted === "asc") {
              column.toggleSorting(true);
              return;
            }

            column.clearSorting();
          }}
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
  usdRate,
  value,
}: {
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rowCurrency: MonthlyExpenseCurrency;
  usdRate: MonthlyExpenseUsdRateSettings;
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
    usdRate,
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
 * Total del mes con desglose pagado vs. pendiente (según `isPaymentCompleted`)
 * ya formateado en la moneda pedida. Un subconjunto vacío es un total de 0 (no
 * "sin datos convertibles").
 */
function formatMonthlyTotalsBreakdown({
  currency,
  exchangeRateSnapshot,
  rows,
}: {
  currency: MonthlyExpenseCurrency;
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rows: MonthlyExpensesEditableRow[];
}): { paid: string; pending: string; total: string } {
  const paidRows = rows.filter((row) => isPaymentCompleted(row));
  const pendingRows = rows.filter((row) => !isPaymentCompleted(row));
  const formatTotalForRows = (totalRows: MonthlyExpensesEditableRow[]) =>
    formatConvertedAmount(
      currency,
      totalRows.length === 0
        ? 0
        : getConvertedTotalAmount({
            currency,
            exchangeRateSnapshot,
            rows: totalRows,
          }),
    );

  return {
    paid: formatTotalForRows(paidRows),
    pending: formatTotalForRows(pendingRows),
    total: formatTotalForRows(rows),
  };
}

/**
 * Footer de totales por moneda: total de las filas visibles (según filtros
 * activos) más el desglose pagado vs. pendiente derivado de
 * `isPaymentCompleted`.
 */
function MonthlyTotalsFooter({
  currency,
  exchangeRateSnapshot,
  rows,
}: {
  currency: MonthlyExpenseCurrency;
  exchangeRateSnapshot: ExchangeRateSnapshot | null;
  rows: MonthlyExpensesEditableRow[];
}) {
  const totals = formatMonthlyTotalsBreakdown({
    currency,
    exchangeRateSnapshot,
    rows,
  });

  return (
    <span className={styles.totalFooterCell}>
      <span className={styles.totalFooterValue}>{totals.total}</span>
      <span className={styles.totalFooterBreakdownLine}>
        {"Pagado: "}
        <span className={cn(styles.groupHeaderTotalsAmount, "text-green-700 dark:text-green-300")}>
          {totals.paid}
        </span>
      </span>
      <span className={styles.totalFooterBreakdownLine}>
        {"Pendiente: "}
        <span className={cn(styles.groupHeaderTotalsAmount, "text-yellow-700 dark:text-yellow-300")}>
          {totals.pending}
        </span>
      </span>
    </span>
  );
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
  onManageFolders,
  onMoveExpenseToFolder,
  onMoveExpensesToFolder,
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
  onDuplicateExpense,
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
  onUpdateUsdRate,
  onMarkExpensePaid,
  onQuickAddExpense,
  onDuplicateExpenseToMonth,
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
  const [moveCompletedToEnd, setMoveCompletedToEnd] = useState(
    DEFAULT_MOVE_COMPLETED_TO_END,
  );
  const [groupByMode, setGroupByMode] =
    useState<MonthlyExpensesGroupByMode>("none");
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<
    ReadonlySet<string>
  >(() => new Set<string>());
  const handleGroupToggle = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((previousCollapsedGroupKeys) => {
      const nextCollapsedGroupKeys = new Set(previousCollapsedGroupKeys);

      if (nextCollapsedGroupKeys.has(groupKey)) {
        nextCollapsedGroupKeys.delete(groupKey);
      } else {
        nextCollapsedGroupKeys.add(groupKey);
      }

      return nextCollapsedGroupKeys;
    });
  }, []);
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
    () => buildMonthlyExpensesFilterQualifiers({ expenseFolders, lenders }),
    [expenseFolders, lenders],
  );
  // Carpetas incluidas (`carpeta:`) y excluidas (`-carpeta:`) desde la barra,
  // para reflejar visualmente esa selección en los chips de carpeta.
  const folderBarSelection = useMemo(() => {
    const included = new Set<string>();
    const excluded = new Set<string>();

    for (const appliedFilter of queryAppliedFilters) {
      if (appliedFilter.value.kind === "folder") {
        (appliedFilter.negated ? excluded : included).add(
          appliedFilter.value.folderId,
        );
        continue;
      }

      // `no:carpeta` / `tiene:carpeta` → reflect on the "Sin carpeta" chip.
      if (
        appliedFilter.key === "carpeta" &&
        appliedFilter.value.kind === "presence"
      ) {
        if (appliedFilter.value.value === "noValue") {
          // no:carpeta — only rows without a folder are shown → select "Sin carpeta".
          included.add(UNASSIGNED_EXPENSE_FOLDER_FILTER_ID);
        } else {
          // tiene:carpeta — rows with a folder are shown → exclude "Sin carpeta".
          excluded.add(UNASSIGNED_EXPENSE_FOLDER_FILTER_ID);
        }
      }
    }

    return { excluded, included };
  }, [queryAppliedFilters]);
  const queryFilterControlsRef = useRef<DataTableQueryFilterControls | null>(
    null,
  );
  const [filterPresets, setFilterPresets] = useState<
    FilterPreset[]
  >([]);

  useEffect(() => {
    // Igual que la restauración de preferencias: diferido para no disparar
    // renders en cascada (react-hooks/set-state-in-effect), y con setTimeout
    // en vez de requestAnimationFrame porque los rAF no corren en pestañas en
    // background y los presets quedaban sin restaurar.
    const restoreTimeoutId = window.setTimeout(() => {
      setFilterPresets(getPersistedMonthlyExpensesFilterPresets());
    }, 0);

    return () => {
      window.clearTimeout(restoreTimeoutId);
    };
  }, []);

  // Cada mutación persiste explícitamente: no hace falta un efecto con guard
  // de primer render como el de las preferencias de tabla.
  const updateFilterPresets = useCallback(
    (nextFilterPresets: FilterPreset[]) => {
      setFilterPresets(nextFilterPresets);
      persistMonthlyExpensesFilterPresets(nextFilterPresets);
    },
    [],
  );
  const handleSaveFilterPreset = useCallback(
    (presetName: string): boolean => {
      const query = queryFilterControlsRef.current?.getQueryText().trim() ?? "";

      if (!query) {
        return false;
      }

      // Upsert por nombre: guardar con un nombre existente reemplaza su query.
      const nextFilterPresets = [
        ...filterPresets.filter((preset) => preset.name !== presetName),
        { name: presetName, query },
      ];

      updateFilterPresets(nextFilterPresets);
      return true;
    },
    [filterPresets, updateFilterPresets],
  );
  const handleApplyFilterPreset = useCallback(
    (preset: FilterPreset) => {
      queryFilterControlsRef.current?.setQueryText(preset.query);
    },
    [],
  );
  const handleUpdateFilterPreset = useCallback(
    ({
      name,
      originalName,
      query,
    }: {
      name: string;
      originalName: string;
      query: string;
    }) => {
      // Map (y no remove+append) para conservar la posición del chip.
      updateFilterPresets(
        filterPresets.map((preset) =>
          preset.name === originalName ? { name, query } : preset,
        ),
      );
    },
    [filterPresets, updateFilterPresets],
  );
  const handleDeleteFilterPreset = useCallback(
    (presetName: string) => {
      updateFilterPresets(
        filterPresets.filter((preset) => preset.name !== presetName),
      );
    },
    [filterPresets, updateFilterPresets],
  );
  // Clickear un chip de carpeta escribe en la barra (única fuente de verdad):
  // reemplaza todos los `carpeta:`/`-carpeta:` por el elegido (o ninguno para
  // "Todas") y limpia el filtro de carpeta heredado, para no duplicar filtrado.
  const handleFolderChipSelect = useCallback((folderId: string) => {
    // Los chips escriben en la barra (única fuente de verdad de carpetas):
    // reemplazan los `carpeta:`/`-carpeta:` por el elegido (o ninguno para "Todas").
    queryFilterControlsRef.current?.setSingleFolderFilter(
      folderId === "" ? null : folderId,
    );
  }, []);
  const [paymentLinkDialogState, setPaymentLinkDialogState] =
    useState<PaymentLinkDialogState | null>(null);
  const [paymentLinkDraftValue, setPaymentLinkDraftValue] = useState("");
  const [paymentLinkDraftError, setPaymentLinkDraftError] =
    useState<string | null>(null);
  const [customUsdRateDialogState, setCustomUsdRateDialogState] =
    useState<CustomUsdRateDialogState | null>(null);
  const [duplicateToMonthDialogState, setDuplicateToMonthDialogState] =
    useState<DuplicateToMonthDialogState | null>(null);
  const [duplicateToMonthDraftValue, setDuplicateToMonthDraftValue] =
    useState("");
  const [customUsdRateDraftValue, setCustomUsdRateDraftValue] = useState("");
  const [customUsdRateDraftError, setCustomUsdRateDraftError] =
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
  const [isBulkMoveToFolderDialogOpen, setIsBulkMoveToFolderDialogOpen] =
    useState(false);
  const [bulkMoveTargetFolderId, setBulkMoveTargetFolderId] = useState<
    string | null
  >(null);
  const [isBulkActionsMenuOpen, setIsBulkActionsMenuOpen] = useState(false);
  const previousYearMonth = getAdjacentYearMonth(month, -1);
  const nextYearMonth = getAdjacentYearMonth(month, 1);
  const currentYearMonth = getCurrentYearMonth();
  const isCurrentMonthVisible = month === currentYearMonth;
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

    // setTimeout y no requestAnimationFrame: los rAF no corren en pestañas en
    // background, y el restore quedaba pendiente (tabla "restaurando" y sin
    // agrupado) hasta que la pestaña recibiera foco.
    const restoreTimeoutId = window.setTimeout(() => {
      if (persistedPreferences) {
        setLoanSortMode(persistedPreferences.loanSortMode);
        setVigenciaSortMode(persistedPreferences.vigenciaSortMode);
        setMoveCompletedToEnd(persistedPreferences.moveCompletedToEnd);
        setGroupByMode(persistedPreferences.groupByMode);
        setCollapsedGroupKeys(
          new Set(persistedPreferences.collapsedGroupKeys),
        );
        // El agrupado activo exige la entrada fantasma al frente del sorting,
        // igual que cuando el usuario lo activa desde el menú.
        setSorting(
          persistedPreferences.groupByMode !== "none"
            ? [GROUP_POSITION_SORT_ENTRY, ...persistedPreferences.sorting]
            : persistedPreferences.sorting,
        );
        setColumnVisibility(persistedPreferences.columnVisibility);
      }

      setIsRestoringTablePreferences(false);
    }, 0);

    return () => {
      window.clearTimeout(restoreTimeoutId);
    };
  }, []);

  useEffect(() => {
    // Mientras el restore (que corre en un requestAnimationFrame) no haya
    // aplicado lo guardado, el estado son los defaults: persistirlos pisaría
    // las preferencias del usuario (p. ej. en el double-mount de StrictMode,
    // donde un guard por ref ya quedó consumido por el primer montaje).
    if (isRestoringTablePreferences) {
      return;
    }

    persistMonthlyExpensesTablePreferences({
      collapsedGroupKeys: Array.from(collapsedGroupKeys),
      columnVisibility,
      groupByMode,
      loanSortMode,
      moveCompletedToEnd,
      // La entrada fantasma del agrupado no se persiste: se deriva del modo
      // de agrupado al restaurar.
      sorting: sorting.filter(
        (sortingEntry) => sortingEntry.id !== GROUP_POSITION_COLUMN_ID,
      ),
      vigenciaSortMode,
    });
  }, [
    collapsedGroupKeys,
    columnVisibility,
    groupByMode,
    isRestoringTablePreferences,
    loanSortMode,
    moveCompletedToEnd,
    sorting,
    vigenciaSortMode,
  ]);

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
  // Cualquier filtro activo (descripción o qualifiers de la barra —incluidos los
  // de carpeta, sin columna y negados—) hace que un resultado vacío sea "sin
  // resultados para el filtro", no "no hay gastos cargados".
  const hasActiveFiltering =
    hasActiveDescriptionFiltering || queryAppliedFilters.length > 0;
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
          appliedFilter.value.kind === "presence" ||
          !COLUMN_BACKED_QUALIFIER_KEYS.has(appliedFilter.key),
      ),
    [queryAppliedFilters],
  );
  const lenderNamesById = useMemo(
    () => new Map(lenders.map((lender) => [lender.id, lender.name])),
    [lenders],
  );
  const lenderTypesById = useMemo(
    () => new Map(lenders.map((lender) => [lender.id, lender.type])),
    [lenders],
  );
  const rowsMatchingQueryPredicate = useMemo(() => {
    if (queryPredicateFilters.length === 0) {
      return rowsExcludingDescriptions;
    }

    const matchesQuery = buildMonthlyExpensesQueryPredicate(
      queryPredicateFilters,
      { exchangeRateSnapshot, lenderNamesById },
    );

    return rowsExcludingDescriptions.filter(matchesQuery);
  }, [
    exchangeRateSnapshot,
    lenderNamesById,
    queryPredicateFilters,
    rowsExcludingDescriptions,
  ]);
  // El estado de sorting es la única fuente de verdad del orden: los headers
  // de columna y el menú «Ordenar por» escriben ahí (sincronizados), y con
  // agrupado activo llevan antepuesta la entrada fantasma de posición de grupo
  // para que todo orden aplique dentro de cada grupo.
  const userSortingEntries = useMemo(
    () =>
      sorting.filter(
        (sortingEntry) => sortingEntry.id !== GROUP_POSITION_COLUMN_ID,
      ),
    [sorting],
  );
  const hasUserSorting = userSortingEntries.length > 0;
  const primaryUserSortingEntry = userSortingEntries[0];
  const applyUserSorting = useCallback(
    (nextUserSorting: SortingState) => {
      setSorting(
        groupByMode !== "none"
          ? [GROUP_POSITION_SORT_ENTRY, ...nextUserSorting]
          : nextUserSorting,
      );
    },
    [groupByMode],
  );
  // El DataTable emite el estado completo al togglear un header; se filtra la
  // entrada fantasma y se re-antepone para mantener la invariante.
  const handleSortingChange = useCallback(
    (nextSorting: SortingState) => {
      applyUserSorting(
        nextSorting.filter(
          (sortingEntry) => sortingEntry.id !== GROUP_POSITION_COLUMN_ID,
        ),
      );
    },
    [applyUserSorting],
  );
  const handleGroupByModeChange = useCallback(
    (nextGroupByMode: MonthlyExpensesGroupByMode) => {
      setGroupByMode(nextGroupByMode);
      // Las claves de grupo colapsadas son propias de cada modo (ids de
      // carpeta vs. contraparte vs. valores fijos): al cambiar de modo se
      // resetean para no arrastrar colapsados de otro criterio.
      setCollapsedGroupKeys(new Set());
      setSorting(
        nextGroupByMode !== "none"
          ? [GROUP_POSITION_SORT_ENTRY, ...userSortingEntries]
          : userSortingEntries,
      );
    },
    [userSortingEntries],
  );
  const rowsForTable = useMemo(() => {
    // "Mover completados al final" solo aplica sin un orden explícito del
    // usuario; con agrupado sigue valiendo dentro de cada grupo (el orden por
    // posición de grupo es estable).
    if (!moveCompletedToEnd || hasUserSorting) {
      return rowsMatchingQueryPredicate;
    }

    return getRowsWithCompletedAtEnd(rowsMatchingQueryPredicate);
  }, [hasUserSorting, moveCompletedToEnd, rowsMatchingQueryPredicate]);
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
  const visibleSummaryRows = useMemo(
    () => rowsForTable.filter((row) => effectiveVisibleExpenseIds.has(row.id)),
    [effectiveVisibleExpenseIds, rowsForTable],
  );
  const monthSummaryTotals = useMemo(
    () =>
      formatMonthlyTotalsBreakdown({
        currency: "ARS",
        exchangeRateSnapshot,
        rows: visibleSummaryRows,
      }),
    [exchangeRateSnapshot, visibleSummaryRows],
  );
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
  const handleBulkMoveToFolderDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsBulkMoveToFolderDialogOpen(nextOpen);

      if (!nextOpen) {
        setBulkMoveTargetFolderId(null);
      }
    },
    [],
  );
  const handleConfirmBulkMoveToFolder = useCallback(async () => {
    if (selectedVisibleExpenseIds.length === 0) {
      handleBulkMoveToFolderDialogOpenChange(false);
      return;
    }

    const wasSaved = await onMoveExpensesToFolder({
      expenseIds: selectedVisibleExpenseIds,
      folderId: bulkMoveTargetFolderId,
    });

    if (!wasSaved) {
      return;
    }

    handleBulkMoveToFolderDialogOpenChange(false);
  }, [
    bulkMoveTargetFolderId,
    handleBulkMoveToFolderDialogOpenChange,
    onMoveExpensesToFolder,
    selectedVisibleExpenseIds,
  ]);
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
        displayDescription: row.description.trim() || "Gasto sin descripción",
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

  const handleOpenCustomUsdRateDialog = useCallback(({
    customUsdRate,
    expenseDescription,
    expenseId,
  }: {
    customUsdRate: number | null;
    expenseDescription: string;
    expenseId: string;
  }) => {
    setCustomUsdRateDialogState({ expenseDescription, expenseId });
    setCustomUsdRateDraftValue(
      customUsdRate && customUsdRate > 0 ? String(customUsdRate) : "",
    );
    setCustomUsdRateDraftError(null);
  }, []);

  const handleCloseCustomUsdRateDialog = () => {
    setCustomUsdRateDialogState(null);
    setCustomUsdRateDraftValue("");
    setCustomUsdRateDraftError(null);
  };

  const handleSaveCustomUsdRate = async () => {
    if (!customUsdRateDialogState) {
      return;
    }

    const parsedCustomUsdRate = Number(
      customUsdRateDraftValue.trim().replace(",", "."),
    );

    if (!Number.isFinite(parsedCustomUsdRate) || parsedCustomUsdRate <= 0) {
      setCustomUsdRateDraftError(
        "Ingresá una cotización en pesos mayor a 0 (por ejemplo 1480,50).",
      );
      return;
    }

    const currentUsdRate =
      rows.find((row) => row.id === customUsdRateDialogState.expenseId)
        ?.usdRate ?? DEFAULT_USD_RATE_SETTINGS;

    setCustomUsdRateDraftError(null);
    await onUpdateUsdRate({
      expenseId: customUsdRateDialogState.expenseId,
      usdRate: {
        ...currentUsdRate,
        base: "custom",
        customRate: parsedCustomUsdRate,
      },
    });
    handleCloseCustomUsdRateDialog();
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
    // Optimistic save: the row updates immediately on the caller side, so the
    // dialog closes without waiting for the request to resolve.
    void onUpdateExpenseDetails({
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
  // Totales por grupo sobre las filas visibles (respetan filtros), para
  // mostrarlos en el header aun con el grupo colapsado.
  const groupTotalsByKey = useMemo(() => {
    if (groupByMode === "none") {
      return null;
    }

    const groupModeContext = { foldersById, lenderNamesById, lenderTypesById };
    const rowsByGroupKey = new Map<string, MonthlyExpensesEditableRow[]>();

    for (const row of rowsForTable) {
      const groupKey = getGroupKeyForMode(groupByMode, row, groupModeContext);
      const groupRows = rowsByGroupKey.get(groupKey) ?? [];

      groupRows.push(row);
      rowsByGroupKey.set(groupKey, groupRows);
    }

    const totalsByGroupKey = new Map<
      string,
      { paid: string; pending: string; total: string }
    >();

    for (const [groupKey, groupRows] of rowsByGroupKey) {
      totalsByGroupKey.set(
        groupKey,
        formatMonthlyTotalsBreakdown({
          currency: "ARS",
          exchangeRateSnapshot,
          rows: groupRows,
        }),
      );
    }

    return totalsByGroupKey;
  }, [
    exchangeRateSnapshot,
    foldersById,
    groupByMode,
    lenderNamesById,
    lenderTypesById,
    rowsForTable,
  ]);
  // Config de grupos para el DataTable. Memoizada para no invalidar la memo del
  // cuerpo de la tabla en cada render; `undefined` desactiva el agrupado.
  const rowGroups = useMemo(() => {
    if (groupByMode === "none") {
      return undefined;
    }

    const groupModeContext = { foldersById, lenderNamesById, lenderTypesById };
    const folderPositionById = new Map(
      expenseFolders.map((folder, folderIndex) => [folder.id, folderIndex]),
    );

    return {
      collapsedGroupKeys,
      onGroupToggle: handleGroupToggle,
      getGroupKey: (row: MonthlyExpensesEditableRow) =>
        getGroupKeyForMode(groupByMode, row, groupModeContext),
      getGroupSortValue: (row: MonthlyExpensesEditableRow) =>
        getGroupPositionForMode(groupByMode, row, {
          ...groupModeContext,
          folderPositionById,
        }),
      renderGroupHeader: (groupKey: string, groupRowCount: number) => {
        // El swatch de color/icono solo existe para carpetas; el resto de los
        // modos usa el pill con la etiqueta del grupo.
        const folder =
          groupByMode === "folder" && groupKey
            ? foldersById.get(groupKey) ?? null
            : null;
        const folderName = getGroupLabelForMode(
          groupByMode,
          groupKey,
          groupModeContext,
        );
        const groupRowCountLabel = `${groupRowCount} gasto${groupRowCount === 1 ? "" : "s"}`;
        const groupTotals = groupTotalsByKey?.get(groupKey) ?? null;

        return (
          <>
            <span
              aria-label={`Grupo ${folderName}: ${groupRowCountLabel}`}
              className={styles.groupHeaderPill}
              role="img"
            >
              {folder ? (
                <span
                  aria-hidden="true"
                  className={styles.groupHeaderSwatch}
                  style={{
                    backgroundColor: resolveExpenseFolderColorHex(folder.color),
                  }}
                >
                  <ExpenseFolderIconGlyph icon={folder.icon} size={12} stroke={2} />
                </span>
              ) : null}
              <span>{folderName}</span>
              <span className={styles.groupHeaderCount}>{groupRowCount}</span>
            </span>
            {groupTotals ? (
              // Fuera del nombre accesible del botón: el toggle sigue siendo
              // «Grupo X: N gastos»; el total es refuerzo visual.
              <span aria-hidden="true" className={styles.groupHeaderTotals}>
                <span className={styles.groupHeaderTotalAmount}>
                  {groupTotals.total}
                </span>
                <span className={styles.groupHeaderTotalsBreakdown}>
                  {"Pagado: "}
                  <span className={cn(styles.groupHeaderTotalsAmount, "text-green-700 dark:text-green-300")}>
                    {groupTotals.paid}
                  </span>
                  {" · Pendiente: "}
                  <span className={cn(styles.groupHeaderTotalsAmount, "text-yellow-700 dark:text-yellow-300")}>
                    {groupTotals.pending}
                  </span>
                </span>
              </span>
            ) : null}
          </>
        );
      },
    };
  }, [
    collapsedGroupKeys,
    expenseFolders,
    foldersById,
    groupByMode,
    groupTotalsByKey,
    handleGroupToggle,
    lenderNamesById,
    lenderTypesById,
  ]);
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

  const columns = useMemo<ColumnDef<MonthlyExpensesEditableRow>[]>(() => {
    const folderPositionById = new Map(
      expenseFolders.map((folder, folderIndex) => [folder.id, folderIndex]),
    );

    return [
      {
        // Columna fantasma del agrupado: invisible (visibility false, sin
        // header ni celda) y no ocultable desde el menú. Solo existe para que
        // TanStack ordene primero por posición de grupo (los "sin valor" al
        // final) y el orden del usuario aplique dentro de cada grupo.
        id: GROUP_POSITION_COLUMN_ID,
        // El accessor es un dummy: TanStack cachea los valores por fila
        // (_valuesCache) y al cambiar el modo de agrupado en runtime seguiría
        // ordenando con las posiciones del modo anterior. El sortingFn lee la
        // fila original en cada comparación, sin pasar por ese cache.
        accessorFn: () => 0,
        cell: () => null,
        enableHiding: false,
        header: () => null,
        sortingFn: (rowA, rowB) => {
          const activeGroupByMode =
            groupByMode === "none" ? "folder" : groupByMode;
          const groupPositionContext = {
            folderPositionById,
            foldersById,
            lenderNamesById,
            lenderTypesById,
          };
          const leftPosition = getGroupPositionForMode(
            activeGroupByMode,
            rowA.original,
            groupPositionContext,
          );
          const rightPosition = getGroupPositionForMode(
            activeGroupByMode,
            rowB.original,
            groupPositionContext,
          );

          if (leftPosition === rightPosition) {
            return 0;
          }

          return leftPosition < rightPosition ? -1 : 1;
        },
      },
      {
        id: BULK_SELECTION_COLUMN_ID,
        cell: ({ row }) => {
          const expenseDescription =
            row.original.description.trim() || "gasto sin descripción";
          const checkboxId = `bulk-selection-row-${row.original.id}`;

          return (
            <div className={styles.selectionCell}>
              <input
                aria-label={`Seleccionar gasto ${expenseDescription}`}
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
            row.original.description.trim() || "gasto";
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
              onDuplicate={() => onDuplicateExpense(row.original.id)}
              onDuplicateToNextMonth={() => {
                void onDuplicateExpenseToMonth({
                  expenseId: row.original.id,
                  targetMonth: getAdjacentYearMonth(month, 1) ?? month,
                });
              }}
              onDuplicateToPickedMonth={() => {
                setDuplicateToMonthDialogState({
                  expenseDescription: expenseDescriptionLabel,
                  expenseId: row.original.id,
                });
                setDuplicateToMonthDraftValue(getAdjacentYearMonth(month, 1) ?? month);
              }}
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
              {...(row.original.currency === "USD"
                ? {
                    onSelectUsdRateBase: (usdRateBase: MonthlyExpenseUsdRateBase) => {
                      if (usdRateBase === "custom") {
                        handleOpenCustomUsdRateDialog({
                          customUsdRate: row.original.usdRate.customRate,
                          expenseDescription: expenseDescriptionLabel,
                          expenseId: row.original.id,
                        });
                        return;
                      }

                      void onUpdateUsdRate({
                        expenseId: row.original.id,
                        usdRate: {
                          ...row.original.usdRate,
                          base: usdRateBase,
                          customRate: null,
                        },
                      });
                    },
                    onToggleUsdRateSurcharge: (surcharge: "iibb" | "iva") => {
                      void onUpdateUsdRate({
                        expenseId: row.original.id,
                        usdRate: {
                          ...row.original.usdRate,
                          ...(surcharge === "iibb"
                            ? { appliesIibb: !row.original.usdRate.appliesIibb }
                            : { appliesIva: !row.original.usdRate.appliesIva }),
                        },
                      });
                    },
                    usdRate: row.original.usdRate,
                  }
                : {})}
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

          const isRecurrenceCancelled = Boolean(
            row.original.recurrenceEndMonth,
          );
          const recurrenceIndicatorLabel = isRecurrenceCancelled
            ? "Recurrencia cancelada"
            : "Gasto recurrente";
          // Sin placeholder para gastos no recurrentes: las filas comunes no
          // reservan el espacio del ícono.
          const recurrenceIndicator = row.original.isRecurring ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={recurrenceIndicatorLabel}
                  className={cn(
                    styles.recurrenceIndicator,
                    isRecurrenceCancelled &&
                      styles.recurrenceIndicatorCancelled,
                  )}
                  role="img"
                >
                  <Repeat aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{recurrenceIndicatorLabel}</TooltipContent>
            </Tooltip>
          ) : null;

          const descriptionTextContent =
            paymentLinkAnchor || recurrenceIndicator ? (
              <span className={styles.descriptionTextRow}>
                {recurrenceIndicator}
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
            row.original.description.trim() || "gasto";
          const occurrencesPerMonth = Number(row.original.occurrencesPerMonth);
          const subtotalUnit = row.original.subtotalUnit ?? "occurrence";
          const hasSubtotalBreakdown =
            Number.isFinite(occurrencesPerMonth) &&
            (subtotalUnit === "hour" || occurrencesPerMonth !== 1);
          const formatRowArsAmount = (value: string) =>
            formatArsWithUsdSecondary({
              exchangeRateSnapshot,
              rowCurrency: row.original.currency,
              usdRate: row.original.usdRate,
              value,
            });

          const effectiveUsdRate =
            row.original.currency === "USD"
              ? getUsdRateForRow({
                  exchangeRateSnapshot,
                  usdRate: row.original.usdRate,
                })
              : null;
          const usdRateBadge =
            row.original.currency === "USD" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={styles.usdRateChip} variant="outline">
                    {getUsdRateBadgeLabel(row.original.usdRate)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {effectiveUsdRate != null
                    ? `1 USD = ${formatExchangeRateAmount(effectiveUsdRate)}`
                    : "Sin cotización disponible para convertir"}
                </TooltipContent>
              </Tooltip>
            ) : null;

          return (
            <div className={styles.totalCell}>
              <div className={styles.totalSummary}>
                <span className={styles.totalAmount}>
                  {formatRowArsAmount(row.original.total)}
                  {usdRateBadge}
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
        footer: ({ table }) => (
          <MonthlyTotalsFooter
            currency="ARS"
            exchangeRateSnapshot={exchangeRateSnapshot}
            rows={table.getFilteredRowModel().rows.map((row) => row.original)}
          />
        ),
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedNumberRangeFilter(
            filterValue,
            getArsComparableAmount({
              exchangeRateSnapshot,
              rowCurrency: row.original.currency,
              usdRate: row.original.usdRate,
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
              usdRate: rowA.original.usdRate,
              value: rowA.original.total,
            }),
            rightValue: getArsComparableAmount({
              exchangeRateSnapshot,
              rowCurrency: rowB.original.currency,
              usdRate: rowB.original.usdRate,
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
            usdRate: row.original.usdRate,
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
              usdRate: row.original.usdRate,
            }),
          ),
        footer: ({ table }) => (
          <MonthlyTotalsFooter
            currency="USD"
            exchangeRateSnapshot={exchangeRateSnapshot}
            rows={table.getFilteredRowModel().rows.map((row) => row.original)}
          />
        ),
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
            usdRate: rowA.original.usdRate,
          });
          const rightAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: rowB.original.currency,
            total: Number(rowB.original.total),
            usdRate: rowB.original.usdRate,
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
          const maxManualCoveredPayments = Math.max(
            requiredPayments - coveredPayments,
            0,
          );
          const expenseDescription = row.original.description.trim() || "gasto";

          return (
            <div className={styles.paymentsCell}>
              <span
                className={cn(
                  styles.paymentProgressPlain,
                  isComplete
                    ? "text-green-700 dark:text-green-300"
                    : "text-yellow-700 dark:text-yellow-300",
                )}
              >
                <ProgressRing fraction={completionFraction} />
                {normalizedCoveredPayments} / {requiredPayments}
              </span>
              {!isComplete ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={`Marcar ${expenseDescription} como pagado`}
                      className={styles.paymentLinkActionButton}
                      disabled={actionDisabled}
                      onClick={() => onMarkExpensePaid(row.original.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <CircleCheck aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Marcar como pagado</TooltipContent>
                </Tooltip>
              ) : null}
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
            </div>
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
        // Columna oculta: su celda vive unificada dentro de "Pagos", pero la
        // columna sigue existiendo (invisible, no ocultable y sin orden) solo
        // para que el qualifier `registros:` de la barra pueda filtrar.
        id: "paymentHistory",
        accessorFn: (row) => (row.paymentRecords ?? []).length,
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
        filterFn: (row, _columnId, filterValue) =>
          matchesAdvancedNumberRangeFilter(
            filterValue,
            (row.original.paymentRecords ?? []).length,
          ),
        header: () => null,
        meta: { label: "Registros" },
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
              applyUserSorting(buildLoanSortingState(direction));
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
        header: getSortableHeader("Contraparte"),
        meta: { label: "Contraparte" },
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
              applyUserSorting(buildVigenciaSortingState(direction));
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
    ];
  }, [
      actionDisabled,
      applyUserSorting,
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
      onDuplicateExpense,
      onEditReceiptCoverage,
      onEditManualPaymentRecord,
      onEditExpense,
      onMoveExpenseToFolder,
      onRegisterPaymentRecord,
      onUpdatePaymentRecordSendStatus,
      compareRowsByDescriptionFilterRelevance,
      handleOpenCustomUsdRateDialog,
      handleOpenDetailsDialog,
      handleOpenReceiptShareDialog,
      handleOpenPaymentLinkDialog,
      month,
      onDuplicateExpenseToMonth,
      onMarkExpensePaid,
      onUpdateUsdRate,
      selectedExpenseIdsInCurrentRows,
      expenseFolders,
      foldersById,
      groupByMode,
      lenderNamesById,
      lenderTypesById,
      vigenciaSortMode,
  ]);

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
              <div className={styles.monthNavRow}>
                <Button
                  aria-label="Mes anterior"
                  disabled={isMonthTransitionPending || !previousYearMonth}
                  onClick={() => {
                    if (previousYearMonth) {
                      onMonthChange(previousYearMonth);
                    }
                  }}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Input
                  className={styles.monthInput}
                  disabled={isMonthTransitionPending}
                  id="monthly-expenses-month"
                  onChange={(event) => onMonthChange(event.target.value)}
                  type="month"
                  value={month}
                />
                <Button
                  aria-label="Mes siguiente"
                  disabled={isMonthTransitionPending || !nextYearMonth}
                  onClick={() => {
                    if (nextYearMonth) {
                      onMonthChange(nextYearMonth);
                    }
                  }}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Ir al mes actual"
                  disabled={isMonthTransitionPending || isCurrentMonthVisible}
                  onClick={() => onMonthChange(currentYearMonth)}
                  type="button"
                  variant="outline"
                >
                  Hoy
                </Button>
              </div>
            </div>
            {exchangeRateSnapshot ? (
              <p className={styles.exchangeRateInline}>
                <span className={styles.exchangeRateInlineItem}>
                  Oficial:
                  <span className={styles.exchangeRateValue}>
                    {formatExchangeRateAmount(exchangeRateSnapshot.officialRate)}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span className={styles.exchangeRateInlineItem}>
                  Solidario:
                  <span className={styles.exchangeRateValue}>
                    {formatExchangeRateAmount(
                      exchangeRateSnapshot.solidarityRate,
                    )}
                  </span>
                </span>
              </p>
            ) : exchangeRateLoadError ? (
              <p className={styles.exchangeRateFallback}>
                {exchangeRateLoadError}
              </p>
            ) : null}
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

          <div className={styles.tableHeader}>
            <h2 className={cn(styles.tableTitle, styles.tableHeaderTitle)}>
              Detalle del mes
            </h2>
            <div className={cn(styles.tableAddAction, styles.tableHeaderAction)}>
              <Button
                className={styles.tableHeaderActionButton}
                disabled={actionDisabled || isMonthTransitionPending}
                onClick={onAddExpense}
                type="button"
              >
                Agregar gasto
              </Button>
              {expenseFolders.length === 0 ? (
                <Button
                  className={styles.tableHeaderActionButton}
                  onClick={onManageFolders}
                  type="button"
                  variant="outline"
                >
                  Administrar carpetas
                </Button>
              ) : null}
            </div>
            <section
              aria-label="Resumen del mes"
              className={cn(styles.monthSummary, styles.tableHeaderSummary)}
            >
              <div className={styles.monthSummaryCard}>
                <span className={styles.monthSummaryLabel}>Total</span>
                <span className={styles.monthSummaryValue}>
                  {monthSummaryTotals.total}
                </span>
              </div>
              <div className={styles.monthSummaryCard}>
                <span className={styles.monthSummaryLabel}>Pendiente</span>
                <span
                  className={cn(
                    styles.monthSummaryValue,
                    "text-yellow-700 dark:text-yellow-300",
                  )}
                >
                  {monthSummaryTotals.pending}
                </span>
              </div>
              <div className={styles.monthSummaryCard}>
                <span className={styles.monthSummaryLabel}>Pagado</span>
                <span
                  className={cn(
                    styles.monthSummaryValue,
                    "text-green-700 dark:text-green-300",
                  )}
                >
                  {monthSummaryTotals.paid}
                </span>
              </div>
            </section>
          </div>

          <div
            className={cn(
              styles.tableWrapper,
              isTableHorizontallyScrolled && styles.tableWrapperScrolled,
            )}
            ref={tableWrapperRef}
          >
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
              excludedFilterIds={folderBarSelection.excluded}
              folders={expenseFolders}
              includedFilterIds={folderBarSelection.included}
              onManageFolders={onManageFolders}
              onMoveExpenseToFolder={onMoveExpenseToFolder}
              onReorderFolders={onReorderFolders}
              onSelectFilter={handleFolderChipSelect}
              totalCount={folderCounts.totalCount}
              unassignedCount={folderCounts.unassignedCount}
            />
            <QuickAddExpenseForm
              actionDisabled={actionDisabled}
              onQuickAddExpense={onQuickAddExpense}
            />
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
                          aria-label={`Filtrar gasto ${expense.displayDescription}`}
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
            <DataTable
              columnVisibility={columnVisibility}
              columnVisibilityButtonLabel="Vista"
              columnVisibilityMenuLabel="Columnas"
              columnVisibilityMenuExtraContent={
                <DropdownMenuCheckboxItem
                  checked={moveCompletedToEnd}
                  disabled={hasUserSorting}
                  onCheckedChange={(nextChecked) => {
                    setMoveCompletedToEnd(Boolean(nextChecked));
                  }}
                  onSelect={(event) => {
                    event.preventDefault();
                  }}
                >
                  <span className={styles.viewMenuOption}>
                    {MOVE_COMPLETED_TO_END_LABEL}
                    {hasUserSorting ? (
                      <span className={styles.viewMenuOptionHint}>
                        {MANUAL_SORTING_DISABLED_HELPER_TEXT}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuCheckboxItem>
              }
              columns={columns}
              hideableColumnsDefaultVisibility={
                MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY
              }
              data={rowsForTable}
              emptyMessage={
                hasActiveFiltering
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
                <FilterPresetsBar
                  labels={MONTHLY_EXPENSES_FILTER_PRESET_LABELS}
                  onApplyPreset={handleApplyFilterPreset}
                  onDeletePreset={handleDeleteFilterPreset}
                  onUpdatePreset={handleUpdateFilterPreset}
                  presets={filterPresets}
                  queryFilterConfigs={monthlyExpensesFilterQualifiers}
                />
              )}
              filterLabel="Filtrar gastos"
              filterPlaceholder="Filtrar gastos por descripción"
              filterValue={descriptionFilter}
              onExcludeFilterValuesChange={setExcludedDescriptionFilters}
              getRowClassName={getMonthlyExpenseRowClassName}
              onCellClick={handleTableCellClick}
              onAppliedFiltersChange={setQueryAppliedFilters}
              queryFilterControlsRef={queryFilterControlsRef}
              queryFilterTrailingAction={
                <FilterPresetSaveButton
                  className="active:-translate-y-0"
                  labels={MONTHLY_EXPENSES_FILTER_PRESET_LABELS}
                  canSaveCurrentQuery={hasActiveFiltering}
                  onSaveCurrentQuery={handleSaveFilterPreset}
                />
              }
              onFilterValueChange={setDescriptionFilter}
              onVisibleRowsChange={handleVisibleRowsChange}
              onColumnVisibilityChange={setColumnVisibility}
              onSortingChange={handleSortingChange}
              sortingBadgeIgnoredColumnIds={SORTING_BADGE_IGNORED_COLUMN_IDS}
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
              rowGroups={rowGroups}
              toolbarActions={
                <>
                  {/* Keys estables: son hermanos del mismo tipo y uno es
                      controlado; sin key, React puede reutilizar la instancia
                      controlada como no controlada al reconciliar. */}
                  <DropdownMenu key="sort-by-menu">
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline">
                        {primaryUserSortingEntry
                          ? `Ordenar por: ${
                              primaryUserSortingEntry.id === LOAN_SORT_COLUMN_ID
                                ? getLoanSortModeLabel(loanSortMode)
                                : SORT_LABELS_BY_COLUMN_ID[
                                    primaryUserSortingEntry.id
                                  ] ?? primaryUserSortingEntry.id
                            }`
                          : "Ordenar por"}
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup
                        onValueChange={(nextValue) => {
                          if (!(nextValue in SORT_LABELS_BY_COLUMN_ID)) {
                            applyUserSorting([]);
                            return;
                          }

                          applyUserSorting([
                            {
                              desc: primaryUserSortingEntry?.desc ?? false,
                              id: nextValue,
                            },
                          ]);
                        }}
                        value={primaryUserSortingEntry?.id ?? "none"}
                      >
                        <DropdownMenuRadioItem
                          onSelect={(event) => {
                            event.preventDefault();
                          }}
                          value="none"
                        >
                          Sin ordenar
                        </DropdownMenuRadioItem>
                        {SORT_MENU_OPTIONS.map((sortMenuOption) => (
                          <Fragment key={sortMenuOption.id}>
                            <DropdownMenuRadioItem
                              onSelect={(event) => {
                                event.preventDefault();
                              }}
                              value={sortMenuOption.id}
                            >
                              {sortMenuOption.label}
                            </DropdownMenuRadioItem>
                            {sortMenuOption.id === "paymentsProgress" ? (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  Deuda / cuotas
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuRadioGroup
                                    onValueChange={(nextLoanSortMode) => {
                                      setLoanSortMode(
                                        nextLoanSortMode as LoanSortMode,
                                      );
                                      applyUserSorting([
                                        {
                                          desc:
                                            primaryUserSortingEntry?.desc ??
                                            false,
                                          id: LOAN_SORT_COLUMN_ID,
                                        },
                                      ]);
                                    }}
                                    value={
                                      primaryUserSortingEntry?.id ===
                                      LOAN_SORT_COLUMN_ID
                                        ? loanSortMode
                                        : ""
                                    }
                                  >
                                    {LOAN_SORT_OPTIONS.map((loanSortOption) => (
                                      <DropdownMenuRadioItem
                                        key={loanSortOption.value}
                                        onSelect={(event) => {
                                          event.preventDefault();
                                        }}
                                        value={loanSortOption.value}
                                      >
                                        {loanSortOption.label}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            ) : null}
                          </Fragment>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Dirección</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        onValueChange={(nextValue) => {
                          if (!primaryUserSortingEntry) {
                            return;
                          }

                          applyUserSorting(
                            userSortingEntries.map((sortingEntry, index) =>
                              index === 0
                                ? {
                                    ...sortingEntry,
                                    desc: nextValue === "desc",
                                  }
                                : sortingEntry,
                            ),
                          );
                        }}
                        value={primaryUserSortingEntry?.desc ? "desc" : "asc"}
                      >
                        <DropdownMenuRadioItem
                          onSelect={(event) => {
                            event.preventDefault();
                          }}
                          value="asc"
                        >
                          Ascendente
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem
                          onSelect={(event) => {
                            event.preventDefault();
                          }}
                          value="desc"
                        >
                          Descendente
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu key="group-by-menu">
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline">
                        {groupByMode !== "none"
                          ? `Agrupar por: ${GROUP_BY_MODE_LABELS[groupByMode]}`
                          : "Agrupar por"}
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup
                        onValueChange={(nextValue) => {
                          handleGroupByModeChange(
                            GROUP_BY_MODE_MENU_OPTIONS.some(
                              (groupByOption) =>
                                groupByOption.value === nextValue,
                            )
                              ? (nextValue as MonthlyExpensesGroupByMode)
                              : "none",
                          );
                        }}
                        value={groupByMode}
                      >
                        <DropdownMenuRadioItem
                          onSelect={(event) => {
                            event.preventDefault();
                          }}
                          value="none"
                        >
                          Sin agrupar
                        </DropdownMenuRadioItem>
                        {GROUP_BY_MODE_MENU_OPTIONS.map((groupByOption) => (
                          <DropdownMenuRadioItem
                            key={groupByOption.value}
                            onSelect={(event) => {
                              event.preventDefault();
                            }}
                            value={groupByOption.value}
                          >
                            {groupByOption.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu
                    key="bulk-actions-menu"
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
                        setIsBulkMoveToFolderDialogOpen(true);
                      }}
                    >
                      Mover a carpeta
                    </DropdownMenuItem>
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
                </>
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
                {`Se eliminarán ${selectedVisibleCount} gasto${selectedVisibleCount === 1 ? " seleccionado" : "s seleccionados"} de la tabla visible.`}
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
          onOpenChange={handleBulkMoveToFolderDialogOpenChange}
          open={isBulkMoveToFolderDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover gastos a una carpeta</DialogTitle>
              <DialogDescription>
                {`Se moverán ${selectedVisibleCount} gasto${selectedVisibleCount === 1 ? " seleccionado" : "s seleccionados"} a la carpeta elegida.`}
              </DialogDescription>
            </DialogHeader>
            <ExpenseFolderPicker
              onManageFolders={onManageFolders}
              onSelect={setBulkMoveTargetFolderId}
              options={expenseFolders}
              selectedFolderId={bulkMoveTargetFolderId ?? ""}
            />
            <DialogFooter>
              <Button
                onClick={() => handleBulkMoveToFolderDialogOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={actionDisabled || isSubmitting}
                onClick={() => {
                  void handleConfirmBulkMoveToFolder();
                }}
                type="button"
              >
                Mover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          {...(sheetMode === "edit" && draft
            ? {
                onOpenExpenseDetails: () =>
                  handleOpenDetailsDialog({
                    currency: draft.currency,
                    expenseDescription:
                      draft.description.trim() || "este gasto",
                    expenseId: draft.id,
                    occurrencesPerMonth: draft.occurrencesPerMonth,
                    occurrencesUnit: draft.occurrencesUnit,
                    subtotal: draft.subtotal,
                    subtotalUnit: draft.subtotalUnit ?? "occurrence",
                  }),
              }
            : {})}
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
                  ? `Actualizá el subtotal por hora y la duración mensual de ${detailsDialogState?.expenseDescription ?? "este gasto"}.`
                  : `Actualizá el subtotal, su unidad y la cantidad mensual de ${detailsDialogState?.expenseDescription ?? "este gasto"}.`}
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
                  aria-label={`Subtotal de ${detailsDialogState?.expenseDescription ?? "gasto"}`}
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
                  aria-label={`Unidad del subtotal de ${detailsDialogState?.expenseDescription ?? "gasto"}`}
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
                  durationHoursAriaLabel={`Duración mensual en horas de ${detailsDialogState?.expenseDescription ?? "gasto"}`}
                  durationMinutesAriaLabel={`Duración mensual en minutos de ${detailsDialogState?.expenseDescription ?? "gasto"}`}
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
                  aria-label={`Cantidad por mes de ${detailsDialogState?.expenseDescription ?? "gasto"}`}
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
                {`Completá WhatsApp y mensaje opcional para ${receiptShareDialogState?.expenseDescription ?? "este gasto"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="receipt-share-phone-dialog-input">
                Número de WhatsApp
              </Label>
              <Input
                aria-invalid={receiptShareDraftError ? "true" : "false"}
                aria-label={`Número de WhatsApp de ${receiptShareDialogState?.expenseDescription ?? "gasto"}`}
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
                aria-label={`Mensaje opcional de ${receiptShareDialogState?.expenseDescription ?? "gasto"}`}
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
                {`Completá el link para ${paymentLinkDialogState?.expenseDescription ?? "este gasto"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="payment-link-dialog-input">Link de pago</Label>
              <Textarea
                aria-invalid={paymentLinkDraftError ? "true" : "false"}
                aria-label={`Link de pago de ${paymentLinkDialogState?.expenseDescription ?? "gasto"}`}
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

        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDuplicateToMonthDialogState(null);
            }
          }}
          open={duplicateToMonthDialogState != null}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicar en otro mes</AlertDialogTitle>
              <AlertDialogDescription>
                {`Elegí el mes donde duplicar ${duplicateToMonthDialogState?.expenseDescription ?? "este gasto"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="duplicate-to-month-dialog-input">Mes destino</Label>
              <Input
                aria-label={`Mes destino para duplicar ${duplicateToMonthDialogState?.expenseDescription ?? "gasto"}`}
                id="duplicate-to-month-dialog-input"
                onChange={(event) =>
                  setDuplicateToMonthDraftValue(event.target.value)
                }
                type="month"
                value={duplicateToMonthDraftValue}
              />
            </div>

            <AlertDialogFooter className={styles.paymentLinkDialogActions}>
              <Button
                onClick={() => setDuplicateToMonthDialogState(null)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  actionDisabled ||
                  !YEAR_MONTH_PATTERN.test(duplicateToMonthDraftValue)
                }
                onClick={() => {
                  if (!duplicateToMonthDialogState) {
                    return;
                  }

                  void onDuplicateExpenseToMonth({
                    expenseId: duplicateToMonthDialogState.expenseId,
                    targetMonth: duplicateToMonthDraftValue,
                  });
                  setDuplicateToMonthDialogState(null);
                }}
                type="button"
              >
                Duplicar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              handleCloseCustomUsdRateDialog();
            }
          }}
          open={customUsdRateDialogState != null}
        >
          <AlertDialogContent
            onOpenAutoFocus={(event) => {
              handleDialogInputAutoFocus(event, "custom-usd-rate-dialog-input");
            }}
            size="sm"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Cotización personalizada</AlertDialogTitle>
              <AlertDialogDescription>
                {`Ingresá cuántos pesos vale 1 USD para ${customUsdRateDialogState?.expenseDescription ?? "este gasto"}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className={styles.paymentLinkDialogField}>
              <Label htmlFor="custom-usd-rate-dialog-input">
                Cotización (ARS por USD)
              </Label>
              <Input
                aria-invalid={customUsdRateDraftError ? "true" : "false"}
                aria-label={`Cotización personalizada de ${customUsdRateDialogState?.expenseDescription ?? "gasto"}`}
                autoFocus
                id="custom-usd-rate-dialog-input"
                inputMode="decimal"
                onChange={(event) => {
                  setCustomUsdRateDraftValue(event.target.value);

                  if (customUsdRateDraftError) {
                    setCustomUsdRateDraftError(null);
                  }
                }}
                placeholder="1480,50"
                value={customUsdRateDraftValue}
              />
              {customUsdRateDraftError ? (
                <p className={styles.paymentLinkDialogError} role="alert">
                  {customUsdRateDraftError}
                </p>
              ) : null}
            </div>

            <AlertDialogFooter className={styles.paymentLinkDialogActions}>
              <Button
                onClick={handleCloseCustomUsdRateDialog}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={actionDisabled}
                onClick={() => {
                  void handleSaveCustomUsdRate();
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
