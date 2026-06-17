"use client";

import { useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Flag,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import styles from "./monthly-expenses-loans-report.module.scss";

type TechnicalErrorCode = `E${number}${number}${number}${number}`;

type MonthlyExpensesLoanDirection = "payable" | "receivable";

type MonthlyExpenseLoanCurrency = "ARS" | "USD";

type MonthlyExpensesLenderType =
  | "bank"
  | "family"
  | "friend"
  | "other"
  | "unassigned";

type LoansReportSortKey = "amount" | "due" | "lender";
type LoansReportAmountMode = "month" | "total";

const arsCurrencyFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const MISSING_VALUE_LABEL = "Sin dato";
const MAX_AVATAR_INITIALS = 2;
const MAX_VISIBLE_ACTIVE_LOANS = 3;

const LENDER_TYPE_SHADE: Record<MonthlyExpensesLenderType, number> = {
  bank: 1,
  family: 0.72,
  friend: 0.52,
  other: 0.36,
  unassigned: 0.22,
};

interface MonthlyExpensesLoanReportActiveLoanView {
  currency: MonthlyExpenseLoanCurrency;
  currentMonthAmount: number;
  currentMonthAmountOriginal: number | null;
  description: string;
  endMonth: string;
  installmentCount: number;
  isDueSoon: boolean;
  paidInstallments: number;
  remainingAmount: number;
  remainingAmountOriginal: number | null;
}

interface MonthlyExpensesLoanReportProjectionMonthView {
  amount: number;
  month: string;
}

interface MonthlyExpensesLoanReportView {
  activeLoanCount: number;
  activeLoans: MonthlyExpensesLoanReportActiveLoanView[];
  direction: MonthlyExpensesLoanDirection;
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
    payableCurrentMonthAmount: number;
    lenderCount: number;
    monthlyProjection: MonthlyExpensesLoanReportProjectionMonthView[];
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
 */
function formatSignedArsAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "$ 0";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${formatArsAmount(Math.abs(value))}`;
}

/**
 * Formats an active loan's remaining amount, showing the original USD figure
 * next to the converted ARS one when the loan is not in pesos.
 */
function formatActiveLoanRemaining(
  loan: MonthlyExpensesLoanReportActiveLoanView,
): string {
  if (loan.remainingAmountOriginal === null) {
    return formatArsAmount(loan.remainingAmount);
  }

  return `US$ ${arsCurrencyFormatter.format(loan.remainingAmountOriginal)} → ${formatArsAmount(
    loan.remainingAmount,
  )}`;
}

/** Formats the current-month installment, showing the USD origin when present. */
function formatActiveLoanCurrentMonth(
  loan: MonthlyExpensesLoanReportActiveLoanView,
): string {
  if (loan.currentMonthAmountOriginal === null) {
    return formatArsAmount(loan.currentMonthAmount);
  }

  return `US$ ${arsCurrencyFormatter.format(loan.currentMonthAmountOriginal)} → ${formatArsAmount(
    loan.currentMonthAmount,
  )}`;
}

function getDirectionLabel(direction: MonthlyExpensesLoanDirection): string {
  return direction === "payable" ? "Yo debo" : "Me deben";
}

/**
 * Resolves the human hint that explains the net balance sign in plain Spanish.
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

/** Earliest loan end month for an entry, used to sort by upcoming due date. */
function getEntryNextDueMonth(entry: MonthlyExpensesLoanReportView): string | null {
  return entry.activeLoans.reduce<string | null>((earliest, loan) => {
    if (earliest === null || loan.endMonth < earliest) {
      return loan.endMonth;
    }

    return earliest;
  }, null);
}

function sortReportEntries(
  entries: MonthlyExpensesLoanReportView[],
  sortKey: LoansReportSortKey,
): MonthlyExpensesLoanReportView[] {
  return [...entries].sort((left, right) => {
    if (sortKey === "lender") {
      return left.lenderName.localeCompare(right.lenderName, "es");
    }

    if (sortKey === "due") {
      const leftDue = getEntryNextDueMonth(left) ?? "9999-12";
      const rightDue = getEntryNextDueMonth(right) ?? "9999-12";

      if (leftDue !== rightDue) {
        return leftDue.localeCompare(rightDue);
      }

      return right.remainingAmount - left.remainingAmount;
    }

    if (right.remainingAmount !== left.remainingAmount) {
      return right.remainingAmount - left.remainingAmount;
    }

    return left.lenderName.localeCompare(right.lenderName, "es");
  });
}

/** Sum of the current-month installments across an entry's active loans. */
function getEntryCurrentMonthAmount(
  entry: MonthlyExpensesLoanReportView,
): number {
  return entry.activeLoans.reduce(
    (total, loan) => total + loan.currentMonthAmount,
    0,
  );
}

/** Picks the entry amount to show for the selected month/total mode. */
function getEntryDisplayAmount(
  entry: MonthlyExpensesLoanReportView,
  amountMode: LoansReportAmountMode,
): number {
  return amountMode === "month"
    ? getEntryCurrentMonthAmount(entry)
    : entry.remainingAmount;
}

/** Formats a `YYYY-MM` identifier as a compact `MM/AA` label. */
function formatProjectionMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");

  return `${monthNumber}/${year.slice(2)}`;
}

/** Aggregates payable amounts by lender type for the "what you owe" breakdown. */
function getPayableAmountByLenderType(
  entries: MonthlyExpensesLoanReportView[],
): Array<{ amount: number; lenderType: MonthlyExpensesLenderType }> {
  const amountByType = new Map<MonthlyExpensesLenderType, number>();

  for (const entry of entries) {
    if (entry.direction !== "payable") {
      continue;
    }

    amountByType.set(
      entry.lenderType,
      (amountByType.get(entry.lenderType) ?? 0) + entry.remainingAmount,
    );
  }

  return [...amountByType.entries()]
    .map(([lenderType, amount]) => ({ amount, lenderType }))
    .filter((segment) => segment.amount > 0)
    .sort((left, right) => right.amount - left.amount);
}

/**
 * Renders a loan description that truncates with an ellipsis, surfacing the full
 * text in a tooltip only when it is actually clipped. Truncation is measured at
 * open time (hover/focus), when layout and fonts are already settled.
 */
function TruncatedLoanName({ description }: { description: string }) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsTooltipOpen(false);
      return;
    }

    const element = nameRef.current;

    setIsTooltipOpen(
      Boolean(element) && element!.scrollWidth > element!.clientWidth,
    );
  };

  return (
    <TooltipProvider>
      <Tooltip onOpenChange={handleOpenChange} open={isTooltipOpen}>
        <TooltipTrigger asChild>
          <span className={styles.entryLoanName} ref={nameRef}>
            {description}
          </span>
        </TooltipTrigger>
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActiveLoanRow({
  loan,
}: {
  loan: MonthlyExpensesLoanReportActiveLoanView;
}) {
  return (
    <div className={styles.entryLoan} data-due-soon={loan.isDueSoon}>
      <div className={styles.entryLoanHead}>
        <TruncatedLoanName description={loan.description} />
        {loan.isDueSoon ? (
          <span
            className={styles.dueSoonBadge}
            data-final={loan.paidInstallments >= loan.installmentCount}
          >
            <Flag aria-hidden />
            {loan.paidInstallments >= loan.installmentCount
              ? "Finaliza"
              : "Última cuota"}
          </span>
        ) : null}
      </div>
      <div className={styles.entryLoanMeta}>
        <span className={styles.entryLoanInstallments}>
          Cuota {loan.paidInstallments} de {loan.installmentCount}
        </span>
        <span className={styles.entryLoanAmount}>
          {formatActiveLoanCurrentMonth(loan)}
          <span className={styles.entryLoanAmountUnit}> este mes</span>
        </span>
      </div>
      <p className={styles.entryLoanRemaining}>
        {loan.installmentCount - loan.paidInstallments > 0
          ? `Restan ${loan.installmentCount - loan.paidInstallments} · ${formatActiveLoanRemaining(loan)} en total`
          : "Sin cuotas restantes"}
      </p>
      <div
        aria-hidden
        className={styles.loanProgressTrack}
      >
        <div
          className={styles.loanProgressFill}
          style={{
            width: getWidthPercent(loan.paidInstallments, loan.installmentCount),
          }}
        />
      </div>
    </div>
  );
}

function LoanReportEntryCard({
  amountMode,
  entry,
}: {
  amountMode: LoansReportAmountMode;
  entry: MonthlyExpensesLoanReportView;
}) {
  const [isLoansExpanded, setIsLoansExpanded] = useState(false);
  const hiddenLoanCount = entry.activeLoans.length - MAX_VISIBLE_ACTIVE_LOANS;
  const visibleLoans = isLoansExpanded
    ? entry.activeLoans
    : entry.activeLoans.slice(0, MAX_VISIBLE_ACTIVE_LOANS);
  const currentMonthAmount = getEntryCurrentMonthAmount(entry);
  const secondaryCaption =
    amountMode === "month"
      ? `Total ${formatArsAmount(entry.remainingAmount)}`
      : `Este mes ${formatArsAmount(currentMonthAmount)}`;

  return (
    <article className={styles.entry} data-direction={entry.direction}>
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
        <div className={styles.entryAmountBlock}>
          <p className={styles.entryAmount}>
            {formatArsAmount(getEntryDisplayAmount(entry, amountMode))}
          </p>
          <p className={styles.entryAmountCaption}>{secondaryCaption}</p>
        </div>
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
      </div>

      <div className={styles.entryLoans} data-expanded={isLoansExpanded}>
        {visibleLoans.map((loan, index) => (
          <ActiveLoanRow key={`${loan.description}-${loan.endMonth}-${index}`} loan={loan} />
        ))}
      </div>
      {hiddenLoanCount > 0 ? (
        <button
          aria-expanded={isLoansExpanded}
          className={styles.moreLoans}
          onClick={() => setIsLoansExpanded((expanded) => !expanded)}
          type="button"
        >
          {isLoansExpanded ? "Ver menos" : `+${hiddenLoanCount} más`}
        </button>
      ) : null}
    </article>
  );
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
  const [sortKey, setSortKey] = useState<LoansReportSortKey>("amount");
  const [amountMode, setAmountMode] = useState<LoansReportAmountMode>("total");

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

  const sortedEntries = sortReportEntries(entries, sortKey);
  const sections = (
    [
      { direction: "payable", title: "Yo debo" },
      { direction: "receivable", title: "Me deben" },
    ] as const
  )
    .map((section) => {
      const sectionEntries = sortedEntries.filter(
        (entry) => entry.direction === section.direction,
      );

      return {
        ...section,
        entries: sectionEntries,
        subtotal: sectionEntries.reduce(
          (total, entry) => total + getEntryDisplayAmount(entry, amountMode),
          0,
        ),
      };
    })
    .filter((section) => section.entries.length > 0);

  const payableByLenderType = getPayableAmountByLenderType(entries);
  const payableTypeTotal = payableByLenderType.reduce(
    (total, segment) => total + segment.amount,
    0,
  );
  const showTypeBreakdown = payableByLenderType.length > 1;

  const maxProjectionAmount = summary.monthlyProjection.reduce(
    (max, point) => Math.max(max, point.amount),
    0,
  );
  const projectionLabelStep = Math.max(
    1,
    Math.ceil(summary.monthlyProjection.length / 6),
  );

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
          <p className={styles.heroMeta}>
            {summary.lenderCount} prestamistas · {summary.activeLoanCount} deudas
            activas
          </p>
        </div>

        <dl className={styles.heroKpis}>
          <div className={styles.kpi}>
            <dt className={styles.kpiLabel}>Debés este mes</dt>
            <dd className={styles.kpiValue}>
              {formatArsAmount(summary.payableCurrentMonthAmount)}
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt className={styles.kpiLabel}>Debés en total</dt>
            <dd className={styles.kpiValue}>
              {formatArsAmount(summary.payableRemainingAmount)}
            </dd>
          </div>
        </dl>
      </header>

      <div className={styles.split}>
        <div aria-label={splitAriaLabel} className={styles.splitBar} role="img">
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
            <span className={`${styles.dot} ${styles.dotReceivable}`} aria-hidden />
          </span>
        </div>
      </div>

      {showTypeBreakdown ? (
        <div className={styles.typeBreakdown}>
          <p className={styles.typeBreakdownLabel}>Lo que debés por tipo</p>
          <div
            aria-hidden
            className={styles.typeBreakdownBar}
          >
            {payableByLenderType.map((segment) => (
              <span
                className={styles.typeBreakdownSegment}
                key={segment.lenderType}
                style={{
                  opacity: LENDER_TYPE_SHADE[segment.lenderType],
                  width: getWidthPercent(segment.amount, payableTypeTotal),
                }}
              />
            ))}
          </div>
          <div className={styles.typeBreakdownLegend}>
            {payableByLenderType.map((segment) => (
              <span className={styles.typeBreakdownLegendItem} key={segment.lenderType}>
                <span
                  aria-hidden
                  className={styles.typeBreakdownSwatch}
                  style={{ opacity: LENDER_TYPE_SHADE[segment.lenderType] }}
                />
                {getTypeLabel(segment.lenderType)}
                <strong>{formatArsAmount(segment.amount)}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {summary.monthlyProjection.length > 0 ? (
        <div className={styles.projection}>
          <p className={styles.projectionLabel}>Lo que pagás los próximos meses</p>
          <div className={styles.projectionChart}>
            {summary.monthlyProjection.map((point, index) => (
              <div
                className={styles.projectionBar}
                data-current={index === 0}
                key={point.month}
                title={`${formatProjectionMonthLabel(point.month)}: ${formatArsAmount(point.amount)}`}
              >
                <span className={styles.projectionTrack}>
                  <span
                    className={styles.projectionFill}
                    style={{
                      height: getWidthPercent(point.amount, maxProjectionAmount),
                    }}
                  />
                </span>
                <span className={styles.projectionMonth}>
                  {index % projectionLabelStep === 0
                    ? formatProjectionMonthLabel(point.month)
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.filters}>
        <div className={styles.directionFilter}>
          <Label className={styles.filterLabel} id="loan-report-amount-mode-label">
            Mostrar
          </Label>
          <Tabs
            onValueChange={(value) =>
              setAmountMode(value as LoansReportAmountMode)
            }
            value={amountMode}
          >
            <TabsList aria-labelledby="loan-report-amount-mode-label">
              <TabsTrigger value="total">Total</TabsTrigger>
              <TabsTrigger value="month">Este mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

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
          <Label className={styles.filterLabel} htmlFor="loan-report-type-filter">
            Tipo
          </Label>
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
          <Label
            className={styles.filterLabel}
            htmlFor="loan-report-lender-filter"
          >
            Prestamista
          </Label>
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

        <div className={styles.filterField}>
          <Label className={styles.filterLabel} htmlFor="loan-report-sort">
            Ordenar por
          </Label>
          <Select
            onValueChange={(value) => setSortKey(value as LoansReportSortKey)}
            value={sortKey}
          >
            <SelectTrigger aria-label="Ordenar deudas" id="loan-report-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">Monto</SelectItem>
              <SelectItem value="due">Vencimiento</SelectItem>
              <SelectItem value="lender">Prestamista</SelectItem>
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

      {sections.length > 0 ? (
        sections.map((section) => (
          <div className={styles.section} key={section.direction}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{section.title}</h3>
              <span
                className={styles.sectionSubtotal}
                data-direction={section.direction}
              >
                {formatArsAmount(section.subtotal)}
              </span>
            </div>
            <div className={styles.entries}>
              {section.entries.map((entry) => (
                <LoanReportEntryCard
                  amountMode={amountMode}
                  entry={entry}
                  key={`${entry.lenderId ?? entry.lenderName}-${entry.lenderType}`}
                />
              ))}
            </div>
          </div>
        ))
      ) : feedbackMessage ? null : (
        <p className={styles.feedback}>
          No hay deudas para los filtros seleccionados.
        </p>
      )}
    </section>
  );
}
