/**
 * Predefined units used to label the monthly quantity multiplier (occurrencesPerMonth).
 *
 * The unit is only a descriptive label: the monthly total is always
 * `subtotal × occurrencesPerMonth`, regardless of the chosen unit. The persisted
 * value is a free string, so these options are UI suggestions, not an enum.
 *
 * The unit represents a periodicity WITHIN the month (how the quantity recurs in
 * a single month), so options that exceed a month (months, years) or that are
 * inherently monthly (installments) are intentionally excluded.
 *
 * The stored string may also carry an optional per-occurrence duration after a
 * " de " separator, e.g. `"veces de 30'"` (9 times of 30 minutes each). Duration
 * is still part of the label and never affects the monthly total.
 *
 * NOTE: `MAX_OCCURRENCES_UNIT_LENGTH` mirrors the domain guard in
 * `monthly-expenses-document.ts`. The hexagonal boundary forbids components from
 * importing the domain layer, so both constants are kept intentionally in sync.
 */

export const DEFAULT_OCCURRENCES_UNIT = "veces";
export const MAX_OCCURRENCES_UNIT_LENGTH = 40;
export const MAX_OCCURRENCES_PERIODICITY_LENGTH = 24;
export const MAX_OCCURRENCES_DURATION_LENGTH = 12;

/** Separator between the periodicity unit and its optional per-occurrence duration. */
export const OCCURRENCES_UNIT_DURATION_SEPARATOR = " de ";

/** Sentinel value for the "Otra…" (free text) option inside the unit select. */
export const CUSTOM_OCCURRENCES_UNIT_VALUE = "__custom__";

export interface OccurrencesUnitOptionGroup {
  label: string;
  options: string[];
}

export const OCCURRENCES_UNIT_OPTION_GROUPS: OccurrencesUnitOptionGroup[] = [
  {
    label: "Ocurrencias",
    options: ["veces", "pagos", "sesiones", "clases"],
  },
  {
    label: "Tiempo",
    options: ["días", "semanas"],
  },
];

export const OCCURRENCES_UNIT_OPTIONS: string[] =
  OCCURRENCES_UNIT_OPTION_GROUPS.flatMap((group) => group.options);

/** Common per-occurrence durations suggested in the duration input. */
export const OCCURRENCES_DURATION_SUGGESTIONS: string[] = [
  "30'",
  "45'",
  "1h",
  "1h 30",
  "2h",
];

/**
 * Resolves the unit to display next to the quantity multiplier, falling back to
 * the default unit when none was stored.
 *
 * @param occurrencesUnit - Stored unit value (may be empty).
 * @returns The unit to render in the UI.
 */
export function resolveOccurrencesUnitLabel(occurrencesUnit: string): string {
  const normalizedOccurrencesUnit = occurrencesUnit.trim();

  return normalizedOccurrencesUnit || DEFAULT_OCCURRENCES_UNIT;
}

/**
 * Indicates whether a periodicity unit belongs to the predefined suggestion list.
 *
 * @param periodicity - Periodicity value to check (without duration).
 * @returns True when the periodicity is one of the predefined options.
 */
export function isPredefinedOccurrencesUnit(periodicity: string): boolean {
  return OCCURRENCES_UNIT_OPTIONS.includes(periodicity.trim());
}

/**
 * Builds the stored unit string from its periodicity and optional duration parts.
 * When only a duration is provided, the default periodicity is assumed so the
 * label still reads naturally (e.g. `"veces de 30'"`).
 *
 * @param periodicity - Periodicity unit (e.g. "veces", "semanas").
 * @param duration - Optional per-occurrence duration (e.g. "30'", "1h 30").
 * @returns The combined unit string, or an empty string when there is nothing to label.
 */
export function composeOccurrencesUnit(
  periodicity: string,
  duration: string,
): string {
  const normalizedDuration = duration.trim();
  const normalizedPeriodicity =
    periodicity.trim() || (normalizedDuration ? DEFAULT_OCCURRENCES_UNIT : "");

  if (!normalizedPeriodicity) {
    return "";
  }

  return normalizedDuration
    ? `${normalizedPeriodicity}${OCCURRENCES_UNIT_DURATION_SEPARATOR}${normalizedDuration}`
    : normalizedPeriodicity;
}

/**
 * Splits a stored unit string into its periodicity and duration parts.
 *
 * @param occurrencesUnit - Stored unit string (e.g. "veces de 30'").
 * @returns The periodicity and duration parts (duration is "" when absent).
 */
export function splitOccurrencesUnit(occurrencesUnit: string): {
  duration: string;
  periodicity: string;
} {
  const normalizedOccurrencesUnit = occurrencesUnit.trim();
  const separatorIndex = normalizedOccurrencesUnit.indexOf(
    OCCURRENCES_UNIT_DURATION_SEPARATOR,
  );

  if (separatorIndex === -1) {
    return { duration: "", periodicity: normalizedOccurrencesUnit };
  }

  return {
    duration: normalizedOccurrencesUnit
      .slice(separatorIndex + OCCURRENCES_UNIT_DURATION_SEPARATOR.length)
      .trim(),
    periodicity: normalizedOccurrencesUnit.slice(0, separatorIndex).trim(),
  };
}
