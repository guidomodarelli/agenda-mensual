import type { DataTableColumnFilterValue } from "@/components/ui/data-table";

/**
 * Matches a numeric value against an advanced number-range filter. Returns
 * `true` (no-op) when the filter is not a number range.
 */
export function matchesAdvancedNumberRangeFilter(
  columnFilterValue: unknown,
  value: number | null,
): boolean {
  if (
    !columnFilterValue ||
    typeof columnFilterValue !== "object" ||
    (columnFilterValue as DataTableColumnFilterValue).kind !== "numberRange"
  ) {
    return true;
  }

  const filterValue = columnFilterValue as Extract<
    DataTableColumnFilterValue,
    { kind: "numberRange" }
  >;

  if (value == null || !Number.isFinite(value)) {
    return false;
  }

  if (filterValue.min != null && value < filterValue.min) {
    return false;
  }

  if (filterValue.max != null && value > filterValue.max) {
    return false;
  }

  return true;
}

/**
 * Matches a presence flag against an advanced presence filter. Returns `true`
 * (no-op) when the filter is not a presence filter.
 */
export function matchesAdvancedPresenceFilter(
  columnFilterValue: unknown,
  hasValue: boolean,
): boolean {
  if (
    !columnFilterValue ||
    typeof columnFilterValue !== "object" ||
    (columnFilterValue as DataTableColumnFilterValue).kind !== "presence"
  ) {
    return true;
  }

  const filterValue = columnFilterValue as Extract<
    DataTableColumnFilterValue,
    { kind: "presence" }
  >;

  return filterValue.value === "hasValue" ? hasValue : !hasValue;
}

/**
 * Matches a string value against an advanced enum filter. Returns `true`
 * (no-op) when the filter is not an enum filter.
 */
export function matchesAdvancedEnumFilter(
  columnFilterValue: unknown,
  value: string,
): boolean {
  if (
    !columnFilterValue ||
    typeof columnFilterValue !== "object" ||
    (columnFilterValue as DataTableColumnFilterValue).kind !== "enum"
  ) {
    return true;
  }

  const filterValue = columnFilterValue as Extract<
    DataTableColumnFilterValue,
    { kind: "enum" }
  >;

  return filterValue.value === value;
}
