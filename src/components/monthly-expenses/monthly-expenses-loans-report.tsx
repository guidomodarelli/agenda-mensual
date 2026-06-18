"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Flag, RotateCcw } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const MAX_AVATAR_INITIALS = 2;
/** Active-loan rows kept visible before the list starts scrolling. */
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
    receivableCurrentMonthAmount: number;
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

/** Aggregates paid and total installments across an entry's active loans. */
function getEntryInstallmentProgress(entry: MonthlyExpensesLoanReportView): {
  paidInstallments: number;
  totalInstallments: number;
} {
  return entry.activeLoans.reduce(
    (progress, loan) => ({
      paidInstallments: progress.paidInstallments + loan.paidInstallments,
      totalInstallments: progress.totalInstallments + loan.installmentCount,
    }),
    { paidInstallments: 0, totalInstallments: 0 },
  );
}

/**
 * Compact `firstMonth → lastMonth` span for an entry, collapsing to a single
 * month when both ends match and to `null` when neither month is recorded.
 */
function getEntryMonthSpan(entry: MonthlyExpensesLoanReportView): string | null {
  const { firstDebtMonth, latestRecordedMonth } = entry;

  if (!firstDebtMonth && !latestRecordedMonth) {
    return null;
  }

  if (firstDebtMonth && latestRecordedMonth && firstDebtMonth !== latestRecordedMonth) {
    return `${firstDebtMonth} → ${latestRecordedMonth}`;
  }

  return latestRecordedMonth ?? firstDebtMonth;
}

/** Lender type plus its active month span, shown under the lender name. */
function getEntrySubtitle(entry: MonthlyExpensesLoanReportView): string {
  const monthSpan = getEntryMonthSpan(entry);
  const typeLabel = getTypeLabel(entry.lenderType);

  return monthSpan ? `${typeLabel} · ${monthSpan}` : typeLabel;
}

/** Formats an active-loan-count action label, e.g. "Ver 3 deudas". */
function getExpandLoansLabel(activeLoanCount: number): string {
  return `Ver ${activeLoanCount} ${activeLoanCount === 1 ? "deuda" : "deudas"}`;
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
 * Compact inline switch between the total and current-month amounts. Repeated in
 * several places (balance and each "Yo debo"/"Me deben" section); all instances
 * share the same controlled state so toggling any of them updates every figure
 * at once.
 */
function AmountModeToggle({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (mode: LoansReportAmountMode) => void;
  value: LoansReportAmountMode;
}) {
  return (
    <span aria-label={ariaLabel} className={styles.amountModeToggle} role="group">
      <button
        aria-pressed={value === "total"}
        className={styles.amountModeOption}
        data-active={value === "total"}
        onClick={() => onChange("total")}
        type="button"
      >
        Total
      </button>
      <button
        aria-pressed={value === "month"}
        className={styles.amountModeOption}
        data-active={value === "month"}
        onClick={() => onChange("month")}
        type="button"
      >
        Este mes
      </button>
    </span>
  );
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
  const loansRef = useRef<HTMLDivElement>(null);
  const [areLoansExpanded, setAreLoansExpanded] = useState(false);
  const installmentProgress = getEntryInstallmentProgress(entry);
  const activeLoanCount = entry.activeLoans.length;

  // Cap the scroll container at the bottom of the Nth row so exactly
  // MAX_VISIBLE_ACTIVE_LOANS rows show before scrolling, regardless of how tall
  // each (variable-height) row ends up. Only runs while the list is expanded.
  useEffect(() => {
    const container = loansRef.current;

    if (!container) {
      return;
    }

    const applyMaxHeight = () => {
      const rows = container.children;

      if (rows.length <= MAX_VISIBLE_ACTIVE_LOANS) {
        container.style.maxHeight = "";
        return;
      }

      const lastVisibleRow = rows[MAX_VISIBLE_ACTIVE_LOANS - 1] as HTMLElement;
      const visibleHeight =
        lastVisibleRow.getBoundingClientRect().bottom -
        container.getBoundingClientRect().top;
      const nextMaxHeight = `${Math.ceil(visibleHeight)}px`;

      if (container.style.maxHeight !== nextMaxHeight) {
        container.style.maxHeight = nextMaxHeight;
      }
    };

    applyMaxHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(applyMaxHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [entry.activeLoans.length, areLoansExpanded]);

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
          <p className={styles.entrySubtitle}>{getEntrySubtitle(entry)}</p>
        </div>
      </div>

      <div className={styles.entryAmountBlock}>
        <span className={styles.entryAmountLabel}>
          {amountMode === "month" ? "Este mes" : "Total"}
        </span>
        <p className={styles.entryAmount}>
          {formatArsAmount(getEntryDisplayAmount(entry, amountMode))}
        </p>
      </div>

      <div className={styles.entryProgress}>
        <div className={styles.entryProgressMeta}>
          <span>Cuotas pagadas</span>
          <span className={styles.entryProgressValue}>
            {installmentProgress.paidInstallments} de{" "}
            {installmentProgress.totalInstallments}
          </span>
        </div>
        <div aria-hidden className={styles.entryProgressTrack}>
          <div
            className={styles.entryProgressFill}
            style={{
              width: getWidthPercent(
                installmentProgress.paidInstallments,
                installmentProgress.totalInstallments,
              ),
            }}
          />
        </div>
      </div>

      {activeLoanCount > 0 ? (
        <>
          <Button
            aria-expanded={areLoansExpanded}
            className={styles.entryLoansToggle}
            onClick={() => setAreLoansExpanded((expanded) => !expanded)}
            type="button"
            variant="ghost"
          >
            {areLoansExpanded ? "Ocultar" : getExpandLoansLabel(activeLoanCount)}
            {areLoansExpanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          </Button>
          {areLoansExpanded ? (
            <div className={styles.entryLoans} ref={loansRef}>
              {entry.activeLoans.map((loan, index) => (
                <ActiveLoanRow
                  key={`${loan.description}-${loan.endMonth}-${index}`}
                  loan={loan}
                />
              ))}
            </div>
          ) : null}
        </>
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

  // Every aggregate figure (balance, "Yo debo"/"Me deben" metrics, cards)
  // follows the same Total/Este mes toggle, so they all stay in sync.
  const isMonthMode = amountMode === "month";
  const payableShown = isMonthMode
    ? summary.payableCurrentMonthAmount
    : summary.payableRemainingAmount;
  const receivableShown = isMonthMode
    ? summary.receivableCurrentMonthAmount
    : summary.receivableRemainingAmount;
  // Net balance shown as the user's position (what they are owed minus what they
  // owe), so a deficit reads as a negative red figure.
  const netBalancePosition = receivableShown - payableShown;
  const netTone = getNetBalanceTone(netBalancePosition);

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
        <div className={styles.heroLabelRow}>
          <span className={styles.heroLabel}>Balance neto</span>
          <AmountModeToggle
            ariaLabel="Mostrar montos totales o de este mes"
            onChange={setAmountMode}
            value={amountMode}
          />
        </div>
        <p className={styles.heroValue} data-tone={netTone}>
          {formatSignedArsAmount(netBalancePosition)}
        </p>
        <p className={styles.heroHint}>{getNetBalanceHint(netBalancePosition)}</p>
      </header>

      <dl className={styles.metrics}>
        <div className={styles.metricCard}>
          <dt className={styles.metricLabel}>Yo debo</dt>
          <dd className={styles.metricValue} data-tone="negative">
            {formatArsAmount(payableShown)}
          </dd>
        </div>
        <div className={styles.metricCard}>
          <dt className={styles.metricLabel}>Me deben</dt>
          <dd className={styles.metricValue}>{formatArsAmount(receivableShown)}</dd>
        </div>
        <div className={styles.metricCard}>
          <dt className={styles.metricLabel}>Prestamistas con deuda</dt>
          <dd className={styles.metricValue}>{summary.lenderCount}</dd>
        </div>
        <div className={styles.metricCard}>
          <dt className={styles.metricLabel}>Deudas activas</dt>
          <dd className={styles.metricValue}>{summary.activeLoanCount}</dd>
        </div>
      </dl>

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
              <AmountModeToggle
                ariaLabel={`Mostrar ${section.title} total o de este mes`}
                onChange={setAmountMode}
                value={amountMode}
              />
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
