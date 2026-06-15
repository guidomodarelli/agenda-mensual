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
export const DEFAULT_OCCURRENCES_UNIT_SINGULAR = "vez";
export const MAX_OCCURRENCES_UNIT_LENGTH = 40;
export const MAX_OCCURRENCES_PERIODICITY_LENGTH = 24;
export const MAX_OCCURRENCE_DURATION_HOURS = 99;
export const MAX_OCCURRENCE_DURATION_MINUTES = 59;

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

/**
 * Formats an hours/minutes pair into the canonical duration label used inside
 * the unit string. Extra minutes carry over into hours (e.g. 4h 90 → 5h 30).
 *
 * @param hours - Whole hours (>= 0).
 * @param minutes - Whole minutes (>= 0).
 * @returns "4h 30", "4h", "30 min", or "" when the duration is zero.
 */
export function formatOccurrenceDuration(
  hours: number,
  minutes: number,
): string {
  const safeHours = Number.isFinite(hours) ? Math.max(0, Math.trunc(hours)) : 0;
  const safeMinutes = Number.isFinite(minutes)
    ? Math.max(0, Math.trunc(minutes))
    : 0;
  const totalMinutes = safeHours * 60 + safeMinutes;

  if (totalMinutes <= 0) {
    return "";
  }

  const normalizedHours = Math.floor(totalMinutes / 60);
  const normalizedMinutes = totalMinutes % 60;

  if (normalizedHours > 0 && normalizedMinutes > 0) {
    return `${normalizedHours}h ${normalizedMinutes}`;
  }

  if (normalizedHours > 0) {
    return `${normalizedHours}h`;
  }

  return `${normalizedMinutes} min`;
}

/**
 * Parses a stored duration label back into its hours/minutes parts. Tolerates
 * the canonical formats ("4h 30", "4h", "30 min") and legacy values ("30'").
 *
 * @param duration - Duration label extracted from the unit string.
 * @returns The hours and minutes parts (0 when absent).
 */
export function parseOccurrenceDuration(duration: string): {
  hours: number;
  minutes: number;
} {
  const normalizedDuration = duration.trim();

  if (!normalizedDuration) {
    return { hours: 0, minutes: 0 };
  }

  const hoursMatch = normalizedDuration.match(/(\d+)\s*h/i);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;

  const minutesSource = hoursMatch
    ? normalizedDuration.slice(hoursMatch.index! + hoursMatch[0].length)
    : normalizedDuration;
  const minutesMatch = minutesSource.match(/(\d+)/);
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;

  return { hours, minutes };
}

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
 * Formats a stored duration into its display label, suffixing minutes with "m"
 * (e.g. "4h 30m", "4h", "30m"). Returns "" when there is no duration.
 *
 * @param duration - Duration part extracted from the unit string.
 * @returns The human-readable duration label.
 */
function formatOccurrenceDurationDisplay(duration: string): string {
  const { hours, minutes } = parseOccurrenceDuration(duration);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "";
}

/**
 * Builds the full quantity-multiplier label shown next to the subtotal, e.g.
 * "× 2 veces de 4h 30m" or "× 1 vez de 4h 30m". The default unit is pluralized
 * by count ("vez" when the quantity is one, "veces" otherwise); custom units are
 * rendered as stored. The optional per-occurrence duration is appended after a
 * " de " separator. The duration never affects the monthly total.
 *
 * @param occurrencesPerMonth - Monthly quantity multiplier.
 * @param occurrencesUnit - Stored unit string (may carry a duration).
 * @returns The label to render in the UI.
 */
export function formatOccurrencesMultiplierLabel(
  occurrencesPerMonth: number,
  occurrencesUnit: string,
): string {
  const { duration, periodicity } = splitOccurrencesUnit(occurrencesUnit);
  const resolvedPeriodicity = periodicity || DEFAULT_OCCURRENCES_UNIT;
  const periodicityLabel =
    resolvedPeriodicity === DEFAULT_OCCURRENCES_UNIT && occurrencesPerMonth === 1
      ? DEFAULT_OCCURRENCES_UNIT_SINGULAR
      : resolvedPeriodicity;
  const durationLabel = formatOccurrenceDurationDisplay(duration);
  const multiplierLabel = `× ${occurrencesPerMonth} ${periodicityLabel}`;

  return durationLabel
    ? `${multiplierLabel}${OCCURRENCES_UNIT_DURATION_SEPARATOR}${durationLabel}`
    : multiplierLabel;
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
