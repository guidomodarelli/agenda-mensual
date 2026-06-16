import type { SortingState } from "@tanstack/react-table";

/** Resolves the current sort direction for a column from the sorting state. */
export function getColumnSortDirection(
  sorting: SortingState,
  columnId: string,
): "asc" | "desc" {
  const sortEntry = sorting.find((entry) => entry.id === columnId);

  if (!sortEntry) {
    return "asc";
  }

  return sortEntry.desc ? "desc" : "asc";
}

function normalizeSortToken(value: string): string {
  return value.toLowerCase().replace(/[.\s/_-]+/g, "");
}

/**
 * Decides whether a value should be treated as missing for sorting purposes
 * (nullish, non-finite, blank, or an explicit "N/A" token).
 */
export function isInvalidSortValue(value: unknown): boolean {
  if (value == null) {
    return true;
  }

  if (typeof value === "number") {
    return !Number.isFinite(value);
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return true;
    }

    const normalizedToken = normalizeSortToken(normalizedValue);

    return normalizedToken === "noaplica" || normalizedToken === "na";
  }

  return false;
}

/**
 * Comparator that always sorts invalid/missing values last regardless of the
 * sort direction, delegating valid-vs-valid ordering to `compareValidValues`.
 */
export function compareValuesKeepingInvalidLast<TValue>({
  compareValidValues,
  leftValue,
  rightValue,
  sortDirection,
}: {
  compareValidValues: (
    leftValue: NonNullable<TValue>,
    rightValue: NonNullable<TValue>,
  ) => number;
  leftValue: TValue;
  rightValue: TValue;
  sortDirection: "asc" | "desc";
}): number {
  const leftIsInvalid = isInvalidSortValue(leftValue);
  const rightIsInvalid = isInvalidSortValue(rightValue);

  if (leftIsInvalid && rightIsInvalid) {
    return 0;
  }

  if (leftIsInvalid && !rightIsInvalid) {
    return sortDirection === "desc" ? -1 : 1;
  }

  if (!leftIsInvalid && rightIsInvalid) {
    return sortDirection === "desc" ? 1 : -1;
  }

  return compareValidValues(
    leftValue as NonNullable<TValue>,
    rightValue as NonNullable<TValue>,
  );
}
