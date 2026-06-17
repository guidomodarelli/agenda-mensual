import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Flame,
  Layers,
  RotateCcw,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import styles from "./monthly-expenses-loans-report.module.scss";

type TechnicalErrorCode = `E${number}${number}${number}${number}`;

type MonthlyExpensesLoanDirection = "payable" | "receivable";

type MonthlyExpensesLenderType =
  | "bank"
  | "family"
  | "friend"
  | "other"
  | "unassigned";

const arsCurrencyFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const MISSING_VALUE_LABEL = "Sin dato";
const MAX_AVATAR_INITIALS = 2;

interface MonthlyExpensesLoanReportExpenseView {
  count: number;
  description: string;
}

interface MonthlyExpensesLoanReportView {
  activeLoanCount: number;
  direction: MonthlyExpensesLoanDirection;
  expenseDescriptions: MonthlyExpensesLoanReportExpenseView[];
  firstDebtMonth: string | null;
  lenderId: string | null;
  lenderName: string;
  lenderType: MonthlyExpensesLenderType;
  latestRecordedMonth: string | null;
  remainingAmount: number;
  trackedLoanCount: number;
}

interface MonthlyExpensesLoansReportProps {
  entries: MonthlyExpensesLoanReportView[];
  feedbackMessage: string | null;
  feedbackErrorCode?: TechnicalErrorCode | null;
  providerFilterOptions: Array<{
    id: string;
    label: string;
  }>;
  selectedLenderFilter: string;
  selectedDirectionFilter: string;
  selectedTypeFilter: string;
  summary: {
    activeLoanCount: number;
    lenderCount: number;
    netRemainingAmount: number;
    payableRemainingAmount: number;
    receivableRemainingAmount: number;
    remainingAmount: number;
    trackedLoanCount: number;
  };
  onLenderFilterChange: (value: string) => void;
  onDirectionFilterChange: (value: string) => void;
  onResetFilters: () => void;
  onTypeFilterChange: (value: string) => void;
}

function getTypeLabel(type: MonthlyExpensesLenderType): string {
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
      return "Sin prestamista";
  }
}

function formatArsAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "$ 0";
  }

  return `$ ${arsCurrencyFormatter.format(value)}`;
}

/**
 * Formats an amount with the sign before the currency symbol so a negative net
 * balance reads as "-$ 1.000" instead of the formatter default "$ -1.000".
 *
 * @param value - Amount to format in ARS.
 * @returns The signed ARS representation.
 */
function formatSignedArsAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "$ 0";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${formatArsAmount(Math.abs(value))}`;
}

function getDirectionLabel(direction: MonthlyExpensesLoanDirection): string {
  return direction === "payable" ? "Yo debo" : "Me deben";
}

/**
 * Resolves the human hint that explains the net balance sign in plain Spanish.
 *
 * @param netRemainingAmount - Receivable minus payable remaining amount.
 * @returns The explanatory hint for the net balance.
 */
function getNetBalanceHint(netRemainingAmount: number): string {
  if (netRemainingAmount < 0) {
    return "Debés más de lo que te deben.";
  }

  if (netRemainingAmount > 0) {
    return "Te deben más de lo que debés.";
  }

  return "Estás en cero: lo que debés y lo que te deben se equilibran.";
}

function getNetBalanceTone(
  netRemainingAmount: number,
): "negative" | "positive" | "neutral" {
  if (netRemainingAmount < 0) {
    return "negative";
  }

  if (netRemainingAmount > 0) {
    return "positive";
  }

  return "neutral";
}

/**
 * Builds up to two uppercase initials from a lender name for the avatar.
 *
 * @param lenderName - Display name of the lender.
 * @returns The avatar initials, or a fallback glyph when the name is empty.
 */
function getLenderInitials(lenderName: string): string {
  const initials = lenderName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_AVATAR_INITIALS)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return initials.length > 0 ? initials : "?";
}

function getWidthPercent(part: number, total: number): string {
  if (total <= 0 || !Number.isFinite(part) || !Number.isFinite(total)) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, (part / total) * 100))}%`;
}

export function MonthlyExpensesLoansReport({
  entries,
  feedbackMessage,
  feedbackErrorCode = null,
  providerFilterOptions,
  selectedLenderFilter,
  selectedDirectionFilter,
  selectedTypeFilter,
  summary,
  onDirectionFilterChange,
  onLenderFilterChange,
  onResetFilters,
  onTypeFilterChange,
}: MonthlyExpensesLoansReportProps) {
  const splitTotal =
    summary.payableRemainingAmount + summary.receivableRemainingAmount;
  // Net balance shown as the user's position (what they are owed minus what they
  // owe), so a deficit reads as a negative red figure. The summary's
  // `netRemainingAmount` uses the inverse "net debt" convention
  // (payable − receivable), so we derive the position from the unambiguous
  // payable/receivable totals instead of reusing its sign.
  const netBalancePosition =
    summary.receivableRemainingAmount - summary.payableRemainingAmount;
  const netTone = getNetBalanceTone(netBalancePosition);
  const splitAriaLabel = `Distribución de deudas: yo debo ${formatArsAmount(
    summary.payableRemainingAmount,
  )}, me deben ${formatArsAmount(summary.receivableRemainingAmount)}.`;

  return (
    <section className={styles.content}>
      <header className={styles.hero}>
        <div className={styles.heroBalance}>
          <p className={styles.heroLabel}>Balance neto</p>
          <p className={styles.heroValue} data-tone={netTone}>
            {formatSignedArsAmount(netBalancePosition)}
          </p>
          <p className={styles.heroHint}>
            {getNetBalanceHint(netBalancePosition)}
          </p>
        </div>

        <dl className={styles.heroKpis}>
          <div className={styles.kpi}>
            <dt className={styles.kpiLabel}>Prestamistas con deuda</dt>
            <dd className={styles.kpiValue}>{summary.lenderCount}</dd>
          </div>
          <div className={styles.kpi}>
            <dt className={styles.kpiLabel}>Deudas activas</dt>
            <dd className={styles.kpiValue}>{summary.activeLoanCount}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.split}>
        <div
          aria-label={splitAriaLabel}
          className={styles.splitBar}
          role="img"
        >
          <span
            className={styles.splitPayable}
            style={{
              width: getWidthPercent(summary.payableRemainingAmount, splitTotal),
            }}
          />
          <span
            className={styles.splitReceivable}
            style={{
              width: getWidthPercent(
                summary.receivableRemainingAmount,
                splitTotal,
              ),
            }}
          />
        </div>
        <div className={styles.splitLegend}>
          <span className={styles.splitLegendItem}>
            <span className={`${styles.dot} ${styles.dotPayable}`} aria-hidden />
            Yo debo
            <strong>{formatArsAmount(summary.payableRemainingAmount)}</strong>
          </span>
          <span className={styles.splitLegendItem}>
            Me deben
            <strong>{formatArsAmount(summary.receivableRemainingAmount)}</strong>
            <span
              className={`${styles.dot} ${styles.dotReceivable}`}
              aria-hidden
            />
          </span>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.directionFilter}>
          <Label className={styles.filterLabel} id="loan-report-direction-label">
            Dirección
          </Label>
          <Tabs
            onValueChange={onDirectionFilterChange}
            value={selectedDirectionFilter}
          >
            <TabsList aria-labelledby="loan-report-direction-label">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="payable">Yo debo</TabsTrigger>
              <TabsTrigger value="receivable">Me deben</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

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
              <SelectItem value="unassigned">Sin prestamista</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterField}>
          <Label htmlFor="loan-report-lender-filter">Prestamista</Label>
          <Select
            onValueChange={onLenderFilterChange}
            value={selectedLenderFilter}
          >
            <SelectTrigger
              aria-label="Filtrar por prestamista"
              id="loan-report-lender-filter"
            >
              <SelectValue placeholder="Todos los prestamistas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los prestamistas</SelectItem>
              {providerFilterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className={styles.resetButton}
          onClick={onResetFilters}
          type="button"
          variant="outline"
        >
          <RotateCcw aria-hidden />
          Limpiar filtros
        </Button>
      </div>

      {feedbackMessage ? (
        <p className={styles.feedback}>
          <span>{feedbackMessage}</span>
          {feedbackErrorCode ? (
            <span className={styles.feedbackErrorCode}>{`Code: ${feedbackErrorCode}`}</span>
          ) : null}
        </p>
      ) : null}

      <div className={styles.entries}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article
              className={styles.entry}
              data-direction={entry.direction}
              key={`${entry.lenderId ?? entry.lenderName}-${entry.lenderType}`}
            >
              <div className={styles.entryHeader}>
                <Avatar className={styles.entryAvatar}>
                  <AvatarFallback className={styles.entryAvatarFallback}>
                    {getLenderInitials(entry.lenderName)}
                  </AvatarFallback>
                </Avatar>
                <div className={styles.entryIdentity}>
                  <h3 className={styles.entryTitle}>{entry.lenderName}</h3>
                  <Badge className={styles.typeBadge} variant="outline">
                    {getTypeLabel(entry.lenderType)}
                  </Badge>
                </div>
              </div>

              <div className={styles.entryAmountRow}>
                <span className={styles.directionBadge}>
                  {entry.direction === "payable" ? (
                    <ArrowUpRight aria-hidden />
                  ) : (
                    <ArrowDownLeft aria-hidden />
                  )}
                  {getDirectionLabel(entry.direction)}
                </span>
                <p className={styles.entryAmount}>
                  {formatArsAmount(entry.remainingAmount)}
                </p>
              </div>

              <div className={styles.entryMetaGrid}>
                <span className={styles.entryMetaItem}>
                  <CalendarDays aria-hidden />
                  Desde {entry.firstDebtMonth ?? MISSING_VALUE_LABEL}
                </span>
                <span className={styles.entryMetaItem}>
                  <Clock aria-hidden />
                  Últ. {entry.latestRecordedMonth ?? MISSING_VALUE_LABEL}
                </span>
                <span className={styles.entryMetaItem}>
                  <Flame aria-hidden />
                  {entry.activeLoanCount} activas
                </span>
                <span className={styles.entryMetaItem}>
                  <Layers aria-hidden />
                  {entry.trackedLoanCount} registradas
                </span>
              </div>

              <div className={styles.entryExpenses}>
                {entry.expenseDescriptions.length > 0 ? (
                  entry.expenseDescriptions.map((expense, index) => (
                    <Badge
                      className={styles.entryExpenseBadge}
                      key={`${expense.description}-${index}`}
                      variant="secondary"
                    >
                      {expense.count > 1
                        ? `${expense.description} ×${expense.count}`
                        : expense.description}
                    </Badge>
                  ))
                ) : (
                  <span className={styles.entryExpenseEmpty}>
                    Sin gastos asociados
                  </span>
                )}
              </div>
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
