import { useEffect, useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { useForm } from "react-hook-form";

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
import { Textarea } from "@/components/ui/textarea";
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
  formatCurrencyDisplay,
  formatCurrencyDisplayWithOptions,
  normalizeCurrencyInput,
} from "./currency-input-format";

import {
  LenderPicker,
  type LenderOption,
} from "./lender-picker";
import {
  ExpenseFolderPicker,
  type ExpenseFolderOption,
} from "./expense-folder-picker";
import { LoanInfoPopover } from "./loan-info-popover";
import { PaymentFrequencyField } from "./payment-frequency-field";
import {
  formatReceiptSharePhoneDisplay,
  validateHourDuration,
  validateOccurrencesPerMonth,
  validateReceiptSharePhoneDigits,
  validateSubtotalAmount,
} from "./expense-edit-validation";
import { OccurrenceDurationInput } from "./occurrence-duration-input";
import { splitOccurrencesUnit } from "./occurrences-unit";
import type {
  MonthlyExpensesEditableRow,
  MonthlyExpenseSubtotalUnit,
} from "./monthly-expenses-table";
import styles from "./expense-sheet.module.scss";

export type ExpenseEditableFieldName =
  | "currency"
  | "description"
  | "installmentCount"
  | "loanDirection"
  | "manualCoveredPayments"
  | "occurrencesPerMonth"
  | "occurrencesUnit"
  | "receiptShareMessage"
  | "receiptSharePhoneDigits"
  | "recurrenceStartMonth"
  | "recurrenceEndMonth"
  | "startMonth"
  | "subtotal"
  | "subtotalUnit";

interface ExpenseSheetProps {
  actionDisabled: boolean;
  changedFields: Set<string>;
  draft: MonthlyExpensesEditableRow | null;
  expenseFolders: ExpenseFolderOption[];
  isOpen: boolean;
  isSubmitting: boolean;
  lenders: LenderOption[];
  mode: "create" | "edit";
  onAddLender: () => void;
  onFieldChange: (fieldName: ExpenseEditableFieldName, value: string) => void;
  onFolderSelect: (folderId: string | null) => void;
  onLenderSelect: (lenderId: string | null) => void;
  onManageFolders: () => void;
  onLoanToggle: (checked: boolean) => void;
  onRecurringToggle: (checked: boolean) => void;
  onReceiptShareToggle: (checked: boolean) => void;
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

type ExpenseSheetFormFieldName = Exclude<
  ExpenseEditableFieldName,
  | "loanDirection"
  | "manualCoveredPayments"
  | "occurrencesUnit"
  | "recurrenceStartMonth"
  | "recurrenceEndMonth"
  | "subtotalUnit"
>;
type ExpenseFieldErrorMap = Partial<Record<ExpenseSheetFormFieldName, string>>;
type ExpenseSheetFormValues = Record<ExpenseSheetFormFieldName, string>;

const INSTALLMENT_COUNT_SUGGESTIONS = ["3", "6", "9", "12", "18", "24"];

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

function getExpenseSheetFormValues(
  draft: MonthlyExpensesEditableRow,
): ExpenseSheetFormValues {
  return {
    currency: draft.currency,
    description: draft.description,
    installmentCount: draft.installmentCount,
    occurrencesPerMonth: draft.occurrencesPerMonth,
    receiptShareMessage: draft.receiptShareMessage,
    receiptSharePhoneDigits: draft.receiptSharePhoneDigits,
    startMonth: draft.startMonth,
    subtotal: draft.subtotal,
  };
}

function getFieldErrors(
  draft: MonthlyExpensesEditableRow,
  mode: "create" | "edit",
): ExpenseFieldErrorMap {
  const fieldErrors: ExpenseFieldErrorMap = {};
  const subtotal = Number(draft.subtotal);
  const occurrencesPerMonth = Number(draft.occurrencesPerMonth);
  const installmentCount = Number(draft.installmentCount);
  const isCreateMode = mode === "create";

  if (!draft.description.trim()) {
    fieldErrors.description = "Completá la descripción.";
  }

  const subtotalValidationError = isCreateMode
    ? validateSubtotalAmount(subtotal)
    : null;

  if (subtotalValidationError) {
    fieldErrors.subtotal = subtotalValidationError;
  }

  const occurrencesValidationError = isCreateMode
    ? validateOccurrencesPerMonth(occurrencesPerMonth)
    : null;

  if (occurrencesValidationError) {
    fieldErrors.occurrencesPerMonth = occurrencesValidationError;
  }

  if (draft.isLoan && !draft.startMonth.trim()) {
    fieldErrors.startMonth = "Completá la fecha de inicio.";
  }

  if (draft.isLoan && (!Number.isInteger(installmentCount) || installmentCount <= 0)) {
    fieldErrors.installmentCount = "Completá la cantidad total de cuotas.";
  }

  if (draft.requiresReceiptShare) {
    const receiptSharePhoneValidationError = validateReceiptSharePhoneDigits(
      draft.receiptSharePhoneDigits,
    );

    if (receiptSharePhoneValidationError) {
      fieldErrors.receiptSharePhoneDigits = receiptSharePhoneValidationError;
    }
  }

  return fieldErrors;
}

function shouldSubmitOnEnterFromTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  const inputType = target.type.toLowerCase();

  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(inputType);
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
  expenseFolders,
  isOpen,
  isSubmitting,
  lenders,
  mode,
  onAddLender,
  onFieldChange,
  onFolderSelect,
  onLenderSelect,
  onManageFolders,
  onLoanToggle,
  onRecurringToggle,
  onReceiptShareToggle,
  onRequestClose,
  onSave,
  onUnsavedChangesClose,
  onUnsavedChangesDiscard,
  onUnsavedChangesSave,
  showUnsavedChangesDialog,
  validationMessage,
}: ExpenseSheetContentProps) {
  const isCreateMode = mode === "create";
  const title = mode === "create" ? "Nuevo compromiso" : "Editar compromiso";
  const description =
    mode === "create"
      ? "Completá y guardá este compromiso mensual."
      : "Editá y guardá los cambios de este compromiso.";
  const loanHelpMessage =
    "Marcá esta opción si el compromiso corresponde a una deuda o a dinero que te deben.";
  const hasPendingChanges = changedFields.size > 0;
  const currencyPrefix = draft.currency === "USD" ? "US$" : "$";
  const subtotalUnit: MonthlyExpenseSubtotalUnit =
    draft.subtotalUnit ?? "occurrence";
  const isHourlySubtotal = subtotalUnit === "hour";
  const hourDurationError =
    isCreateMode && isHourlySubtotal
      ? validateHourDuration(draft.occurrencesUnit)
      : null;
  const totalFormulaSubtotalAmount =
    formatCurrencyDisplay(draft.subtotal).trim() || "X";
  const totalFormulaSubtotal = `${currencyPrefix} ${totalFormulaSubtotalAmount}`;
  const totalFormulaOccurrences = draft.occurrencesPerMonth.trim() || "Y";
  const totalFormulaDuration =
    splitOccurrencesUnit(draft.occurrencesUnit).duration || "1h";
  const totalFormula =
    subtotalUnit === "hour"
      ? `Subtotal ${totalFormulaSubtotal}/h × ${totalFormulaDuration}/mes`
      : `Subtotal ${totalFormulaSubtotal} × ${totalFormulaOccurrences}/mes`;
  const isLoanToggleDisabled = mode === "edit" || draft.isRecurring;
  // A plain expense can be converted to recurring while editing, so the toggle
  // stays enabled in edit mode. A loan blocks it (mutually exclusive). The lock
  // only applies to an expense that was ALREADY recurring before this edit (its
  // recurrence is stopped via "Cancelar recurrencia", bounded per month): a
  // recurrence the user just toggled on in this edit — `isRecurring` is in
  // `changedFields` — stays editable so it can be unchecked/undone.
  const isRecurringToggleDisabled =
    draft.isLoan ||
    (mode === "edit" &&
      draft.isRecurring &&
      !changedFields.has("isRecurring"));
  const shouldShowLoanSection = (isCreateMode || draft.isLoan) && !draft.isRecurring;
  // The recurring section is available whenever the expense is not a loan, in both
  // create and edit modes, so a plain expense can be turned into a recurring one.
  const shouldShowRecurringSection = !draft.isLoan;
  const recurringHelpMessage =
    "Marcá esta opción para gastos que se repiten todos los meses, como alquiler, expensas, agua, gas o energía. Cuando dejes de pagarlo, podés cancelar la recurrencia y deja de aparecer en los meses siguientes.";
  const form = useForm<ExpenseSheetFormValues>({
    values: getExpenseSheetFormValues(draft),
  });
  const fieldErrors = useMemo(() => getFieldErrors(draft, mode), [draft, mode]);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const shouldShowValidation = hasAttemptedSave;
  const lenderIsMissing = draft.isLoan && !draft.lenderId.trim();
  const lenderFieldError =
    shouldShowValidation && lenderIsMissing
      ? "Seleccioná un prestamista."
      : null;
  const recurrenceStartMonthMissing =
    draft.isRecurring && !draft.recurrenceStartMonth.trim();
  const recurrenceStartMonthError =
    shouldShowValidation && recurrenceStartMonthMissing
      ? "Completá el mes de inicio."
      : null;
  const hasFieldErrors =
    Object.keys(fieldErrors).length > 0 ||
    lenderIsMissing ||
    recurrenceStartMonthMissing ||
    Boolean(hourDurationError);
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

    (Object.entries(fieldErrors) as [ExpenseSheetFormFieldName, string][]).forEach(
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
                aria-label="Cerrar formulario de compromiso"
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
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }

                if (!shouldSubmitOnEnterFromTarget(event.target)) {
                  return;
                }

                event.preventDefault();
                handleSaveAttempt();
              }}
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

                {isCreateMode ? (
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
                ) : null}
              </div>

              {isCreateMode ? (
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
                                value={formatCurrencyDisplayWithOptions(
                                  draft.subtotal,
                                  {
                                    preserveExplicitFractionDigits: true,
                                  },
                                )}
                              />
                            </FormControl>
                            {subtotalUnit === "hour" ? (
                              <InputGroupAddon
                                align="inline-end"
                                aria-hidden="true"
                              >
                                /h
                              </InputGroupAddon>
                            ) : null}
                          </InputGroup>
                          <FormMessage className={styles.fieldErrorText} />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className={styles.fieldGroup}>
                    <Label htmlFor="expense-subtotal-unit">
                      {getFieldLabel(
                        "Unidad del subtotal",
                        changedFields.has("subtotalUnit"),
                      )}
                    </Label>
                    <div className={styles.fieldControlWrapper}>
                      <Select
                        onValueChange={(value) =>
                          onFieldChange("subtotalUnit", value)
                        }
                        value={subtotalUnit}
                      >
                        <SelectTrigger
                          aria-label="Unidad del subtotal"
                          className={cn(
                            changedFields.has("subtotalUnit") &&
                              styles.changedField,
                          )}
                          id="expense-subtotal-unit"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="occurrence">
                            Por ocurrencia
                          </SelectItem>
                          <SelectItem value="hour">Por hora</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isHourlySubtotal ? (
                    <div className={styles.fieldGroup}>
                      <div className={styles.fieldControlWrapper}>
                        <OccurrenceDurationInput
                          key={draft.id}
                          durationHoursAriaLabel="Duración mensual en horas"
                          durationMinutesAriaLabel="Duración mensual en minutos"
                          isChanged={changedFields.has("occurrencesUnit")}
                          label="Duración mensual"
                          onChange={(value) =>
                            onFieldChange("occurrencesUnit", value)
                          }
                          value={draft.occurrencesUnit}
                        />
                        {shouldShowValidation && hourDurationError ? (
                          <p className={styles.fieldErrorText} role="alert">
                            {hourDurationError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
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
                                isUnitChanged={changedFields.has("occurrencesUnit")}
                                occurrencesPerMonth={draft.occurrencesPerMonth}
                                occurrencesUnit={draft.occurrencesUnit}
                                onOccurrencesPerMonthChange={(value) =>
                                  onFieldChange("occurrencesPerMonth", value)
                                }
                                onOccurrencesUnitChange={(value) =>
                                  onFieldChange("occurrencesUnit", value)
                                }
                              />
                            </FormControl>
                            <FormMessage className={styles.fieldErrorText} />
                          </div>
                        </FormItem>
                      )}
                    />
                  )}

                  <div className={styles.fieldGroup}>
                    <Label className={styles.totalLabel} htmlFor="expense-total">
                      <span>Total</span>
                      <span className={styles.totalFormula}>
                        ({totalFormula})
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
              ) : null}

              <div className={styles.fieldGroup}>
                <Label>
                  {getFieldLabel("Carpeta", changedFields.has("expenseFolderId"))}
                </Label>
                <div className={styles.fieldControlWrapper}>
                  <ExpenseFolderPicker
                    onManageFolders={onManageFolders}
                    onSelect={onFolderSelect}
                    options={expenseFolders}
                    selectedFolderId={draft.expenseFolderId}
                  />
                </div>
              </div>

              {shouldShowLoanSection ? (
                <div className={styles.loanSection}>
                  <div className={styles.loanToggleRow}>
                    <div className={styles.fieldControlWrapper}>
                      <input
                        checked={draft.isLoan}
                        className={styles.loanToggle}
                        disabled={isLoanToggleDisabled}
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
                      <Label htmlFor="expense-loan-direction">
                        {getFieldLabel(
                          "Dirección",
                          changedFields.has("loanDirection"),
                        )}
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          onFieldChange("loanDirection", value)
                        }
                        value={draft.loanDirection ?? "payable"}
                      >
                        <SelectTrigger
                          aria-label="Dirección del préstamo"
                          id="expense-loan-direction"
                        >
                          <SelectValue placeholder="Dirección del préstamo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payable">Yo debo</SelectItem>
                          <SelectItem value="receivable">Me deben</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={styles.fieldGroup}>
                      <Label>
                        {getFieldLabel("Contraparte", changedFields.has("lender"))}
                      </Label>
                      <div className={styles.fieldControlWrapper}>
                        <LenderPicker
                          hasError={Boolean(lenderFieldError)}
                          onAddLender={onAddLender}
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
              ) : null}

              {shouldShowRecurringSection ? (
                <div className={styles.loanSection}>
                  <div className={styles.loanToggleRow}>
                    <div className={styles.fieldControlWrapper}>
                      <input
                        checked={draft.isRecurring}
                        className={styles.loanToggle}
                        disabled={isRecurringToggleDisabled}
                        id="expense-is-recurring"
                        onChange={(event) =>
                          onRecurringToggle(event.target.checked)
                        }
                        type="checkbox"
                      />
                    </div>
                    <div className={styles.loanToggleLabelGroup}>
                      <Label htmlFor="expense-is-recurring">
                        {getFieldLabel(
                          "Gasto recurrente",
                          changedFields.has("isRecurring"),
                        )}
                      </Label>
                      <LoanInfoPopover
                        closeLabel="Cerrar ayuda sobre gasto recurrente"
                        message={recurringHelpMessage}
                        triggerLabel="Más información sobre gasto recurrente"
                      />
                    </div>
                  </div>

                  {draft.isRecurring ? (
                    <>
                      <div className={styles.loanFieldsGrid}>
                        <div className={styles.fieldGroup}>
                          <Label htmlFor="expense-recurrence-start-month">
                            {getFieldLabel(
                              "Inicio de la recurrencia",
                              changedFields.has("recurrenceStartMonth"),
                            )}
                          </Label>
                          <div className={styles.fieldControlWrapper}>
                            <Input
                              aria-label="Inicio de la recurrencia"
                              className={cn(
                                recurrenceStartMonthError && styles.invalidField,
                                changedFields.has("recurrenceStartMonth") &&
                                  styles.changedField,
                              )}
                              data-changed={
                                changedFields.has("recurrenceStartMonth")
                                  ? "true"
                                  : "false"
                              }
                              id="expense-recurrence-start-month"
                              max="2100-12"
                              min="2000-01"
                              onChange={(event) =>
                                onFieldChange(
                                  "recurrenceStartMonth",
                                  event.target.value,
                                )
                              }
                              type="month"
                              value={draft.recurrenceStartMonth}
                            />
                            {recurrenceStartMonthError ? (
                              <p className={styles.fieldErrorText} role="alert">
                                {recurrenceStartMonthError}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className={styles.fieldGroup}>
                          <Label htmlFor="expense-recurrence-end-month">
                            {getFieldLabel(
                              "Cancelar a partir de (opcional)",
                              changedFields.has("recurrenceEndMonth"),
                            )}
                          </Label>
                          <div className={styles.fieldControlWrapper}>
                            <Input
                              aria-label="Último mes de la recurrencia"
                              className={cn(
                                changedFields.has("recurrenceEndMonth") &&
                                  styles.changedField,
                              )}
                              data-changed={
                                changedFields.has("recurrenceEndMonth")
                                  ? "true"
                                  : "false"
                              }
                              id="expense-recurrence-end-month"
                              max="2100-12"
                              min={draft.recurrenceStartMonth || "2000-01"}
                              onChange={(event) =>
                                onFieldChange(
                                  "recurrenceEndMonth",
                                  event.target.value,
                                )
                              }
                              type="month"
                              value={draft.recurrenceEndMonth}
                            />
                          </div>
                        </div>
                      </div>

                      <Alert className={styles.loanStatus}>
                        <Info
                          aria-hidden="true"
                          className={styles.loanStatusIcon}
                        />
                        <AlertDescription className={styles.loanStatusText}>
                          <p>
                            {draft.recurrenceEndMonth
                              ? `Se deja de repetir después de ${draft.recurrenceEndMonth}.`
                              : "Se repite todos los meses hasta que la canceles."}
                          </p>
                        </AlertDescription>
                      </Alert>
                    </>
                  ) : null}
                </div>
              ) : null}

              {(
                <div className={styles.loanSection}>
                  <div className={styles.loanToggleRow}>
                    <div className={styles.fieldControlWrapper}>
                      <input
                        checked={draft.requiresReceiptShare}
                        className={styles.loanToggle}
                        id="expense-requires-receipt-share"
                        onChange={(event) => onReceiptShareToggle(event.target.checked)}
                        type="checkbox"
                      />
                    </div>
                    <div className={styles.loanToggleLabelGroup}>
                      <Label htmlFor="expense-requires-receipt-share">
                        {getFieldLabel(
                          "¿Necesitas enviar el comprobante a alguien?",
                          changedFields.has("requiresReceiptShare"),
                        )}
                      </Label>
                    </div>
                  </div>

                  {draft.requiresReceiptShare ? (
                    <>
                      <FormField
                        control={form.control}
                        name="receiptSharePhoneDigits"
                        render={() => (
                          <FormItem className={styles.fieldGroup}>
                            <FormLabel>
                              {getFieldLabel(
                                "Número de teléfono (WhatsApp)",
                                changedFields.has("receiptSharePhoneDigits"),
                              )}
                            </FormLabel>
                            <div className={styles.fieldControlWrapper}>
                              <FormControl>
                                <Input
                                  aria-label="Número de teléfono (WhatsApp)"
                                  className={cn(
                                    shouldShowValidation &&
                                      fieldErrors.receiptSharePhoneDigits &&
                                      styles.invalidField,
                                    changedFields.has("receiptSharePhoneDigits") &&
                                      styles.changedField,
                                  )}
                                  data-changed={
                                    changedFields.has("receiptSharePhoneDigits")
                                      ? "true"
                                      : "false"
                                  }
                                  inputMode="numeric"
                                  onChange={(event) =>
                                    onFieldChange(
                                      "receiptSharePhoneDigits",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ej: 5491123456789"
                                  type="tel"
                                  value={formatReceiptSharePhoneDisplay(
                                    draft.receiptSharePhoneDigits,
                                  )}
                                />
                              </FormControl>
                              <FormMessage className={styles.fieldErrorText} />
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="receiptShareMessage"
                        render={() => (
                          <FormItem className={styles.fieldGroup}>
                            <FormLabel>
                              {getFieldLabel(
                                "Mensaje personalizado (opcional)",
                                changedFields.has("receiptShareMessage"),
                              )}
                            </FormLabel>
                            <div className={styles.fieldControlWrapper}>
                              <FormControl>
                                <Textarea
                                  aria-label="Mensaje personalizado (opcional)"
                                  className={cn(
                                    changedFields.has("receiptShareMessage") &&
                                      styles.changedField,
                                  )}
                                  data-changed={
                                    changedFields.has("receiptShareMessage")
                                      ? "true"
                                      : "false"
                                  }
                                  onChange={(event) =>
                                    onFieldChange(
                                      "receiptShareMessage",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Opcional"
                                  value={draft.receiptShareMessage}
                                />
                              </FormControl>
                              <FormMessage className={styles.fieldErrorText} />
                            </div>
                          </FormItem>
                        )}
                      />
                    </>
                  ) : null}
                </div>
              )}
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
              Tenés cambios sin guardar en este compromiso.
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
