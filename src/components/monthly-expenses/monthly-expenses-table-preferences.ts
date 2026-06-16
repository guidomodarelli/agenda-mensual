import type { SortingState, VisibilityState } from "@tanstack/react-table";

import {
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
  LOAN_SORT_COLUMN_ID,
} from "./monthly-expenses-table-column-ids";
import type {
  LoanSortMode,
  VigenciaSortMode,
} from "./monthly-expenses-table.types";

const MONTHLY_EXPENSES_TABLE_PREFERENCES_STORAGE_KEY =
  "control-mensual.monthly-expenses.table-preferences";

export const DEFAULT_LOAN_SORT_MODE: LoanSortMode = "paidInstallments";

export const DEFAULT_VIGENCIA_SORT_MODE: VigenciaSortMode = "startMonth";

export const MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  usd: false,
};

// Column ids accepted when restoring persisted sorting/visibility.
const SORTABLE_COLUMN_IDS = new Set([
  "description",
  "paymentsProgress",
  "paymentHistory",
  "subtotal",
  "total",
  "usd",
  LOAN_SORT_COLUMN_ID,
  "lenderName",
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
]);

const PERSISTABLE_COLUMN_VISIBILITY_IDS = new Set([
  "paymentsProgress",
  "paymentHistory",
  "subtotal",
  "total",
  "usd",
  LOAN_SORT_COLUMN_ID,
  "lenderName",
  LOAN_INSTALLMENT_RANGE_COLUMN_ID,
]);

export interface MonthlyExpensesTablePreferences {
  columnVisibility: VisibilityState;
  loanSortMode: LoanSortMode;
  moveCompletedToEnd: boolean;
  sorting: SortingState;
  vigenciaSortMode: VigenciaSortMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePersistedLoanSortMode(value: unknown): LoanSortMode | null {
  if (
    value !== "paidInstallments" &&
    value !== "remainingInstallments" &&
    value !== "totalInstallments"
  ) {
    return null;
  }

  return value;
}

function parsePersistedVigenciaSortMode(
  value: unknown,
): VigenciaSortMode | null {
  if (value !== "startMonth" && value !== "endMonth") {
    return null;
  }

  return value;
}

function parsePersistedMoveCompletedToEnd(value: unknown): boolean {
  return value === true;
}

function parsePersistedSorting(value: unknown): SortingState | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsedSorting: SortingState = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const id = entry.id;
    const desc = entry.desc;

    if (
      typeof id !== "string" ||
      typeof desc !== "boolean" ||
      !SORTABLE_COLUMN_IDS.has(id)
    ) {
      continue;
    }

    parsedSorting.push({
      desc,
      id,
    });
  }

  return parsedSorting;
}

function parsePersistedColumnVisibility(value: unknown): VisibilityState | null {
  if (!isRecord(value)) {
    return null;
  }

  const parsedColumnVisibility: VisibilityState = {};

  for (const [columnId, isVisible] of Object.entries(value)) {
    if (
      !PERSISTABLE_COLUMN_VISIBILITY_IDS.has(columnId) ||
      typeof isVisible !== "boolean"
    ) {
      continue;
    }

    parsedColumnVisibility[columnId] = isVisible;
  }

  return parsedColumnVisibility;
}

/**
 * Reads and validates the persisted table preferences from localStorage,
 * falling back to defaults for any missing or malformed field.
 *
 * @returns The restored preferences, or `null` on the server or when nothing
 *   valid is stored.
 */
export function getPersistedMonthlyExpensesTablePreferences(): MonthlyExpensesTablePreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const serializedPreferences = window.localStorage.getItem(
      MONTHLY_EXPENSES_TABLE_PREFERENCES_STORAGE_KEY,
    );

    if (!serializedPreferences) {
      return null;
    }

    const parsedPreferences = JSON.parse(serializedPreferences);

    if (!isRecord(parsedPreferences)) {
      return null;
    }

    const loanSortMode =
      parsePersistedLoanSortMode(parsedPreferences.loanSortMode) ??
      DEFAULT_LOAN_SORT_MODE;
    const vigenciaSortMode =
      parsePersistedVigenciaSortMode(parsedPreferences.vigenciaSortMode) ??
      DEFAULT_VIGENCIA_SORT_MODE;
    const moveCompletedToEnd = parsePersistedMoveCompletedToEnd(
      parsedPreferences.moveCompletedToEnd,
    );
    const sorting = parsePersistedSorting(parsedPreferences.sorting) ?? [];
    const parsedColumnVisibility =
      parsePersistedColumnVisibility(parsedPreferences.columnVisibility) ?? {};
    const columnVisibility: VisibilityState = {
      ...MONTHLY_EXPENSES_DEFAULT_COLUMN_VISIBILITY,
      ...parsedColumnVisibility,
    };

    return {
      columnVisibility,
      loanSortMode,
      moveCompletedToEnd,
      sorting,
      vigenciaSortMode,
    };
  } catch {
    return null;
  }
}

/**
 * Persists the given table preferences to localStorage, silently ignoring
 * storage failures (private mode, disabled storage, etc.).
 */
export function persistMonthlyExpensesTablePreferences(
  preferences: MonthlyExpensesTablePreferences,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      MONTHLY_EXPENSES_TABLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.)
  }
}
