import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  ConfirmDeleteButton,
} from "./confirm-delete-button";
import {
  LenderPicker,
  type LenderOption,
} from "./lender-picker";
import { LoanInfoPopover } from "./loan-info-popover";
import styles from "./monthly-expenses-table.module.scss";

type MonthlyExpenseCurrency = "ARS" | "USD";

interface StoredMonthlyExpensesDocumentView {
  id: string;
  month: string;
  name: string;
  viewUrl: string | null;
}

export interface MonthlyExpensesEditableRow {
  currency: MonthlyExpenseCurrency;
  description: string;
  id: string;
  installmentCount: string;
  isLoan: boolean;
  lenderId: string;
  lenderName: string;
  loanEndMonth: string;
  loanProgress: string;
  occurrencesPerMonth: string;
  startMonth: string;
  subtotal: string;
  total: string;
}

type EditableFieldName =
  | "currency"
  | "description"
  | "installmentCount"
  | "occurrencesPerMonth"
  | "startMonth"
  | "subtotal";

interface MonthlyExpensesTableProps {
  actionDisabled: boolean;
  feedbackMessage: string;
  feedbackTone: "default" | "error" | "success";
  isAuthenticated: boolean;
  isSessionLoading: boolean;
  isSubmitting: boolean;
  lenders: LenderOption[];
  loadError: string | null;
  month: string;
  onAddExpense: () => void;
  onExpenseFieldChange: (
    expenseId: string,
    fieldName: EditableFieldName,
    value: string,
  ) => void;
  onExpenseLenderSelect: (expenseId: string, lenderId: string | null) => void;
  onExpenseLoanToggle: (expenseId: string, checked: boolean) => void;
  onMonthChange: (value: string) => void;
  onRemoveExpense: (expenseId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  result: StoredMonthlyExpensesDocumentView | null;
  rows: MonthlyExpensesEditableRow[];
  sessionMessage: string;
}

export function MonthlyExpensesTable({
  actionDisabled,
  feedbackMessage,
  feedbackTone,
  isAuthenticated,
  isSessionLoading,
  isSubmitting,
  lenders,
  loadError,
  month,
  onAddExpense,
  onExpenseFieldChange,
  onExpenseLenderSelect,
  onExpenseLoanToggle,
  onMonthChange,
  onRemoveExpense,
  onSubmit,
  result,
  rows,
  sessionMessage,
}: MonthlyExpensesTableProps) {
  const sessionStatus = isSessionLoading
    ? "loading"
    : isAuthenticated
      ? "active"
      : "inactive";
  const loanHelpMessage =
    "Marcá el check si este gasto representa una deuda con una persona o entidad.";

  return (
    <section
      aria-labelledby="monthly-expenses-title"
      className={styles.section}
    >
      <div className={styles.content}>
        <div className={styles.headerTopRow}>
          <div className={styles.header}>
            <h1 className={styles.pageTitle} id="monthly-expenses-title">
              Registro mensual de gastos
            </h1>
            <p className={styles.pageDescription}>
              Organizá servicios, alquileres, expensas y cualquier gasto
              recurrente en una tabla mensual con guardado en Google Drive.
            </p>
          </div>
          <Badge
            className={cn(
              styles.sessionStatusBadge,
              sessionStatus === "active"
                ? styles.sessionReadyBadge
                : sessionStatus === "loading"
                  ? styles.sessionLoadingBadge
                  : styles.sessionPendingBadge,
            )}
            role="status"
            title={sessionMessage}
            variant={sessionStatus === "active" ? "default" : "outline"}
          >
            {sessionStatus === "loading" ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className={styles.sessionLoadingIcon}
                />
                Google conectado - Verificando
              </>
            ) : sessionStatus === "active" ? (
              "Google conectado - Activo"
            ) : (
              "Google desconectado - Inactivo"
            )}
          </Badge>
        </div>

          {loadError ? (
            <p className={cn(styles.feedback, styles.errorText)} role="alert">
              {loadError}
            </p>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className={styles.tableContent}>
              <div className={styles.toolbar}>
                <div className={styles.monthField}>
                  <Label htmlFor="monthly-expenses-month">Mes</Label>
                  <Input
                    id="monthly-expenses-month"
                    onChange={(event) => onMonthChange(event.target.value)}
                    type="month"
                    value={month}
                  />
                  <p className={styles.monthHint}>
                    Cambiá el mes para guardar otra planilla mensual.
                  </p>
                </div>

                <Button onClick={onAddExpense} type="button" variant="outline">
                  Agregar gasto
                </Button>
              </div>

              <div className={styles.tableHeader}>
                <h2 className={styles.tableTitle}>Detalle del mes</h2>
                <p className={styles.tableDescription}>
                  El total de cada fila se calcula automáticamente como subtotal
                  por cantidad de veces al mes.
                </p>
              </div>

              <div className={styles.tableWrapper}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={styles.headCell}>
                        Descripción
                      </TableHead>
                      <TableHead className={styles.headCell}>Moneda</TableHead>
                      <TableHead className={styles.headCell}>Subtotal</TableHead>
                      <TableHead className={styles.headCell}>
                        Cantidad de veces por mes
                      </TableHead>
                      <TableHead className={styles.headCell}>Total</TableHead>
                      <TableHead className={styles.headCell}>
                        Deuda / cuotas
                      </TableHead>
                      <TableHead className={styles.headCell}>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => {
                      const descriptionFieldId = `expense-description-${row.id}`;
                      const subtotalFieldId = `expense-subtotal-${row.id}`;
                      const occurrencesFieldId = `expense-occurrences-${row.id}`;
                      const totalFieldId = `expense-total-${row.id}`;
                      const loanToggleFieldId = `expense-loan-toggle-${row.id}`;
                      const loanStartFieldId = `expense-loan-start-${row.id}`;
                      const installmentCountFieldId =
                        `expense-installment-count-${row.id}`;
                      const loanEndFieldId = `expense-loan-end-${row.id}`;

                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Label
                              className={styles.srOnly}
                              htmlFor={descriptionFieldId}
                            >
                              Descripción
                            </Label>
                            <Input
                              aria-label="Descripción"
                              className={cn(
                                styles.cellField,
                                styles.descriptionField,
                              )}
                              id={descriptionFieldId}
                              onChange={(event) =>
                                onExpenseFieldChange(
                                  row.id,
                                  "description",
                                  event.target.value,
                                )
                              }
                              placeholder="Ej. agua, expensas, alquiler"
                              type="text"
                              value={row.description}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              onValueChange={(value) =>
                                onExpenseFieldChange(row.id, "currency", value)
                              }
                              value={row.currency}
                            >
                              <SelectTrigger
                                aria-label="Moneda"
                                className={styles.currencyField}
                              >
                                <SelectValue placeholder="Moneda" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Label
                              className={styles.srOnly}
                              htmlFor={subtotalFieldId}
                            >
                              Subtotal
                            </Label>
                            <Input
                              aria-label="Subtotal"
                              className={cn(
                                styles.cellField,
                                styles.numericField,
                              )}
                              id={subtotalFieldId}
                              inputMode="decimal"
                              min="0"
                              onChange={(event) =>
                                onExpenseFieldChange(
                                  row.id,
                                  "subtotal",
                                  event.target.value,
                                )
                              }
                              step="0.01"
                              type="number"
                              value={row.subtotal}
                            />
                          </TableCell>
                          <TableCell>
                            <Label
                              className={styles.srOnly}
                              htmlFor={occurrencesFieldId}
                            >
                              Cantidad de veces por mes
                            </Label>
                            <Input
                              aria-label="Cantidad de veces por mes"
                              className={cn(
                                styles.cellField,
                                styles.numericField,
                              )}
                              id={occurrencesFieldId}
                              inputMode="numeric"
                              min="0"
                              onChange={(event) =>
                                onExpenseFieldChange(
                                  row.id,
                                  "occurrencesPerMonth",
                                  event.target.value,
                                )
                              }
                              step="1"
                              type="number"
                              value={row.occurrencesPerMonth}
                            />
                          </TableCell>
                          <TableCell>
                            <Label className={styles.srOnly} htmlFor={totalFieldId}>
                              Total
                            </Label>
                            <Input
                              aria-label="Total"
                              className={cn(
                                styles.cellField,
                                styles.totalField,
                              )}
                              id={totalFieldId}
                              readOnly
                              type="text"
                              value={row.total}
                            />
                          </TableCell>
                          <TableCell>
                            <div className={styles.loanCell}>
                              <div className={styles.loanToggleRow}>
                                <input
                                  checked={row.isLoan}
                                  className={styles.loanToggle}
                                  id={loanToggleFieldId}
                                  onChange={(event) =>
                                    onExpenseLoanToggle(row.id, event.target.checked)
                                  }
                                  type="checkbox"
                                />
                                <div className={styles.loanToggleLabelGroup}>
                                  <Label htmlFor={loanToggleFieldId}>
                                    Es deuda/préstamo
                                  </Label>
                                  <LoanInfoPopover message={loanHelpMessage} />
                                </div>
                              </div>

                              {row.isLoan ? (
                                <div className={styles.loanDetails}>
                                  <div className={styles.loanFieldGroup}>
                                    <Label>Prestador (opcional)</Label>
                                    <LenderPicker
                                      options={lenders}
                                      onSelect={(lenderId) =>
                                        onExpenseLenderSelect(row.id, lenderId)
                                      }
                                      selectedLenderId={row.lenderId}
                                      selectedLenderName={row.lenderName}
                                    />
                                  </div>

                                  <div className={styles.loanFieldGrid}>
                                    <div className={styles.loanFieldGroup}>
                                      <Label htmlFor={loanStartFieldId}>
                                        Inicio de la deuda
                                      </Label>
                                      <Input
                                        aria-label="Inicio de la deuda"
                                        className={styles.cellField}
                                        id={loanStartFieldId}
                                        onChange={(event) =>
                                          onExpenseFieldChange(
                                            row.id,
                                            "startMonth",
                                            event.target.value,
                                          )
                                        }
                                        type="month"
                                        value={row.startMonth}
                                      />
                                    </div>

                                    <div className={styles.loanFieldGroup}>
                                      <Label htmlFor={installmentCountFieldId}>
                                        Cantidad total de cuotas
                                      </Label>
                                      <Input
                                        aria-label="Cantidad total de cuotas"
                                        className={styles.cellField}
                                        id={installmentCountFieldId}
                                        inputMode="numeric"
                                        min="1"
                                        onChange={(event) =>
                                          onExpenseFieldChange(
                                            row.id,
                                            "installmentCount",
                                            event.target.value,
                                          )
                                        }
                                        step="1"
                                        type="number"
                                        value={row.installmentCount}
                                      />
                                    </div>

                                    <div className={styles.loanFieldGroup}>
                                      <Label htmlFor={loanEndFieldId}>
                                        Fin de la deuda
                                      </Label>
                                      <Input
                                        aria-label="Fin de la deuda"
                                        className={styles.cellField}
                                        id={loanEndFieldId}
                                        readOnly
                                        type="month"
                                        value={row.loanEndMonth}
                                      />
                                    </div>
                                  </div>

                                  <p className={styles.loanStatus} role="status">
                                    {row.loanProgress ||
                                      "Completá inicio y cuotas para ver el avance."}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className={styles.actionsCell}>
                            <ConfirmDeleteButton
                              message="¿Querés eliminar este gasto?"
                              menuAriaLabel={`Abrir acciones del gasto ${index + 1}`}
                              onConfirm={() => onRemoveExpense(row.id)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <p
                aria-live="polite"
                className={cn(
                  styles.feedback,
                  feedbackTone === "error" && styles.errorText,
                  feedbackTone === "success" && styles.successText,
                )}
                role={feedbackTone === "error" ? "alert" : undefined}
              >
                {feedbackMessage}
              </p>

              <div className={styles.actions}>
                <div className={styles.primaryActions}>
                  <Button disabled={actionDisabled} type="submit">
                    {isSubmitting ? "Guardando gastos..." : "Guardar gastos"}
                  </Button>
                  <Button onClick={onAddExpense} type="button" variant="outline">
                    Agregar otra fila
                  </Button>
                </div>
              </div>

              {result ? (
                <div className={styles.result}>
                  <p className={styles.resultLine}>Archivo: {result.name}</p>
                  <p className={styles.resultLine}>Mes: {result.month}</p>
                  <p className={styles.resultLine}>Id: {result.id}</p>
                  {result.viewUrl ? (
                    <Button asChild className={styles.resultLink} variant="link">
                      <a href={result.viewUrl} rel="noreferrer" target="_blank">
                        Abrir archivo mensual en Drive
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </form>
      </div>
    </section>
  );
}
