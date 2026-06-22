/**
 * Builds the monthly expenses loans report from stored loan snapshots.
 *
 * @module getMonthlyExpensesLoansReport
 */
import type { LenderType } from "@/modules/lenders/domain/value-objects/lenders-catalog-document";

import {
  calculateLoanEndMonth,
  calculatePaidLoanInstallments,
} from "../../domain/value-objects/monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type {
  MonthlyExpenseCurrency,
  MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import type {
  MonthlyExpensesLoanReportActiveLoan,
  MonthlyExpensesLoanReportEntry,
  MonthlyExpensesLoanReportDirection,
  MonthlyExpensesLoanReportLenderType,
  MonthlyExpensesLoanReportProjectionMonth,
  MonthlyExpensesLoansReportResult,
} from "../results/monthly-expenses-loans-report-result";

/** Upper bound of months shown in the upcoming-payments projection. */
const MAX_PROJECTION_MONTHS = 24;

interface ReportLenderInput {
  id: string;
  name: string;
  type: LenderType;
}

interface GetMonthlyExpensesLoansReportDependencies {
  /**
   * Month (`YYYY-MM`) used to decide whether a loan is already settled. Defaults
   * to the current calendar month. A loan whose end month is before this value
   * has no remaining installments even if its latest stored snapshot still shows
   * a pending one (finished loans stop being copied forward, so their snapshot
   * freezes one installment short of completion).
   */
  currentMonth?: string;
  lenders: ReportLenderInput[];
  repository: MonthlyExpensesRepository;
  /**
   * Resolves a fallback USD→ARS solidarity rate, used only when no stored document
   * carries an exchange-rate snapshot. Legacy months persisted before snapshots
   * existed leave their USD loans without a stored rate; without this resolver the
   * report would silently value those USD amounts as ARS (and cache that wrong
   * first result). The resolver lets the report backfill a real rate from the
   * exchange-rate source instead. Optional: omit for ARS-only data or unit tests;
   * when omitted (or it resolves `null`) the native amount remains the last
   * resort, preserving previous behavior. It is invoked at most once, and only
   * when at least one USD loan lacks any stored rate.
   */
  resolveFallbackSolidarityRate?: () => Promise<number | null>;
}

/**
 * Resolves the current calendar month as a `YYYY-MM` identifier.
 *
 * @param date - Reference date; defaults to now.
 * @returns The current month identifier.
 */
export function getCurrentMonthIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

interface LoanSnapshot {
  currency: MonthlyExpenseCurrency;
  description: string;
  direction: MonthlyExpensesLoanReportDirection;
  expenseId: string;
  lenderId: string | null;
  lenderName: string | null;
  monthlyAmount: number;
  month: string;
  /**
   * USD→ARS solidarity rate captured from the document this snapshot belongs to,
   * or `null` when that document carries no exchange-rate snapshot.
   */
  solidarityRate: number | null;
  startMonth: string;
  totalInstallments: number;
}

/**
 * Gets the stable identity used to keep only the newest state of one loan.
 *
 * @param snapshot - Loan snapshot collected from one monthly document.
 * @returns Stable expense identifier shared by the same loan across months.
 */
function getLoanSnapshotKey(snapshot: LoanSnapshot): string {
  return snapshot.expenseId;
}

function resolveLender(
  snapshot: LoanSnapshot,
  lenders: ReportLenderInput[],
): {
  lenderId: string | null;
  lenderName: string;
  lenderType: MonthlyExpensesLoanReportLenderType;
} {
  const lenderById = snapshot.lenderId
    ? lenders.find((lender) => lender.id === snapshot.lenderId)
    : null;

  if (lenderById) {
    return {
      lenderId: lenderById.id,
      lenderName: lenderById.name,
      lenderType: lenderById.type,
    };
  }

  const lenderByName = snapshot.lenderName
    ? lenders.find(
        (lender) =>
          lender.name.toLocaleLowerCase() ===
          snapshot.lenderName?.toLocaleLowerCase(),
      )
    : null;

  if (lenderByName) {
    return {
      lenderId: lenderByName.id,
      lenderName: lenderByName.name,
      lenderType: lenderByName.type,
    };
  }

  if (snapshot.lenderName) {
    return {
      lenderId: null,
      lenderName: snapshot.lenderName,
      lenderType: "other",
    };
  }

  return {
    lenderId: null,
    lenderName: "Sin prestamista",
    lenderType: "unassigned",
  };
}

function compareMonthIdentifiers(left: string, right: string): number {
  return left.localeCompare(right);
}

/**
 * Creates report snapshots from every loan item stored in monthly documents.
 *
 * @param documents - Monthly expenses documents to scan for loan items.
 * @returns Loan snapshots ready to deduplicate by stable expense identity.
 */
function createLoanSnapshots(documents: MonthlyExpensesDocument[]): LoanSnapshot[] {
  return documents.flatMap((document) =>
    document.items.flatMap((item) =>
      item.loan
        ? [
            {
              currency: item.currency,
              description: item.description,
              direction: item.loan.direction ?? "payable",
              expenseId: item.id,
              lenderId: item.loan.lenderId ?? null,
              lenderName: item.loan.lenderName ?? null,
              month: document.month,
              monthlyAmount: item.total,
              solidarityRate: document.exchangeRateSnapshot?.solidarityRate ?? null,
              startMonth: item.loan.startMonth,
              totalInstallments: item.loan.installmentCount,
            },
          ]
        : [],
    ),
  );
}

/**
 * Resolves the most recent USD→ARS solidarity rate across all documents, used as
 * a fallback to convert USD loans whose own document lacks an exchange-rate
 * snapshot.
 *
 * @param documents - Monthly expenses documents to scan for exchange rates.
 * @returns The latest available solidarity rate, or `null` when none exists.
 */
function getLatestSolidarityRate(
  documents: MonthlyExpensesDocument[],
): number | null {
  let latestMonth: string | null = null;
  let latestSolidarityRate: number | null = null;

  for (const document of documents) {
    const solidarityRate = document.exchangeRateSnapshot?.solidarityRate;

    if (
      typeof solidarityRate === "number" &&
      (latestMonth === null ||
        compareMonthIdentifiers(document.month, latestMonth) > 0)
    ) {
      latestMonth = document.month;
      latestSolidarityRate = solidarityRate;
    }
  }

  return latestSolidarityRate;
}

/**
 * Converts a loan's remaining amount into ARS. ARS loans pass through; USD loans
 * are multiplied by the solidarity rate (the snapshot's own rate when present,
 * otherwise the latest available rate). When no rate exists at all, the native
 * USD amount is returned as a last resort so the debt is not dropped.
 */
function convertRemainingAmountToArs({
  currency,
  fallbackSolidarityRate,
  nativeRemainingAmount,
  solidarityRate,
}: {
  currency: MonthlyExpenseCurrency;
  fallbackSolidarityRate: number | null;
  nativeRemainingAmount: number;
  solidarityRate: number | null;
}): number {
  if (currency !== "USD") {
    return nativeRemainingAmount;
  }

  const effectiveSolidarityRate = solidarityRate ?? fallbackSolidarityRate;

  if (effectiveSolidarityRate === null) {
    return nativeRemainingAmount;
  }

  return nativeRemainingAmount * effectiveSolidarityRate;
}

/**
 * Adds a number of months to a `YYYY-MM` identifier.
 *
 * @param month - Base month identifier.
 * @param monthsToAdd - Months to add (may be negative).
 * @returns The shifted month identifier.
 */
function addMonthsToMonthIdentifier(month: string, monthsToAdd: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = year * 12 + (monthNumber - 1) + monthsToAdd;
  const shiftedYear = Math.floor(monthIndex / 12);
  const shiftedMonth = (monthIndex % 12) + 1;

  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

/**
 * Appends an active loan to the per-entry accumulator.
 *
 * @param loansByEntry - Per-entry active-loan list being accumulated.
 * @param entryKey - Stable lender entry identifier.
 * @param loan - Active loan to record.
 */
function appendActiveLoan(
  loansByEntry: Map<string, MonthlyExpensesLoanReportActiveLoan[]>,
  entryKey: string,
  loan: MonthlyExpensesLoanReportActiveLoan,
): void {
  const loans = loansByEntry.get(entryKey) ?? [];
  loans.push(loan);
  loansByEntry.set(entryKey, loans);
}

function sortActiveLoansByRemainingAmount(
  loans: MonthlyExpensesLoanReportActiveLoan[] | undefined,
): MonthlyExpensesLoanReportActiveLoan[] {
  if (!loans) {
    return [];
  }

  return [...loans].sort((left, right) => {
    if (right.remainingAmount !== left.remainingAmount) {
      return right.remainingAmount - left.remainingAmount;
    }

    return left.description.localeCompare(right.description, "es");
  });
}

/**
 * Builds a contiguous month-by-month projection from the current month up to the
 * last month that still carries an installment.
 *
 * @param currentMonth - First month of the projection.
 * @param amountByMonth - Accumulated payable amount per month.
 * @returns Ordered projection, empty when there is nothing to pay ahead.
 */
function buildMonthlyProjection(
  currentMonth: string,
  amountByMonth: Map<string, number>,
): MonthlyExpensesLoanReportProjectionMonth[] {
  const months = [...amountByMonth.keys()].sort(compareMonthIdentifiers);
  const lastMonth = months[months.length - 1];

  if (!lastMonth) {
    return [];
  }

  const projection: MonthlyExpensesLoanReportProjectionMonth[] = [];
  let month = currentMonth;

  while (compareMonthIdentifiers(month, lastMonth) <= 0) {
    projection.push({ amount: amountByMonth.get(month) ?? 0, month });
    month = addMonthsToMonthIdentifier(month, 1);
  }

  return projection;
}

export async function getMonthlyExpensesLoansReport({
  currentMonth = getCurrentMonthIdentifier(),
  lenders,
  repository,
  resolveFallbackSolidarityRate,
}: GetMonthlyExpensesLoansReportDependencies): Promise<MonthlyExpensesLoansReportResult> {
  const documents =
    typeof (repository as Partial<MonthlyExpensesRepository>).listAll === "function"
      ? await repository.listAll()
      : [];
  const loanSnapshots = createLoanSnapshots(documents);
  // Prefer the latest rate stored across documents. Only when none exists do we
  // resolve a real fallback from the exchange-rate source, and only if there is a
  // USD loan that would otherwise be valued as ARS. This keeps legacy months
  // (persisted without a snapshot) from producing a wrong, then cached, report.
  const storedFallbackSolidarityRate = getLatestSolidarityRate(documents);
  const hasUsdLoanMissingRate =
    storedFallbackSolidarityRate === null &&
    loanSnapshots.some(
      (snapshot) => snapshot.currency === "USD" && snapshot.solidarityRate === null,
    );
  const fallbackSolidarityRate =
    hasUsdLoanMissingRate && resolveFallbackSolidarityRate
      ? await resolveFallbackSolidarityRate()
      : storedFallbackSolidarityRate;
  const dueSoonThresholdMonth = addMonthsToMonthIdentifier(currentMonth, 1);
  const latestSnapshotsByLoan = new Map<string, LoanSnapshot>();

  for (const snapshot of loanSnapshots) {
    const snapshotKey = getLoanSnapshotKey(snapshot);
    const currentSnapshot = latestSnapshotsByLoan.get(snapshotKey);

    if (
      !currentSnapshot ||
      compareMonthIdentifiers(snapshot.month, currentSnapshot.month) > 0
    ) {
      latestSnapshotsByLoan.set(snapshotKey, snapshot);
    }
  }

  const entriesByLender = new Map<string, MonthlyExpensesLoanReportEntry>();
  const activeLoansByEntry = new Map<
    string,
    MonthlyExpensesLoanReportActiveLoan[]
  >();
  const projectionAmountByMonth = new Map<string, number>();
  const projectionCapMonth = addMonthsToMonthIdentifier(
    currentMonth,
    MAX_PROJECTION_MONTHS - 1,
  );

  for (const snapshot of latestSnapshotsByLoan.values()) {
    const { lenderId, lenderName, lenderType } = resolveLender(snapshot, lenders);
    const entryKey = `${snapshot.direction}|${lenderId ?? lenderName}|${lenderType}`;
    const loanEndMonth = calculateLoanEndMonth({
      installmentCount: snapshot.totalInstallments,
      startMonth: snapshot.startMonth,
    });
    // A loan stays visible through the month of its final installment ("X de X")
    // and is only dropped the month after its end month. Paid installments are
    // recomputed against the current month rather than trusting the latest stored
    // snapshot (a finished loan stops being copied forward, freezing one
    // installment short). At the end month every installment is paid, so the loan
    // still shows with a $0 remaining balance; past the end month it is settled.
    const isLoanSettled =
      compareMonthIdentifiers(currentMonth, loanEndMonth) > 0;
    const paidInstallments = calculatePaidLoanInstallments({
      installmentCount: snapshot.totalInstallments,
      startMonth: snapshot.startMonth,
      targetMonth: currentMonth,
    });
    const remainingInstallments = isLoanSettled
      ? 0
      : Math.max(snapshot.totalInstallments - paidInstallments, 0);
    const nativeRemainingAmount = Number(
      (snapshot.monthlyAmount * remainingInstallments).toFixed(2),
    );
    const remainingAmount = Number(
      convertRemainingAmountToArs({
        currency: snapshot.currency,
        fallbackSolidarityRate,
        nativeRemainingAmount: snapshot.monthlyAmount * remainingInstallments,
        solidarityRate: snapshot.solidarityRate,
      }).toFixed(2),
    );
    const currentEntry = entriesByLender.get(entryKey);

    // A settled loan (past its end month) must not surface as a current debt: it
    // adds neither an active-loan row, timeline, nor active count, and on its own
    // it cannot keep a lender in the report. It is still counted in
    // `trackedLoanCount` so "registered" loans reflect history.
    const isActiveLoan = !isLoanSettled;
    // The "this month" obligation is a single installment, charged only once the
    // loan has started. The total remaining (above) covers the future ones.
    const hasInstallmentThisMonth =
      isActiveLoan &&
      compareMonthIdentifiers(currentMonth, snapshot.startMonth) >= 0;
    const installmentArsAmount = Number(
      convertRemainingAmountToArs({
        currency: snapshot.currency,
        fallbackSolidarityRate,
        nativeRemainingAmount: snapshot.monthlyAmount,
        solidarityRate: snapshot.solidarityRate,
      }).toFixed(2),
    );

    if (isActiveLoan) {
      appendActiveLoan(activeLoansByEntry, entryKey, {
        currency: snapshot.currency,
        currentMonthAmount: hasInstallmentThisMonth ? installmentArsAmount : 0,
        currentMonthAmountOriginal:
          snapshot.currency === "USD" && hasInstallmentThisMonth
            ? Number(snapshot.monthlyAmount.toFixed(2))
            : null,
        description: snapshot.description,
        endMonth: loanEndMonth,
        installmentCount: snapshot.totalInstallments,
        isDueSoon:
          compareMonthIdentifiers(loanEndMonth, dueSoonThresholdMonth) <= 0,
        paidInstallments,
        remainingAmount,
        remainingAmountOriginal:
          snapshot.currency === "USD" ? nativeRemainingAmount : null,
      });

      // Accumulate one installment per upcoming month the loan is still being
      // paid, from the current month (or its start, if later) up to its end.
      let projectionMonth =
        compareMonthIdentifiers(snapshot.startMonth, currentMonth) > 0
          ? snapshot.startMonth
          : currentMonth;

      while (
        compareMonthIdentifiers(projectionMonth, loanEndMonth) <= 0 &&
        compareMonthIdentifiers(projectionMonth, projectionCapMonth) <= 0
      ) {
        projectionAmountByMonth.set(
          projectionMonth,
          Number(
            (
              (projectionAmountByMonth.get(projectionMonth) ?? 0) +
              installmentArsAmount
            ).toFixed(2),
          ),
        );
        projectionMonth = addMonthsToMonthIdentifier(projectionMonth, 1);
      }
    }

    if (!currentEntry) {
      entriesByLender.set(entryKey, {
        activeLoanCount: isActiveLoan ? 1 : 0,
        activeLoans: [],
        direction: snapshot.direction,
        firstDebtMonth: isActiveLoan ? snapshot.startMonth : null,
        lenderId,
        lenderName,
        lenderType,
        latestRecordedMonth: isActiveLoan ? snapshot.month : null,
        remainingAmount,
        trackedLoanCount: 1,
      });
      continue;
    }

    currentEntry.trackedLoanCount += 1;
    currentEntry.remainingAmount = Number(
      (currentEntry.remainingAmount + remainingAmount).toFixed(2),
    );

    if (!isActiveLoan) {
      continue;
    }

    currentEntry.activeLoanCount += 1;
    currentEntry.firstDebtMonth =
      currentEntry.firstDebtMonth &&
      compareMonthIdentifiers(currentEntry.firstDebtMonth, snapshot.startMonth) <= 0
        ? currentEntry.firstDebtMonth
        : snapshot.startMonth;
    currentEntry.latestRecordedMonth =
      currentEntry.latestRecordedMonth &&
      compareMonthIdentifiers(currentEntry.latestRecordedMonth, snapshot.month) >= 0
        ? currentEntry.latestRecordedMonth
        : snapshot.month;
  }

  for (const [entryKey, entry] of entriesByLender) {
    entry.activeLoans = sortActiveLoansByRemainingAmount(
      activeLoansByEntry.get(entryKey),
    );
  }

  const entries = [...entriesByLender.values()]
    .filter((entry) => entry.activeLoans.length > 0)
    .sort((left, right) => {
    if (right.remainingAmount !== left.remainingAmount) {
      return right.remainingAmount - left.remainingAmount;
    }

    return left.lenderName.localeCompare(right.lenderName, "es");
  });
  const uniqueLenders = new Set(
    entries.map((entry) => `${entry.lenderId ?? entry.lenderName}|${entry.lenderType}`),
  );
  const sumCurrentMonthByDirection = (
    direction: MonthlyExpensesLoanReportDirection,
  ): number =>
    Number(
      entries
        .filter((entry) => entry.direction === direction)
        .flatMap((entry) => entry.activeLoans)
        .reduce((total, loan) => total + loan.currentMonthAmount, 0)
        .toFixed(2),
    );
  const payableCurrentMonthAmount = sumCurrentMonthByDirection("payable");
  const receivableCurrentMonthAmount = sumCurrentMonthByDirection("receivable");
  const monthlyProjection = buildMonthlyProjection(
    currentMonth,
    projectionAmountByMonth,
  );

  return {
    entries,
    summary: {
      activeLoanCount: entries.reduce(
        (total, entry) => total + entry.activeLoanCount,
        0,
      ),
      payableCurrentMonthAmount,
      receivableCurrentMonthAmount,
      monthlyProjection,
      lenderCount: uniqueLenders.size,
      netRemainingAmount: Number(
        (
          entries.reduce(
            (total, entry) =>
              total +
              (entry.direction === "payable"
                ? entry.remainingAmount
                : -entry.remainingAmount),
            0,
          )
        ).toFixed(2),
      ),
      payableRemainingAmount: Number(
        entries
          .filter((entry) => entry.direction === "payable")
          .reduce((total, entry) => total + entry.remainingAmount, 0)
          .toFixed(2),
      ),
      receivableRemainingAmount: Number(
        entries
          .filter((entry) => entry.direction === "receivable")
          .reduce((total, entry) => total + entry.remainingAmount, 0)
          .toFixed(2),
      ),
      remainingAmount: Number(
        entries
          .reduce((total, entry) => total + entry.remainingAmount, 0)
          .toFixed(2),
      ),
      trackedLoanCount: entries.reduce(
        (total, entry) => total + entry.trackedLoanCount,
        0,
      ),
    },
  };
}
