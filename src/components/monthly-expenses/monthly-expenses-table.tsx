import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { z } from "zod";

import { ExpenseRowActions } from "@/components/monthly-expenses/expense-row-actions";
import {
  ExpenseSheet,
} from "@/components/monthly-expenses/expense-sheet";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import styles from "./monthly-expenses-table.module.scss";

type MonthlyExpenseCurrency = "ARS" | "USD";
const PAYMENT_LINK_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PAYMENT_LINK_URL_SCHEMA = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
});

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
  paymentLink: string;
  startMonth: string;
  subtotal: string;
  total: string;
}

interface MonthlyExpensesTableProps {
  actionDisabled: boolean;
  changedFields: Set<string>;
  copySourceMonth: string | null;
  copySourceMonthOptions: Array<{
    label: string;
    value: string;
  }>;
  draft: MonthlyExpensesEditableRow | null;
  exchangeRateSnapshot: {
    blueRate: number;
    month: string;
    officialRate: number;
    solidarityRate: number;
  } | null;
  feedbackMessage: string;
  feedbackTone: "default" | "error" | "success";
  isCopyFromDisabled: boolean;
  isExpenseSheetOpen: boolean;
  isSubmitting: boolean;
  onMonthChange: (value: string) => void;
  onRequestCloseExpenseSheet: () => void;
  onSaveExpense: () => void;
  onSaveUnsavedChanges: () => void;
  onUnsavedChangesClose: () => void;
  onUnsavedChangesDiscard: () => void;
  rows: MonthlyExpensesEditableRow[];
  sheetMode: "create" | "edit";
  showCopyFromControls: boolean;
  showUnsavedChangesDialog: boolean;
  validationMessage: string | null;
}

function getSortableHeader(label: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      getCanSort: () => boolean;
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (desc?: boolean) => void;
    };
  }) {
    if (!column.getCanSort()) {
      return <span className={styles.headLabel}>{label}</span>;
    }

    return (
      <Button
        className={styles.headButton}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        size="sm"
        type="button"
        variant="ghost"
      >
        {label}
        <ArrowUpDown aria-hidden="true" />
      </Button>
    );
  };
}

function formatCurrencyAmount(
  currency: MonthlyExpenseCurrency,
  value: string,
): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  const [, decimalPart = ""] = value.split(".");
  const normalizedDecimalPart = decimalPart.slice(0, 2);
  const minimumFractionDigits =
    normalizedDecimalPart.length === 0 || /^0+$/.test(normalizedDecimalPart)
      ? 0
      : normalizedDecimalPart.length;
  const prefix = currency === "USD" ? "US$" : "$";

  return `${prefix} ${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: Math.max(minimumFractionDigits, 0),
    minimumFractionDigits,
  }).format(numericValue)}`;
}

function formatConvertedAmount(
  currency: MonthlyExpenseCurrency,
  value: number | null,
): string {
  if (value == null) {
    return "-";
  }

  return formatCurrencyAmount(currency, value.toFixed(2));
}

function getConvertedAmountForCurrency({
  currency,
  exchangeRateSnapshot,
  rowCurrency,
  total,
}: {
  currency: MonthlyExpenseCurrency;
  exchangeRateSnapshot: MonthlyExpensesTableProps["exchangeRateSnapshot"];
  rowCurrency: MonthlyExpenseCurrency;
  total: number;
}): number | null {
  if (!exchangeRateSnapshot || !Number.isFinite(total)) {
    return null;
  }

  if (currency === "ARS") {
    return rowCurrency === "ARS"
      ? total
      : total * exchangeRateSnapshot.solidarityRate;
  }

  return rowCurrency === "USD"
    ? total
    : total / exchangeRateSnapshot.solidarityRate;
}

function getValidPaymentLink(value: string): string | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const paymentLinkWithProtocol = PAYMENT_LINK_PROTOCOL_PATTERN.test(
      normalizedValue,
    )
      ? normalizedValue
      : `https://${normalizedValue}`;
    return PAYMENT_LINK_URL_SCHEMA.parse(paymentLinkWithProtocol);
  } catch {
    return null;
  }
}

export function MonthlyExpensesTable({
  actionDisabled,
  changedFields,
  copySourceMonth,
  copySourceMonthOptions,
  draft,
  exchangeRateSnapshot,
  feedbackMessage,
  feedbackTone,
  isCopyFromDisabled,
  isExpenseSheetOpen,
  isSubmitting,
  lenders,
  loadError,
  month,
  onAddExpense,
  onCopyFromMonth,
  onCopySourceMonthChange,
  onDeleteExpense,
  onEditExpense,
  onExpenseFieldChange,
  onExpenseLenderSelect,
  onExpenseLoanToggle,
  onMonthChange,
  onRequestCloseExpenseSheet,
  onSaveExpense,
  onSaveUnsavedChanges,
  onUnsavedChangesClose,
  onUnsavedChangesDiscard,
  rows,
  sheetMode,
  showCopyFromControls,
  showUnsavedChangesDialog,
  validationMessage,
}: MonthlyExpensesTableProps) {
  const columns = useMemo<ColumnDef<MonthlyExpensesEditableRow>[]>(
    () => [
      {
        accessorKey: "description",
        cell: ({ row }) => row.original.description || "Sin descripción",
        header: getSortableHeader("Descripción"),
      },
      {
        accessorKey: "currency",
        header: getSortableHeader("Moneda"),
      },
      {
        accessorKey: "subtotal",
        cell: ({ row }) =>
          formatCurrencyAmount(row.original.currency, row.original.subtotal),
        header: getSortableHeader("Subtotal"),
        sortingFn: (rowA, rowB) =>
          Number(rowA.original.subtotal) - Number(rowB.original.subtotal),
      },
      {
        accessorKey: "occurrencesPerMonth",
        header: getSortableHeader("Veces al mes"),
      },
      {
        accessorKey: "total",
        cell: ({ row }) =>
          formatCurrencyAmount(row.original.currency, row.original.total),
        header: getSortableHeader("Total"),
        sortingFn: (rowA, rowB) =>
          Number(rowA.original.total) - Number(rowB.original.total),
      },
      {
        accessorKey: "ars",
        cell: ({ row }) => {
          const total = Number(row.original.total);
          const arsAmount = getConvertedAmountForCurrency({
            currency: "ARS",
            exchangeRateSnapshot,
            rowCurrency: row.original.currency,
            total,
          });

          return formatConvertedAmount("ARS", arsAmount);
        },
        header: getSortableHeader("ARS"),
        sortingFn: (rowA, rowB) => {
          const leftAmount = getConvertedAmountForCurrency({
            currency: "ARS",
            exchangeRateSnapshot,
            rowCurrency: rowA.original.currency,
            total: Number(rowA.original.total),
          });
          const rightAmount = getConvertedAmountForCurrency({
            currency: "ARS",
            exchangeRateSnapshot,
            rowCurrency: rowB.original.currency,
            total: Number(rowB.original.total),
          });

          return (leftAmount ?? Number.NEGATIVE_INFINITY) -
            (rightAmount ?? Number.NEGATIVE_INFINITY);
        },
      },
      {
        accessorKey: "usd",
        cell: ({ row }) => {
          const total = Number(row.original.total);
          const usdAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: row.original.currency,
            total,
          });

          return formatConvertedAmount("USD", usdAmount);
        },
        header: getSortableHeader("USD"),
        sortingFn: (rowA, rowB) => {
          const leftAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: rowA.original.currency,
            total: Number(rowA.original.total),
          });
          const rightAmount = getConvertedAmountForCurrency({
            currency: "USD",
            exchangeRateSnapshot,
            rowCurrency: rowB.original.currency,
            total: Number(rowB.original.total),
          });

          return (leftAmount ?? Number.NEGATIVE_INFINITY) -
            (rightAmount ?? Number.NEGATIVE_INFINITY);
        },
      },
      {
        accessorKey: "paymentLink",
        cell: ({ row }) => {
          const paymentLink = getValidPaymentLink(row.original.paymentLink);

          if (!paymentLink) {
            return "-";
          }

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  className={styles.paymentLinkAction}
                  href={paymentLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Abrir
                  <ExternalLink aria-hidden="true" className={styles.paymentLinkIcon} />
                </a>
              </TooltipTrigger>
              <TooltipContent>Abrir página de pago</TooltipContent>
            </Tooltip>
          );
        },
        enableSorting: false,
        header: "Link",
      },
      {
        accessorKey: "loanProgress",
        cell: ({ row }) =>
          row.original.isLoan
            ? row.original.loanProgress || "Completá datos de la deuda"
            : "No aplica",
        header: "Deuda / cuotas",
      },
      {
        cell: ({ row }) => (
          <ExpenseRowActions
            actionDisabled={actionDisabled}
            description={row.original.description}
            onDelete={() => onDeleteExpense(row.original.id)}
            onEdit={() => onEditExpense(row.original.id)}
          />
        ),
        enableSorting: false,
        header: "Acciones",
        id: "actions",
      },
    ],
    [actionDisabled, exchangeRateSnapshot, onDeleteExpense, onEditExpense],
  );

  return (
    <section className={styles.section}>
      <div className={styles.content}>
        <div className={styles.headerTopRow}>
          <div className={styles.header}>
            <p className={styles.pageDescription}>
              Cargá, editá y guardá tus gastos mensuales en la base de datos de
              la app.
            </p>
          </div>
        </div>

        {loadError ? (
          <p className={cn(styles.feedback, styles.errorText)} role="alert">
            {loadError}
          </p>
        ) : null}

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

            {showCopyFromControls ? (
              <div className={styles.copyField}>
                <Label htmlFor="monthly-expenses-copy-source">Copia de</Label>
                <div className={styles.copyActions}>
                  <Select
                    onValueChange={onCopySourceMonthChange}
                    value={copySourceMonth ?? undefined}
                  >
                    <SelectTrigger
                      aria-label="Mes de origen para copiar"
                      className={styles.copySourceSelect}
                      id="monthly-expenses-copy-source"
                    >
                      <SelectValue placeholder="Seleccioná un mes guardado" />
                    </SelectTrigger>
                    <SelectContent>
                      {copySourceMonthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    disabled={isCopyFromDisabled}
                    onClick={onCopyFromMonth}
                    type="button"
                    variant="outline"
                  >
                    Copia de
                  </Button>
                </div>
                <p className={styles.monthHint}>
                  Copiá gastos guardados de otro mes y revisá antes de guardar.
                </p>
              </div>
            ) : null}

            <Button
              disabled={actionDisabled}
              onClick={onAddExpense}
              type="button"
              variant="outline"
            >
              Agregar gasto
            </Button>
          </div>

          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Detalle del mes</h2>
            <p className={styles.tableDescription}>
              Editá cada gasto desde su menú de acciones y guardá los cambios del
              mes.
            </p>
          </div>

          <div className={styles.tableWrapper}>
            <DataTable
              columns={columns}
              data={rows}
              emptyMessage="No hay gastos cargados para este mes."
              filterColumnId="description"
              filterLabel="Filtrar gastos"
              filterPlaceholder="Filtrar gastos por descripción"
            />
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
        </div>

        <ExpenseSheet
          actionDisabled={actionDisabled || isSubmitting}
          changedFields={changedFields}
          draft={draft}
          isOpen={isExpenseSheetOpen}
          isSubmitting={isSubmitting}
          lenders={lenders}
          mode={sheetMode}
          onFieldChange={onExpenseFieldChange}
          onLenderSelect={onExpenseLenderSelect}
          onLoanToggle={onExpenseLoanToggle}
          onRequestClose={onRequestCloseExpenseSheet}
          onSave={onSaveExpense}
          onUnsavedChangesClose={onUnsavedChangesClose}
          onUnsavedChangesDiscard={onUnsavedChangesDiscard}
          onUnsavedChangesSave={onSaveUnsavedChanges}
          showUnsavedChangesDialog={showUnsavedChangesDialog}
          validationMessage={validationMessage}
        />
      </div>
    </section>
  );
}
