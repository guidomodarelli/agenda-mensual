/**
 * Predefined units used to label the monthly quantity multiplier (occurrencesPerMonth).
 *
 * The unit is only a descriptive label: the monthly total is always
 * `subtotal × occurrencesPerMonth`, regardless of the chosen unit. The persisted
 * value is a free string, so these options are UI suggestions, not an enum.
 *
 * NOTE: `MAX_OCCURRENCES_UNIT_LENGTH` mirrors the domain guard in
 * `monthly-expenses-document.ts`. The hexagonal boundary forbids components from
 * importing the domain layer, so both constants are kept intentionally in sync.
 */

export const DEFAULT_OCCURRENCES_UNIT = "veces";
export const MAX_OCCURRENCES_UNIT_LENGTH = 24;

/** Sentinel value for the "Otra…" (free text) option inside the unit select. */
export const CUSTOM_OCCURRENCES_UNIT_VALUE = "__custom__";

export interface OccurrencesUnitOptionGroup {
  label: string;
  options: string[];
}

export const OCCURRENCES_UNIT_OPTION_GROUPS: OccurrencesUnitOptionGroup[] = [
  {
    label: "Ocurrencias",
    options: ["veces", "pagos", "cuotas", "sesiones", "clases"],
  },
  {
    label: "Tiempo",
    options: ["minutos", "horas", "días", "semanas", "meses", "años"],
  },
];

export const OCCURRENCES_UNIT_OPTIONS: string[] =
  OCCURRENCES_UNIT_OPTION_GROUPS.flatMap((group) => group.options);

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
 * Indicates whether a unit belongs to the predefined suggestion list.
 *
 * @param occurrencesUnit - Unit value to check.
 * @returns True when the unit is one of the predefined options.
 */
export function isPredefinedOccurrencesUnit(occurrencesUnit: string): boolean {
  return OCCURRENCES_UNIT_OPTIONS.includes(occurrencesUnit.trim());
}
