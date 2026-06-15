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
  isPredefinedOccurrencesUnit,
  MAX_OCCURRENCES_DURATION_LENGTH,
  MAX_OCCURRENCES_PERIODICITY_LENGTH,
  OCCURRENCES_DURATION_SUGGESTIONS,
  OCCURRENCES_UNIT_OPTION_GROUPS,
  splitOccurrencesUnit,
} from "./occurrences-unit";
import styles from "./occurrences-unit-select.module.scss";

interface OccurrencesUnitSelectProps {
  customInputAriaLabel: string;
  durationInputAriaLabel: string;
  hasError?: boolean;
  isChanged?: boolean;
  onChange: (value: string) => void;
  selectAriaLabel: string;
  selectId?: string;
  value: string;
}

const CUSTOM_OPTION_LABEL = "Otra…";

/**
 * Select to pick the unit that labels the monthly quantity multiplier.
 *
 * Offers grouped predefined periodicities plus a free-text "Otra…" option and an
 * optional per-occurrence duration (e.g. "veces de 30'"). The unit is only a
 * display label; it never affects the monthly total. The combined value is
 * emitted as a single string through `onChange`.
 */
export function OccurrencesUnitSelect({
  customInputAriaLabel,
  durationInputAriaLabel,
  hasError = false,
  isChanged = false,
  onChange,
  selectAriaLabel,
  selectId,
  value,
}: OccurrencesUnitSelectProps) {
  const initialParts = splitOccurrencesUnit(value);
  const [periodicity, setPeriodicity] = useState(initialParts.periodicity);
  const [duration, setDuration] = useState(initialParts.duration);
  const [isCustomMode, setIsCustomMode] = useState(
    () =>
      initialParts.periodicity !== "" &&
      !isPredefinedOccurrencesUnit(initialParts.periodicity),
  );
  const durationListId = useId();
  const selectValue = isCustomMode
    ? CUSTOM_OCCURRENCES_UNIT_VALUE
    : isPredefinedOccurrencesUnit(periodicity)
      ? periodicity
      : "";

  const emit = (nextPeriodicity: string, nextDuration: string) => {
    onChange(composeOccurrencesUnit(nextPeriodicity, nextDuration));
  };

  const handleSelectValueChange = (nextValue: string) => {
    if (nextValue === CUSTOM_OCCURRENCES_UNIT_VALUE) {
      setIsCustomMode(true);
      setPeriodicity("");
      emit("", duration);
      return;
    }

    setIsCustomMode(false);
    setPeriodicity(nextValue);
    emit(nextValue, duration);
  };

  const handleCustomPeriodicityChange = (nextPeriodicity: string) => {
    setPeriodicity(nextPeriodicity);
    emit(nextPeriodicity, duration);
  };

  const handleDurationChange = (nextDuration: string) => {
    setDuration(nextDuration);
    emit(periodicity, nextDuration);
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
        <Label className={styles.durationLabel} htmlFor={`${durationListId}-input`}>
          Duración por ocurrencia (opcional)
        </Label>
        <Input
          aria-label={durationInputAriaLabel}
          id={`${durationListId}-input`}
          list={durationListId}
          maxLength={MAX_OCCURRENCES_DURATION_LENGTH}
          onChange={(event) => handleDurationChange(event.target.value)}
          placeholder="Ej: 30', 1h, 1h 30"
          type="text"
          value={duration}
        />
        <datalist id={durationListId}>
          {OCCURRENCES_DURATION_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
