import { useEffect, useMemo, useState } from "react";
import { Info, Link2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  LenderPicker,
  type LenderOption,
} from "./lender-picker";
import { LoanInfoPopover } from "./loan-info-popover";
import { PaymentFrequencyField } from "./payment-frequency-field";
import type { MonthlyExpensesEditableRow } from "./monthly-expenses-table";
import styles from "./expense-sheet.module.scss";

export type ExpenseEditableFieldName =
  | "currency"
  | "description"
  | "installmentCount"
  | "occurrencesPerMonth"
  | "paymentLink"
  | "startMonth"
  | "subtotal";

interface ExpenseSheetProps {
  actionDisabled: boolean;
  changedFields: Set<string>;
  draft: MonthlyExpensesEditableRow | null;
  isOpen: boolean;
  isSubmitting: boolean;
  lenders: LenderOption[];
  mode: "create" | "edit";
  onFieldChange: (fieldName: ExpenseEditableFieldName, value: string) => void;
  onLenderSelect: (lenderId: string | null) => void;
  onLoanToggle: (checked: boolean) => void;
  onRequestClose: () => void;
  onSave: () => void;
  onUnsavedChangesClose: () => void;
  onUnsavedChangesDiscard: () => void;
  onUnsavedChangesSave: () => void;
  showUnsavedChangesDialog: boolean;
  validationMessage: string | null;
}

type ExpenseSheetContentProps = Omit<ExpenseSheetProps, "draft"> & {
  draft: MonthlyExpensesEditableRow;
};

type ExpenseFieldErrorMap = Partial<Record<ExpenseEditableFieldName, string>>;
type ExpenseSheetFormValues = Record<ExpenseEditableFieldName, string>;

const INSTALLMENT_COUNT_SUGGESTIONS = ["3", "6", "9", "12", "18", "24"];
const PAYMENT_LINK_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PAYMENT_LINK_URL_SCHEMA = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});

function getFieldLabel(label: string, isChanged: boolean) {
  return (
    <span className={styles.fieldLabelRow}>
      <span
        className={cn(
          styles.fieldLabelText,
          isChanged && styles.changedFieldLabel,
        )}
      >
        {label}
      </span>
    </span>
  );
}

function normalizeCurrencyInput(value: string): string {
  const sanitizedValue = value.replace(/[^\d,.-]/g, "");

  if (!sanitizedValue) {
    return "";
  }

  const hasCommaDecimalSeparator = sanitizedValue.includes(",");

  if (!hasCommaDecimalSeparator) {
    return sanitizedValue.replace(/[^\d-]/g, "");
  }

  const decimalSeparatorIndex = sanitizedValue.lastIndexOf(",");
  const integerPart = sanitizedValue.slice(0, decimalSeparatorIndex);
  const decimalPart = sanitizedValue.slice(decimalSeparatorIndex + 1);
  const normalizedIntegerPart = integerPart.replace(/[^\d-]/g, "");
  const normalizedDecimalPart = decimalPart.replace(/[^\d]/g, "").slice(0, 2);

  if (normalizedDecimalPart.length === 0) {
    return `${normalizedIntegerPart}.`;
  }

  return `${normalizedIntegerPart}.${normalizedDecimalPart}`;
}

function formatCurrencyDisplay(value: string): string {
  const normalizedValue = /^-?\d+\.(\d{1,2})?$/.test(value)
    ? value
    : normalizeCurrencyInput(value);

  if (!normalizedValue) {
    return "";
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  if (normalizedValue.endsWith(".")) {
    return `${new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 0,
    }).format(numericValue)},`;
  }

  const [, decimalPart = ""] = normalizedValue.split(".");
  const normalizedDecimalPart = decimalPart.slice(0, 2);
  const minimumFractionDigits =
    normalizedDecimalPart.length === 0 || /^0+$/.test(normalizedDecimalPart)
      ? 0
      : normalizedDecimalPart.length;

  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: Math.max(minimumFractionDigits, 0),
    minimumFractionDigits,
  }).format(numericValue);
}

function getExpenseSheetFormValues(
  draft: MonthlyExpensesEditableRow,
): ExpenseSheetFormValues {
  return {
    currency: draft.currency,
    description: draft.description,
    installmentCount: draft.installmentCount,
    occurrencesPerMonth: draft.occurrencesPerMonth,
    paymentLink: draft.paymentLink,
    startMonth: draft.startMonth,
    subtotal: draft.subtotal,
  };
}

function isValidHttpPaymentLink(value: string): boolean {
  try {
    const normalizedValue = value.trim();
    const paymentLinkWithProtocol = PAYMENT_LINK_PROTOCOL_PATTERN.test(
      normalizedValue,
    )
      ? normalizedValue
      : `https://${normalizedValue}`;
    PAYMENT_LINK_URL_SCHEMA.parse(paymentLinkWithProtocol);
    return true;
  } catch {
    return false;
  }
}

function getFieldErrors(draft: MonthlyExpensesEditableRow): ExpenseFieldErrorMap {
  const fieldErrors: ExpenseFieldErrorMap = {};
  const subtotal = Number(draft.subtotal);
  const occurrencesPerMonth = Number(draft.occurrencesPerMonth);
  const installmentCount = Number(draft.installmentCount);

  if (!draft.description.trim()) {
    fieldErrors.description = "Completá la descripción.";
  }

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    fieldErrors.subtotal = "Ingresá un subtotal mayor a 0.";
  }

  if (!Number.isInteger(occurrencesPerMonth) || occurrencesPerMonth <= 0) {
    fieldErrors.occurrencesPerMonth = "Ingresá una cantidad mayor a 0.";
  }

  const normalizedPaymentLink = draft.paymentLink.trim();

  if (
    normalizedPaymentLink.length > 0 &&
    !isValidHttpPaymentLink(normalizedPaymentLink)
  ) {
    fieldErrors.paymentLink =
      "Ingresá un link válido con dominio (por ejemplo, ejemplo.com).";
  }

  if (draft.isLoan && !draft.startMonth.trim()) {
    fieldErrors.startMonth = "Completá la fecha de inicio.";
  }

  if (draft.isLoan && (!Number.isInteger(installmentCount) || installmentCount <= 0)) {
    fieldErrors.installmentCount = "Completá la cantidad total de cuotas.";
  }

  return fieldErrors;
}

export function ExpenseSheet({
  draft,
  ...props
}: ExpenseSheetProps) {
  if (!draft) {
    return null;
  }

  return <ExpenseSheetContent {...props} draft={draft} />;
}

function ExpenseSheetContent({
  actionDisabled,
  changedFields,
  draft,
  isOpen,
  isSubmitting,
  lenders,
  mode,
  onFieldChange,
  onLenderSelect,
  onLoanToggle,
  onRequestClose,
  onSave,
  onUnsavedChangesClose,
  onUnsavedChangesDiscard,
  onUnsavedChangesSave,
  showUnsavedChangesDialog,
  validationMessage,
}: ExpenseSheetContentProps) {

  const title = mode === "create" ? "Nuevo gasto" : "Editar gasto";
  const description =
    mode === "create"
      ? "Completá y guardá este gasto del mes."
      : "Editá y guardá los cambios de este gasto.";
  const loanHelpMessage =
    "Marcá esta opción si el gasto corresponde a una deuda.";
  const hasPendingChanges = changedFields.size > 0;
  const currencyPrefix = draft.currency === "USD" ? "US$" : "$";
  const totalFormulaSubtotalAmount =
    formatCurrencyDisplay(draft.subtotal).trim() || "X";
  const totalFormulaSubtotal = `${currencyPrefix} ${totalFormulaSubtotalAmount}`;
  const totalFormulaOccurrences = draft.occurrencesPerMonth.trim() || "Y";
  const form = useForm<ExpenseSheetFormValues>({
    values: getExpenseSheetFormValues(draft),
  });
  const fieldErrors = useMemo(() => getFieldErrors(draft), [draft]);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const shouldShowValidation = hasAttemptedSave;
  const lenderIsMissing = draft.isLoan && !draft.lenderId.trim();
  const lenderFieldError =
    shouldShowValidation && lenderIsMissing
      ? "Seleccioná un prestador."
      : null;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0 || lenderIsMissing;
  const shouldShowGlobalValidation =
    shouldShowValidation && Boolean(validationMessage) && !hasFieldErrors;

  const handleSaveAttempt = () => {
    setHasAttemptedSave(true);
    onSave();
  };

  useEffect(() => {
    form.clearErrors();

    if (!shouldShowValidation) {
      return;
    }

    (Object.entries(fieldErrors) as [ExpenseEditableFieldName, string][]).forEach(
      ([fieldName, message]) => {
        form.setError(fieldName, {
          message,
          type: "manual",
        });
      },
    );
  }, [fieldErrors, form, shouldShowValidation]);

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onRequestClose();
          }
        }}
        open={isOpen}
      >
        <DialogContent
          className={styles.content}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
          showCloseButton={false}
        >
          <DialogHeader className={styles.header}>
            <div className={styles.headerTopRow}>
              <div>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </div>
              <Button
                aria-label="Cerrar formulario de gasto"
                className={styles.closeButton}
                onClick={onRequestClose}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </DialogHeader>

          <Form {...form}>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveAttempt();
              }}
            >
              {shouldShowGlobalValidation ? (
                <p className={cn(styles.feedback, styles.errorText)} role="alert">
                  {validationMessage}
                </p>
              ) : null}

              <div className={cn(styles.grid, styles.topGrid)}>
                <FormField
                  control={form.control}
                  name="description"
                  render={() => (
                    <FormItem className={cn(styles.fieldGroup, styles.fullWidthField)}>
                      <FormLabel>
                        {getFieldLabel("Descripción", changedFields.has("description"))}
                      </FormLabel>
                      <div className={styles.fieldControlWrapper}>
                        <FormControl>
                          <Input
                            aria-label="Descripción"
                            className={cn(
                              shouldShowValidation &&
                                fieldErrors.description &&
                                styles.invalidField,
                              changedFields.has("description") && styles.changedField,
                            )}
                            data-changed={
                              changedFields.has("description") ? "true" : "false"
                            }
                            onChange={(event) =>
                              onFieldChange("description", event.target.value)
                            }
                            placeholder="Ej. agua, expensas, alquiler"
                            type="text"
                            value={draft.description}
                          />
                        </FormControl>
                        <FormMessage className={styles.fieldErrorText} />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={() => (
                    <FormItem className={styles.fieldGroup}>
                      <FormLabel>
                        {getFieldLabel("Moneda", changedFields.has("currency"))}
                      </FormLabel>
                      <div className={styles.fieldControlWrapper}>
                        <Select
                          onValueChange={(value) => onFieldChange("currency", value)}
                          value={draft.currency}
                        >
                          <FormControl>
                            <SelectTrigger
                              aria-label="Moneda"
                              className={cn(
                                changedFields.has("currency") && styles.changedField,
                              )}
                              data-changed={
                                changedFields.has("currency") ? "true" : "false"
                              }
                            >
                              <SelectValue placeholder="Moneda" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ARS">Peso argentino (ARS)</SelectItem>
                            <SelectItem value="USD">Dolar estadounidense (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className={styles.fieldErrorText} />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentLink"
                  render={() => (
                    <FormItem className={cn(styles.fieldGroup, styles.fullWidthField)}>
                      <FormLabel>
                        {getFieldLabel(
                          "Link de pago (Opcional)",
                          changedFields.has("paymentLink"),
                        )}
                      </FormLabel>
                      <div className={styles.fieldControlWrapper}>
                        <InputGroup
                          className={cn(
                            shouldShowValidation &&
                              fieldErrors.paymentLink &&
                              styles.invalidField,
                            changedFields.has("paymentLink") && styles.changedField,
                          )}
                          data-changed={
                            changedFields.has("paymentLink") ? "true" : "false"
                          }
                        >
                          <InputGroupAddon align="inline-start" aria-hidden="true">
                            <Link2 className={styles.inputAddonIcon} />
                          </InputGroupAddon>
                          <FormControl>
                            <InputGroupInput
                              aria-label="Link de pago"
                              data-changed={
                                changedFields.has("paymentLink") ? "true" : "false"
                              }
                              onChange={(event) =>
                                onFieldChange("paymentLink", event.target.value)
                              }
                              placeholder="https://..."
                              type="url"
                              value={draft.paymentLink}
                            />
                          </FormControl>
                        </InputGroup>
                        <FormMessage className={styles.fieldErrorText} />
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className={cn(styles.grid, styles.amountGrid)}>
                <FormField
                  control={form.control}
                  name="subtotal"
                  render={() => (
                    <FormItem className={styles.fieldGroup}>
                      <FormLabel>
                        {getFieldLabel("Subtotal", changedFields.has("subtotal"))}
                      </FormLabel>
                      <div className={styles.fieldControlWrapper}>
                        <InputGroup
                          className={cn(
                            shouldShowValidation &&
                              fieldErrors.subtotal &&
                              styles.invalidField,
                            changedFields.has("subtotal") && styles.changedField,
                          )}
                          data-changed={
                            changedFields.has("subtotal") ? "true" : "false"
                          }
                        >
                          <InputGroupAddon align="inline-start" aria-hidden="true">
                            {currencyPrefix}
                          </InputGroupAddon>
                          <FormControl>
                            <InputGroupInput
                              aria-label="Subtotal"
                              data-changed={
                                changedFields.has("subtotal") ? "true" : "false"
                              }
                              inputMode="decimal"
                              onChange={(event) =>
                                onFieldChange(
                                  "subtotal",
                                  normalizeCurrencyInput(event.target.value),
                                )
                              }
                              type="text"
                              value={formatCurrencyDisplay(draft.subtotal)}
                            />
                          </FormControl>
                        </InputGroup>
                        <FormMessage className={styles.fieldErrorText} />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="occurrencesPerMonth"
                  render={() => (
                    <FormItem className={styles.fieldGroup}>
                      <FormLabel>
                        {getFieldLabel(
                          "Frecuencia de pago",
                          changedFields.has("occurrencesPerMonth"),
                        )}
                      </FormLabel>
                      <div className={styles.fieldControlWrapper}>
                        <FormControl>
                          <PaymentFrequencyField
                            key={draft.id}
                            hasError={
                              shouldShowValidation &&
                              Boolean(fieldErrors.occurrencesPerMonth)
                            }
                            isChanged={changedFields.has("occurrencesPerMonth")}
                            occurrencesPerMonth={draft.occurrencesPerMonth}
                            onOccurrencesPerMonthChange={(value) =>
                              onFieldChange("occurrencesPerMonth", value)
                            }
                          />
                        </FormControl>
                        <FormMessage className={styles.fieldErrorText} />
                      </div>
                    </FormItem>
                  )}
                />

                <div className={styles.fieldGroup}>
                  <Label className={styles.totalLabel} htmlFor="expense-total">
                    <span>Total</span>
                    <span className={styles.totalFormula}>
                      (Subtotal {totalFormulaSubtotal} x {totalFormulaOccurrences} veces
                      al mes)
                    </span>
                  </Label>
                  <InputGroup className={styles.readOnlyInputGroup}>
                    <InputGroupAddon
                      align="inline-start"
                      aria-hidden="true"
                      className={cn(styles.readOnlyField, styles.readOnlyAddon)}
                    >
                      {currencyPrefix}
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Total"
                      className={styles.readOnlyField}
                      id="expense-total"
                      readOnly
                      type="text"
                      value={formatCurrencyDisplay(draft.total)}
                    />
                  </InputGroup>
                </div>
              </div>

              <div className={styles.loanSection}>
                <div className={styles.loanToggleRow}>
                  <div className={styles.fieldControlWrapper}>
                    <input
                      checked={draft.isLoan}
                      className={styles.loanToggle}
                      id="expense-is-loan"
                      onChange={(event) => onLoanToggle(event.target.checked)}
                      type="checkbox"
                    />
                  </div>
                  <div className={styles.loanToggleLabelGroup}>
                    <Label htmlFor="expense-is-loan">
                      {getFieldLabel("Es deuda/préstamo", changedFields.has("isLoan"))}
                    </Label>
                    <LoanInfoPopover message={loanHelpMessage} />
                  </div>
                </div>

                {draft.isLoan ? (
                  <>
                    <div className={styles.fieldGroup}>
                      <Label>
                        {getFieldLabel("Prestador", changedFields.has("lender"))}
                      </Label>
                      <div className={styles.fieldControlWrapper}>
                        <LenderPicker
                          hasError={Boolean(lenderFieldError)}
                          onSelect={onLenderSelect}
                          options={lenders}
                          selectedLenderId={draft.lenderId}
                          selectedLenderName={draft.lenderName}
                        />
                        {lenderFieldError ? (
                          <p className={styles.fieldErrorText}>{lenderFieldError}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.loanFieldsGrid}>
                      <FormField
                        control={form.control}
                        name="startMonth"
                        render={() => (
                          <FormItem className={styles.fieldGroup}>
                            <FormLabel>
                              {getFieldLabel(
                                "Inicio de la deuda",
                                changedFields.has("startMonth"),
                              )}
                            </FormLabel>
                            <div className={styles.fieldControlWrapper}>
                              <FormControl>
                                <Input
                                  aria-label="Inicio de la deuda"
                                  className={cn(
                                    shouldShowValidation &&
                                      fieldErrors.startMonth &&
                                      styles.invalidField,
                                    changedFields.has("startMonth") &&
                                      styles.changedField,
                                  )}
                                  data-changed={
                                    changedFields.has("startMonth")
                                      ? "true"
                                      : "false"
                                  }
                                  max="2100-12"
                                  min="2000-01"
                                  onChange={(event) =>
                                    onFieldChange("startMonth", event.target.value)
                                  }
                                  type="month"
                                  value={draft.startMonth}
                                />
                              </FormControl>
                              <FormMessage className={styles.fieldErrorText} />
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="installmentCount"
                        render={() => (
                          <FormItem className={styles.fieldGroup}>
                            <FormLabel>
                              {getFieldLabel(
                                "Cantidad total de cuotas",
                                changedFields.has("installmentCount"),
                              )}
                            </FormLabel>
                            <div className={styles.fieldControlWrapper}>
                              <FormControl>
                                <Input
                                  aria-label="Cantidad total de cuotas"
                                  className={cn(
                                    shouldShowValidation &&
                                      fieldErrors.installmentCount &&
                                      styles.invalidField,
                                    changedFields.has("installmentCount") &&
                                      styles.changedField,
                                  )}
                                  data-changed={
                                    changedFields.has("installmentCount")
                                      ? "true"
                                      : "false"
                                  }
                                  inputMode="numeric"
                                  onChange={(event) =>
                                    onFieldChange(
                                      "installmentCount",
                                      event.target.value.replace(/[^\d]/g, ""),
                                    )
                                  }
                                  pattern="[0-9]*"
                                  placeholder="Ej: 12"
                                  type="text"
                                  value={draft.installmentCount}
                                />
                              </FormControl>
                              <div className={styles.installmentSuggestions}>
                                {INSTALLMENT_COUNT_SUGGESTIONS.map((installment) => (
                                  <Button
                                    aria-label={`Usar ${installment} cuotas`}
                                    aria-pressed={draft.installmentCount === installment}
                                    className={cn(
                                      styles.installmentSuggestionButton,
                                      draft.installmentCount === installment &&
                                        styles.installmentSuggestionButtonActive,
                                    )}
                                    key={installment}
                                    onClick={() =>
                                      onFieldChange("installmentCount", installment)
                                    }
                                    size="xs"
                                    type="button"
                                    variant="outline"
                                  >
                                    {installment}
                                  </Button>
                                ))}
                              </div>
                              <FormMessage className={styles.fieldErrorText} />
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className={styles.fieldGroup}>
                        <Label htmlFor="expense-loan-end-month">Fin de la deuda</Label>
                        <Input
                          aria-label="Fin de la deuda"
                          className={styles.readOnlyField}
                          id="expense-loan-end-month"
                          readOnly
                          tabIndex={-1}
                          type="month"
                          value={draft.loanEndMonth}
                        />
                      </div>
                    </div>

                    <Alert className={styles.loanStatus}>
                      <Info aria-hidden="true" className={styles.loanStatusIcon} />
                      <AlertDescription className={styles.loanStatusText}>
                        <p>
                          {draft.loanProgress ||
                            "Completá inicio y cuotas para ver el avance."}
                        </p>
                      </AlertDescription>
                    </Alert>
                  </>
                ) : null}
              </div>
            </form>
          </Form>

          <DialogFooter className={styles.footer}>
            {hasPendingChanges ? (
              <p className={styles.changesLegend} role="status">
                Los labels amarillos subrayados marcan cambios sin guardar.
              </p>
            ) : null}
            <div className={styles.footerActions}>
              <Button onClick={onRequestClose} type="button" variant="outline">
                Cancelar
              </Button>
              <Button
                disabled={actionDisabled}
                onClick={handleSaveAttempt}
                type="button"
              >
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onUnsavedChangesClose();
          }
        }}
        open={showUnsavedChangesDialog}
      >
        <DialogContent
          className={styles.unsavedChangesContent}
          showCloseButton={false}
        >
          <DialogHeader className={styles.unsavedChangesHeader}>
            <div className={styles.unsavedChangesHeaderTopRow}>
              <DialogTitle>Cambios sin guardar</DialogTitle>
              <Button
                aria-label="Cerrar aviso de cambios sin guardar"
                className={styles.unsavedChangesCloseButton}
                onClick={onUnsavedChangesClose}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <DialogDescription>
              Tenés cambios sin guardar en este gasto.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.unsavedChangesFooter}>
            <Button
              className={styles.unsavedChangesButton}
              onClick={onUnsavedChangesDiscard}
              type="button"
              variant="outline"
            >
              Descartar los cambios
            </Button>
            <Button
              className={styles.unsavedChangesButton}
              onClick={onUnsavedChangesSave}
              type="button"
            >
              Guardar los cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
