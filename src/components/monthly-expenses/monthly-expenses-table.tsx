import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  occurrencesPerMonth: string;
  subtotal: string;
  total: string;
}

type EditableFieldName =
  | "currency"
  | "description"
  | "occurrencesPerMonth"
  | "subtotal";

interface MonthlyExpensesTableProps {
  actionDisabled: boolean;
  feedbackMessage: string;
  feedbackTone: "default" | "error" | "success";
  isAuthenticated: boolean;
  isSubmitting: boolean;
  loadError: string | null;
  month: string;
  onAddExpense: () => void;
  onExpenseFieldChange: (
    expenseId: string,
    fieldName: EditableFieldName,
    value: string,
  ) => void;
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
  isSubmitting,
  loadError,
  month,
  onAddExpense,
  onExpenseFieldChange,
  onMonthChange,
  onRemoveExpense,
  onSubmit,
  result,
  rows,
  sessionMessage,
}: MonthlyExpensesTableProps) {
  return (
    <section
      aria-labelledby="monthly-expenses-title"
      className={styles.section}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 id="monthly-expenses-title">Registro mensual de gastos</h1>
          </CardTitle>
          <CardDescription>
            Organizá servicios, alquileres, expensas y cualquier gasto
            recurrente en una tabla mensual con guardado en Google Drive.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          <p
            className={cn(
              styles.sessionStatus,
              isAuthenticated ? styles.sessionReady : styles.sessionPending,
            )}
            role="status"
          >
            {sessionMessage}
          </p>

          {loadError ? (
            <p className={cn(styles.feedback, styles.errorText)} role="alert">
              {loadError}
            </p>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className={styles.tableCard}>
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
                      <TableHead className={styles.headCell}>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => {
                      const descriptionFieldId = `expense-description-${row.id}`;
                      const subtotalFieldId = `expense-subtotal-${row.id}`;
                      const occurrencesFieldId = `expense-occurrences-${row.id}`;
                      const totalFieldId = `expense-total-${row.id}`;

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
                          <TableCell className={styles.actionsCell}>
                            <Button
                              aria-label={`Eliminar gasto ${index + 1}`}
                              onClick={() => onRemoveExpense(row.id)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Eliminar
                            </Button>
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
        </CardContent>
      </Card>
    </section>
  );
}
