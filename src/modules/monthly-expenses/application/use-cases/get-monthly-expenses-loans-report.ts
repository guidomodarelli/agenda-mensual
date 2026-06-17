/**
 * Builds the monthly expenses loans report from stored loan snapshots.
 *
 * @module getMonthlyExpensesLoansReport
 */
import type { LenderType } from "@/modules/lenders/domain/value-objects/lenders-catalog-document";

import { calculateLoanEndMonth } from "../../domain/value-objects/monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type {
  MonthlyExpenseCurrency,
  MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import type {
  MonthlyExpensesLoanReportEntry,
  MonthlyExpensesLoanReportDirection,
  MonthlyExpensesLoanReportExpense,
  MonthlyExpensesLoanReportLenderType,
  MonthlyExpensesLoansReportResult,
} from "../results/monthly-expenses-loans-report-result";

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
}

/**
 * Resolves the current calendar month as a `YYYY-MM` identifier.
 *
 * @param date - Reference date; defaults to now.
 * @returns The current month identifier.
 */
function getCurrentMonthIdentifier(date: Date = new Date()): string {
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
  paidInstallments: number;
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
              paidInstallments: item.loan.paidInstallments,
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
 * Increments the active-loan count for a description under a lender entry.
 *
 * @param countsByEntry - Per-entry description→count map being accumulated.
 * @param entryKey - Stable lender entry identifier.
 * @param description - Loan description to count.
 */
function incrementActiveExpenseCount(
  countsByEntry: Map<string, Map<string, number>>,
  entryKey: string,
  description: string,
): void {
  const countsByDescription =
    countsByEntry.get(entryKey) ?? new Map<string, number>();

  countsByDescription.set(
    description,
    (countsByDescription.get(description) ?? 0) + 1,
  );
  countsByEntry.set(entryKey, countsByDescription);
}

/**
 * Builds the sorted, count-aware expense list for a lender entry.
 *
 * @param countsByDescription - Description→active-loan-count map, or undefined.
 * @returns Expenses sorted by description, each with its active-loan count.
 */
function toSortedReportExpenses(
  countsByDescription: Map<string, number> | undefined,
): MonthlyExpensesLoanReportExpense[] {
  if (!countsByDescription) {
    return [];
  }

  return [...countsByDescription.entries()]
    .map(([description, count]) => ({ count, description }))
    .sort((left, right) => left.description.localeCompare(right.description, "es"));
}

export async function getMonthlyExpensesLoansReport({
  currentMonth = getCurrentMonthIdentifier(),
  lenders,
  repository,
}: GetMonthlyExpensesLoansReportDependencies): Promise<MonthlyExpensesLoansReportResult> {
  const documents =
    typeof (repository as Partial<MonthlyExpensesRepository>).listAll === "function"
      ? await repository.listAll()
      : [];
  const fallbackSolidarityRate = getLatestSolidarityRate(documents);
  const latestSnapshotsByLoan = new Map<string, LoanSnapshot>();

  for (const snapshot of createLoanSnapshots(documents)) {
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
  const activeExpenseCountsByEntry = new Map<string, Map<string, number>>();

  for (const snapshot of latestSnapshotsByLoan.values()) {
    const { lenderId, lenderName, lenderType } = resolveLender(snapshot, lenders);
    const entryKey = `${snapshot.direction}|${lenderId ?? lenderName}|${lenderType}`;
    const loanEndMonth = calculateLoanEndMonth({
      installmentCount: snapshot.totalInstallments,
      startMonth: snapshot.startMonth,
    });
    const isLoanSettledByCurrentMonth =
      compareMonthIdentifiers(currentMonth, loanEndMonth) > 0;
    const remainingInstallments = isLoanSettledByCurrentMonth
      ? 0
      : Math.max(snapshot.totalInstallments - snapshot.paidInstallments, 0);
    const remainingAmount = Number(
      convertRemainingAmountToArs({
        currency: snapshot.currency,
        fallbackSolidarityRate,
        nativeRemainingAmount: snapshot.monthlyAmount * remainingInstallments,
        solidarityRate: snapshot.solidarityRate,
      }).toFixed(2),
    );
    const currentEntry = entriesByLender.get(entryKey);

    // A loan with no outstanding balance is already settled, so it must not
    // surface as a current debt: it adds neither its description, timeline, nor
    // active count, and on its own it cannot keep a lender in the report. It is
    // still counted in `trackedLoanCount` so "registered" loans reflect history.
    const hasOutstandingBalance = remainingAmount > 0;

    if (hasOutstandingBalance) {
      incrementActiveExpenseCount(
        activeExpenseCountsByEntry,
        entryKey,
        snapshot.description,
      );
    }

    if (!currentEntry) {
      entriesByLender.set(entryKey, {
        activeLoanCount: hasOutstandingBalance ? 1 : 0,
        direction: snapshot.direction,
        expenseDescriptions: [],
        firstDebtMonth: hasOutstandingBalance ? snapshot.startMonth : null,
        lenderId,
        lenderName,
        lenderType,
        latestRecordedMonth: hasOutstandingBalance ? snapshot.month : null,
        remainingAmount,
        trackedLoanCount: 1,
      });
      continue;
    }

    currentEntry.trackedLoanCount += 1;
    currentEntry.remainingAmount = Number(
      (currentEntry.remainingAmount + remainingAmount).toFixed(2),
    );

    if (!hasOutstandingBalance) {
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
    entry.expenseDescriptions = toSortedReportExpenses(
      activeExpenseCountsByEntry.get(entryKey),
    );
  }

  const entries = [...entriesByLender.values()]
    .filter((entry) => entry.remainingAmount > 0)
    .sort((left, right) => {
    if (right.remainingAmount !== left.remainingAmount) {
      return right.remainingAmount - left.remainingAmount;
    }

    return left.lenderName.localeCompare(right.lenderName, "es");
  });
  const uniqueLenders = new Set(
    entries.map((entry) => `${entry.lenderId ?? entry.lenderName}|${entry.lenderType}`),
  );

  return {
    entries,
    summary: {
      activeLoanCount: entries.reduce(
        (total, entry) => total + entry.activeLoanCount,
        0,
      ),
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
