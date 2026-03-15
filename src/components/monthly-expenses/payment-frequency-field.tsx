import { useId, useState, type ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import styles from "./payment-frequency-field.module.scss";

type PaymentFrequencyMode = "single" | "multiple";

interface PaymentFrequencyFieldProps {
  hasError: boolean;
  isChanged: boolean;
  occurrencesPerMonth: string;
  onOccurrencesPerMonthChange: (value: string) => void;
}

function isPositiveInteger(value: string): boolean {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0;
}

function getInitialMode(occurrencesPerMonth: string): PaymentFrequencyMode {
  return Number(occurrencesPerMonth) > 1 ? "multiple" : "single";
}

function getInitialMultipleOccurrences(occurrencesPerMonth: string): string {
  if (isPositiveInteger(occurrencesPerMonth) && Number(occurrencesPerMonth) > 1) {
    return String(Number(occurrencesPerMonth));
  }

  return "1";
}

export function PaymentFrequencyField({
  hasError,
  isChanged,
  occurrencesPerMonth,
  onOccurrencesPerMonthChange,
}: PaymentFrequencyFieldProps) {
  const [mode, setMode] = useState<PaymentFrequencyMode>(() =>
    getInitialMode(occurrencesPerMonth),
  );
  const [lastMultipleOccurrences, setLastMultipleOccurrences] = useState(() =>
    getInitialMultipleOccurrences(occurrencesPerMonth),
  );
  const inputIdBase = useId();
  const singleOptionId = `${inputIdBase}-single`;
  const multipleOptionId = `${inputIdBase}-multiple`;
  const occurrencesInputId = `${inputIdBase}-occurrences`;
  const showOccurrencesInput = mode === "multiple";

  const handleModeChange = (nextMode: string) => {
    if (nextMode === "multiple") {
      setMode("multiple");
      onOccurrencesPerMonthChange(lastMultipleOccurrences);
      return;
    }

    if (
      isPositiveInteger(occurrencesPerMonth) &&
      Number(occurrencesPerMonth) > 1
    ) {
      setLastMultipleOccurrences(String(Number(occurrencesPerMonth)));
    }

    setMode("single");
    onOccurrencesPerMonthChange("1");
  };

  const handleOccurrencesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    onOccurrencesPerMonthChange(nextValue);

    if (isPositiveInteger(nextValue)) {
      setLastMultipleOccurrences(String(Number(nextValue)));
    }
  };

  return (
    <div className={styles.container}>
      <RadioGroup
        className={styles.options}
        onValueChange={handleModeChange}
        value={mode}
      >
        <div
          className={cn(
            styles.option,
            mode === "single" && styles.optionSelected,
          )}
        >
          <div className={styles.optionHeader}>
            <RadioGroupItem id={singleOptionId} value="single" />
            <Label className={styles.optionLabel} htmlFor={singleOptionId}>
              Un único pago al mes
            </Label>
          </div>
          <p className={styles.optionDescription}>
            Ejemplos: alquiler, expensas, agua, energia electrica o servicios
            urbanos.
          </p>
        </div>

        <div
          className={cn(
            styles.option,
            mode === "multiple" && styles.optionSelected,
          )}
        >
          <div className={styles.optionHeader}>
            <RadioGroupItem id={multipleOptionId} value="multiple" />
            <Label className={styles.optionLabel} htmlFor={multipleOptionId}>
              Se paga varias veces en el mes
            </Label>
          </div>
          <p className={styles.optionDescription}>
            Ejemplos: clases de ingles, psicologa o empleada domestica. Si
            trabaja 2 veces por semana, podes cargar 8 por mes.
          </p>
        </div>
      </RadioGroup>

      {showOccurrencesInput ? (
        <div className={styles.occurrencesField}>
          <Label htmlFor={occurrencesInputId}>Veces al mes</Label>
          <Input
            aria-label="Veces al mes"
            className={cn(hasError && styles.invalidField, isChanged && styles.changedField)}
            data-changed={isChanged ? "true" : "false"}
            id={occurrencesInputId}
            inputMode="numeric"
            min="0"
            onChange={handleOccurrencesChange}
            placeholder="Ej: 8"
            step="1"
            type="number"
            value={occurrencesPerMonth}
          />
        </div>
      ) : (
        <p className={styles.singleFrequencyHint}>
          Se asume automáticamente 1 vez por mes.
        </p>
      )}
    </div>
  );
}
