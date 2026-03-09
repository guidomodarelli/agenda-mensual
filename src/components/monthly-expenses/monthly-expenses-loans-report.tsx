import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import styles from "./monthly-expenses-loans-report.module.scss";

interface MonthlyExpensesLoanReportView {
  activeLoanCount: number;
  expenseDescriptions: string[];
  firstDebtMonth: string | null;
  lenderId: string | null;
  lenderName: string;
  lenderType: "bank" | "family" | "friend" | "other" | "unassigned";
  latestRecordedMonth: string | null;
  remainingAmount: number;
  trackedLoanCount: number;
}

interface MonthlyExpensesLoansReportProps {
  entries: MonthlyExpensesLoanReportView[];
  feedbackMessage: string | null;
  providerFilterOptions: Array<{
    id: string;
    label: string;
  }>;
  selectedLenderFilter: string;
  selectedTypeFilter: string;
  summary: {
    activeLoanCount: number;
    lenderCount: number;
    remainingAmount: number;
    trackedLoanCount: number;
  };
  onLenderFilterChange: (value: string) => void;
  onResetFilters: () => void;
  onTypeFilterChange: (value: string) => void;
}

function getTypeLabel(type: MonthlyExpensesLoanReportView["lenderType"]): string {
  switch (type) {
    case "bank":
      return "Banco";
    case "family":
      return "Familiar";
    case "friend":
      return "Amigo";
    case "other":
      return "Otro";
    case "unassigned":
      return "Sin prestador";
  }
}

export function MonthlyExpensesLoansReport({
  entries,
  feedbackMessage,
  providerFilterOptions,
  selectedLenderFilter,
  selectedTypeFilter,
  summary,
  onLenderFilterChange,
  onResetFilters,
  onTypeFilterChange,
}: MonthlyExpensesLoansReportProps) {
  return (
    <section className={styles.content}>
      <p className={styles.description}>
        Revisá cuánto debés por prestador y qué gastos están asociados.
      </p>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Prestadores con deuda</p>
          <p className={styles.summaryValue}>{summary.lenderCount}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Deudas activas</p>
          <p className={styles.summaryValue}>{summary.activeLoanCount}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Monto pendiente estimado</p>
          <p className={styles.summaryValue}>{summary.remainingAmount.toFixed(2)}</p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <Label htmlFor="loan-report-type-filter">Tipo</Label>
          <Select onValueChange={onTypeFilterChange} value={selectedTypeFilter}>
            <SelectTrigger
              aria-label="Filtrar por tipo"
              id="loan-report-type-filter"
            >
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="bank">Bancos</SelectItem>
              <SelectItem value="family">Familiares</SelectItem>
              <SelectItem value="friend">Amigos</SelectItem>
              <SelectItem value="other">Otros</SelectItem>
              <SelectItem value="unassigned">Sin prestador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterField}>
          <Label htmlFor="loan-report-lender-filter">Prestador</Label>
          <Select
            onValueChange={onLenderFilterChange}
            value={selectedLenderFilter}
          >
            <SelectTrigger
              aria-label="Filtrar por prestador"
              id="loan-report-lender-filter"
            >
              <SelectValue placeholder="Todos los prestadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los prestadores</SelectItem>
              {providerFilterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={onResetFilters} type="button" variant="outline">
          Limpiar filtros
        </Button>
      </div>

      {feedbackMessage ? (
        <p className={styles.feedback}>{feedbackMessage}</p>
      ) : null}

      <div className={styles.entries}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article
              className={styles.entry}
              key={`${entry.lenderId ?? entry.lenderName}-${entry.lenderType}`}
            >
              <div className={styles.entryHeader}>
                <div>
                  <h3 className={styles.entryTitle}>{entry.lenderName}</h3>
                  <p className={styles.entryMeta}>{getTypeLabel(entry.lenderType)}</p>
                </div>
                <p className={styles.entryAmount}>
                  {entry.remainingAmount.toFixed(2)}
                </p>
              </div>
              <p className={styles.entryBody}>
                Inicio más antiguo: {entry.firstDebtMonth ?? "Sin dato"}. Último
                mes registrado: {entry.latestRecordedMonth ?? "Sin dato"}.
              </p>
              <p className={styles.entryBody}>
                Deudas activas: {entry.activeLoanCount}. Deudas registradas:{" "}
                {entry.trackedLoanCount}.
              </p>
              <p className={styles.entryBody}>
                Gastos asociados: {entry.expenseDescriptions.join(", ")}.
              </p>
            </article>
          ))
        ) : feedbackMessage ? null : (
          <p className={styles.feedback}>
            No hay deudas para los filtros seleccionados.
          </p>
        )}
      </div>
    </section>
  );
}
