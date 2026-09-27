import { parseFilterPresets, type FilterPreset } from "beez-ui";

export const MONTHLY_EXPENSES_FILTER_PRESETS_STORAGE_KEY =
  "control-mensual.monthly-expenses.filter-presets";

/**
 * Reads and validates the persisted filter presets from localStorage, dropping
 * malformed entries.
 *
 * @returns The restored presets, or an empty list on the server or when
 *   nothing valid is stored.
 */
export function getPersistedMonthlyExpensesFilterPresets(): FilterPreset[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const serializedPresets = window.localStorage.getItem(
      MONTHLY_EXPENSES_FILTER_PRESETS_STORAGE_KEY,
    );

    return serializedPresets ? parseFilterPresets(JSON.parse(serializedPresets)) : [];
  } catch {
    return [];
  }
}

/**
 * Persists the given filter presets to localStorage, silently ignoring
 * storage failures (private mode, disabled storage, etc.).
 */
export function persistMonthlyExpensesFilterPresets(
  presets: readonly FilterPreset[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      MONTHLY_EXPENSES_FILTER_PRESETS_STORAGE_KEY,
      JSON.stringify(presets),
    );
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.)
  }
}
