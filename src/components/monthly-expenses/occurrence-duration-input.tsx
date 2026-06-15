import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  composeOccurrencesUnit,
  formatOccurrenceDuration,
  MAX_OCCURRENCE_DURATION_HOURS,
  MAX_OCCURRENCE_DURATION_MINUTES,
  parseOccurrenceDuration,
  splitOccurrencesUnit,
} from "./occurrences-unit";
import styles from "./occurrence-duration-input.module.scss";

const DEFAULT_DURATION_LABEL = "Duración por ocurrencia (opcional)";

interface OccurrenceDurationInputProps {
  durationHoursAriaLabel: string;
  durationMinutesAriaLabel: string;
  isChanged?: boolean;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}

function toDurationInputValue(part: number): string {
  return part > 0 ? String(part) : "";
}

/**
 * Inputs to set the optional per-occurrence duration of the monthly quantity
 * multiplier, entered as two numeric fields (hours and minutes), e.g. "4h 30".
 *
 * The duration is stored inside the `occurrencesUnit` string after the periodicity
 * label (e.g. "veces de 4h 30"). This component never lets the user change the
 * periodicity: it preserves whatever periodicity the value already carries (or the
 * default "veces" when none is set) and only edits the duration part. The combined
 * value is emitted as a single string. Duration is only a label; it never affects
 * the monthly total.
 */
export function OccurrenceDurationInput({
  durationHoursAriaLabel,
  durationMinutesAriaLabel,
  isChanged = false,
  label = DEFAULT_DURATION_LABEL,
  onChange,
  value,
}: OccurrenceDurationInputProps) {
  const initialParts = splitOccurrencesUnit(value);
  const initialDuration = parseOccurrenceDuration(initialParts.duration);
  const [periodicity] = useState(initialParts.periodicity);
  const [hours, setHours] = useState(() =>
    toDurationInputValue(initialDuration.hours),
  );
  const [minutes, setMinutes] = useState(() =>
    toDurationInputValue(initialDuration.minutes),
  );
  const fieldId = useId();

  const emit = (nextHours: string, nextMinutes: string) => {
    const duration = formatOccurrenceDuration(
      Number(nextHours) || 0,
      Number(nextMinutes) || 0,
    );

    onChange(composeOccurrencesUnit(periodicity, duration));
  };

  const handleHoursChange = (nextHours: string) => {
    setHours(nextHours);
    emit(nextHours, minutes);
  };

  const handleMinutesChange = (nextMinutes: string) => {
    setMinutes(nextMinutes);
    emit(hours, nextMinutes);
  };

  return (
    <div className={styles.container}>
      <span className={styles.durationLabel}>{label}</span>
      <div className={styles.durationInputs}>
        <div className={styles.durationInput}>
          <Input
            aria-label={durationHoursAriaLabel}
            className={cn(isChanged && styles.changedField)}
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
            className={cn(isChanged && styles.changedField)}
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
          <Label className={styles.durationUnit} htmlFor={`${fieldId}-minutes`}>
            min
          </Label>
        </div>
      </div>
    </div>
  );
}
