import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  composeOccurrencesUnit,
  CUSTOM_OCCURRENCES_UNIT_VALUE,
  formatOccurrenceDuration,
  isPredefinedOccurrencesUnit,
  MAX_OCCURRENCE_DURATION_HOURS,
  MAX_OCCURRENCE_DURATION_MINUTES,
  MAX_OCCURRENCES_PERIODICITY_LENGTH,
  OCCURRENCES_UNIT_OPTION_GROUPS,
  parseOccurrenceDuration,
  splitOccurrencesUnit,
} from "./occurrences-unit";
import styles from "./occurrences-unit-select.module.scss";

interface OccurrencesUnitSelectProps {
  customInputAriaLabel: string;
  durationHoursAriaLabel: string;
  durationMinutesAriaLabel: string;
  hasError?: boolean;
  isChanged?: boolean;
  onChange: (value: string) => void;
  selectAriaLabel: string;
  selectId?: string;
  value: string;
}

const CUSTOM_OPTION_LABEL = "Otra…";

function toDurationInputValue(part: number): string {
  return part > 0 ? String(part) : "";
}

/**
 * Select to pick the unit that labels the monthly quantity multiplier.
 *
 * Offers grouped predefined periodicities plus a free-text "Otra…" option and an
 * optional per-occurrence duration entered with two numeric inputs (hours and
 * minutes), e.g. "veces de 4h 30". The unit is only a display label; it never
 * affects the monthly total. The combined value is emitted as a single string.
 */
export function OccurrencesUnitSelect({
  customInputAriaLabel,
  durationHoursAriaLabel,
  durationMinutesAriaLabel,
  hasError = false,
  isChanged = false,
  onChange,
  selectAriaLabel,
  selectId,
  value,
}: OccurrencesUnitSelectProps) {
  const initialParts = splitOccurrencesUnit(value);
  const initialDuration = parseOccurrenceDuration(initialParts.duration);
  const [periodicity, setPeriodicity] = useState(initialParts.periodicity);
  const [hours, setHours] = useState(() =>
    toDurationInputValue(initialDuration.hours),
  );
  const [minutes, setMinutes] = useState(() =>
    toDurationInputValue(initialDuration.minutes),
  );
  const [isCustomMode, setIsCustomMode] = useState(
    () =>
      initialParts.periodicity !== "" &&
      !isPredefinedOccurrencesUnit(initialParts.periodicity),
  );
  const fieldId = useId();
  const selectValue = isCustomMode
    ? CUSTOM_OCCURRENCES_UNIT_VALUE
    : isPredefinedOccurrencesUnit(periodicity)
      ? periodicity
      : "";

  const emit = (
    nextPeriodicity: string,
    nextHours: string,
    nextMinutes: string,
  ) => {
    const duration = formatOccurrenceDuration(
      Number(nextHours) || 0,
      Number(nextMinutes) || 0,
    );

    onChange(composeOccurrencesUnit(nextPeriodicity, duration));
  };

  const handleSelectValueChange = (nextValue: string) => {
    if (nextValue === CUSTOM_OCCURRENCES_UNIT_VALUE) {
      setIsCustomMode(true);
      setPeriodicity("");
      emit("", hours, minutes);
      return;
    }

    setIsCustomMode(false);
    setPeriodicity(nextValue);
    emit(nextValue, hours, minutes);
  };

  const handleCustomPeriodicityChange = (nextPeriodicity: string) => {
    setPeriodicity(nextPeriodicity);
    emit(nextPeriodicity, hours, minutes);
  };

  const handleHoursChange = (nextHours: string) => {
    setHours(nextHours);
    emit(periodicity, nextHours, minutes);
  };

  const handleMinutesChange = (nextMinutes: string) => {
    setMinutes(nextMinutes);
    emit(periodicity, hours, nextMinutes);
  };

  return (
    <div className={styles.container}>
      <Select onValueChange={handleSelectValueChange} value={selectValue}>
        <SelectTrigger
          aria-label={selectAriaLabel}
          className={cn(isChanged && styles.changedField)}
          id={selectId}
        >
          <SelectValue placeholder="Elegí una unidad" />
        </SelectTrigger>
        <SelectContent>
          {OCCURRENCES_UNIT_OPTION_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectGroup>
            <SelectItem value={CUSTOM_OCCURRENCES_UNIT_VALUE}>
              {CUSTOM_OPTION_LABEL}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {isCustomMode ? (
        <Input
          aria-invalid={hasError ? "true" : "false"}
          aria-label={customInputAriaLabel}
          className={cn(hasError && styles.invalidField)}
          maxLength={MAX_OCCURRENCES_PERIODICITY_LENGTH}
          onChange={(event) => handleCustomPeriodicityChange(event.target.value)}
          placeholder="Ej: viajes"
          type="text"
          value={periodicity}
        />
      ) : null}

      <div className={styles.durationField}>
        <span className={styles.durationLabel}>
          Duración por ocurrencia (opcional)
        </span>
        <div className={styles.durationInputs}>
          <div className={styles.durationInput}>
            <Input
              aria-label={durationHoursAriaLabel}
              id={`${fieldId}-hours`}
              inputMode="numeric"
              max={MAX_OCCURRENCE_DURATION_HOURS}
              min="0"
              onChange={(event) => handleHoursChange(event.target.value)}
              placeholder="0"
              step="1"
              type="number"
              value={hours}
            />
            <Label className={styles.durationUnit} htmlFor={`${fieldId}-hours`}>
              h
            </Label>
          </div>
          <div className={styles.durationInput}>
            <Input
              aria-label={durationMinutesAriaLabel}
              id={`${fieldId}-minutes`}
              inputMode="numeric"
              max={MAX_OCCURRENCE_DURATION_MINUTES}
              min="0"
              onChange={(event) => handleMinutesChange(event.target.value)}
              placeholder="0"
              step="1"
              type="number"
              value={minutes}
            />
            <Label
              className={styles.durationUnit}
              htmlFor={`${fieldId}-minutes`}
            >
              min
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
