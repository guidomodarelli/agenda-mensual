import { useState } from "react";

import { Input } from "@/components/ui/input";
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
  CUSTOM_OCCURRENCES_UNIT_VALUE,
  isPredefinedOccurrencesUnit,
  MAX_OCCURRENCES_UNIT_LENGTH,
  OCCURRENCES_UNIT_OPTION_GROUPS,
} from "./occurrences-unit";
import styles from "./occurrences-unit-select.module.scss";

interface OccurrencesUnitSelectProps {
  customInputAriaLabel: string;
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
 * Offers grouped predefined units plus a free-text "Otra…" option. The unit is
 * only a display label; it never affects the monthly total.
 */
export function OccurrencesUnitSelect({
  customInputAriaLabel,
  hasError = false,
  isChanged = false,
  onChange,
  selectAriaLabel,
  selectId,
  value,
}: OccurrencesUnitSelectProps) {
  const [isCustomMode, setIsCustomMode] = useState(
    () => value.trim() !== "" && !isPredefinedOccurrencesUnit(value),
  );
  const selectValue = isCustomMode
    ? CUSTOM_OCCURRENCES_UNIT_VALUE
    : isPredefinedOccurrencesUnit(value)
      ? value.trim()
      : "";

  const handleSelectValueChange = (nextValue: string) => {
    if (nextValue === CUSTOM_OCCURRENCES_UNIT_VALUE) {
      setIsCustomMode(true);
      onChange("");
      return;
    }

    setIsCustomMode(false);
    onChange(nextValue);
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
          maxLength={MAX_OCCURRENCES_UNIT_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ej: clases"
          type="text"
          value={value}
        />
      ) : null}
    </div>
  );
}
