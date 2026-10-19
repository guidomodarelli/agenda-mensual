import {
  Button,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
} from "@golfo/ui";
import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import type { MonthlyExpenseCurrency } from "./monthly-expenses-table.types";
import { QUICK_ADD_CURRENCY_OPTIONS } from "./select-options.constants";
import styles from "./quick-add-expense-form.module.scss";

interface QuickAddExpenseFormProps {
  actionDisabled: boolean;
  /**
   * Creates the expense with quick-add defaults (once a month, no folder) in
   * the chosen currency. The caller applies it optimistically, so the form
   * clears right away and more expenses can be chained.
   */
  onQuickAddExpense: (args: {
    currency: MonthlyExpenseCurrency;
    description: string;
    subtotal: number;
  }) => void;
}

export function QuickAddExpenseForm({
  actionDisabled,
  onQuickAddExpense,
}: QuickAddExpenseFormProps) {
  const [descriptionValue, setDescriptionValue] = useState("");
  const [subtotalValue, setSubtotalValue] = useState("");
  const [currencyValue, setCurrencyValue] =
    useState<MonthlyExpenseCurrency>("ARS");
  const [validationError, setValidationError] = useState<string | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedDescription = descriptionValue.trim();
    const normalizedSubtotal = Number(
      subtotalValue.trim().replace(",", "."),
    );

    if (!normalizedDescription) {
      setValidationError("Completá la descripción.");
      return;
    }

    if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal <= 0) {
      setValidationError("Ingresá un monto mayor a 0.");
      return;
    }

    setValidationError(null);
    onQuickAddExpense({
      currency: currencyValue,
      description: normalizedDescription,
      subtotal: normalizedSubtotal,
    });
    setDescriptionValue("");
    setSubtotalValue("");
    descriptionInputRef.current?.focus();
  };

  return (
    <form
      aria-label="Alta rápida de gasto"
      className={styles.quickAddForm}
      onSubmit={handleSubmit}
    >
      <Select
        className={styles.quickAddCurrency}
        disabled={actionDisabled}
        hideLabel
        label="Moneda del gasto nuevo"
        onValueChange={(nextCurrency) =>
          setCurrencyValue(nextCurrency as MonthlyExpenseCurrency)
        }
        options={QUICK_ADD_CURRENCY_OPTIONS}
        value={currencyValue}
      />
      <InputGroup className={styles.quickAddAmount}>
        <InputGroupAddon align="inline-start" aria-hidden="true">
          {currencyValue === "USD" ? "US$" : "$"}
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Monto del gasto nuevo"
          disabled={actionDisabled}
          inputMode="decimal"
          onChange={(event) => {
            setSubtotalValue(event.target.value);

            if (validationError) {
              setValidationError(null);
            }
          }}
          placeholder="0"
          type="text"
          value={subtotalValue}
        />
      </InputGroup>
      <Input
        aria-label="Descripción del gasto nuevo"
        className={styles.quickAddDescription}
        disabled={actionDisabled}
        onChange={(event) => {
          setDescriptionValue(event.target.value);

          if (validationError) {
            setValidationError(null);
          }
        }}
        placeholder="Alta rápida: descripción"
        ref={descriptionInputRef}
        type="text"
        value={descriptionValue}
      />
      <Button
        className={styles.quickAddSubmit}
        disabled={actionDisabled}
        size="sm"
        type="submit"
        variant="secondary"
      >
        <Plus aria-hidden="true" />
        Agregar
      </Button>
      {validationError ? (
        <p className={styles.quickAddError} role="alert">
          {validationError}
        </p>
      ) : null}
    </form>
  );
}
