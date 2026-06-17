/**
 * Builds the monthly expenses loans report from stored loan snapshots.
 *
 * @module getMonthlyExpensesLoansReport
 */
import type { LenderType } from "@/modules/lenders/domain/value-objects/lenders-catalog-document";

import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpensesDocument } from "../../domain/value-objects/monthly-expenses-document";
import type {
  MonthlyExpensesLoanReportEntry,
  MonthlyExpensesLoanReportDirection,
  MonthlyExpensesLoanReportLenderType,
  MonthlyExpensesLoansReportResult,
} from "../results/monthly-expenses-loans-report-result";

interface ReportLenderInput {
  id: string;
  name: string;
  type: LenderType;
}

interface GetMonthlyExpensesLoansReportDependencies {
  lenders: ReportLenderInput[];
  repository: MonthlyExpensesRepository;
}

interface LoanSnapshot {
  description: string;
  direction: MonthlyExpensesLoanReportDirection;
  expenseId: string;
  lenderId: string | null;
  lenderName: string | null;
  monthlyAmount: number;
  month: string;
  paidInstallments: number;
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
              description: item.description,
              direction: item.loan.direction ?? "payable",
              expenseId: item.id,
              lenderId: item.loan.lenderId ?? null,
              lenderName: item.loan.lenderName ?? null,
              month: document.month,
              monthlyAmount: item.total,
              paidInstallments: item.loan.paidInstallments,
              startMonth: item.loan.startMonth,
              totalInstallments: item.loan.installmentCount,
            },
          ]
        : [],
    ),
  );
}

export async function getMonthlyExpensesLoansReport({
  lenders,
  repository,
}: GetMonthlyExpensesLoansReportDependencies): Promise<MonthlyExpensesLoansReportResult> {
  const documents =
    typeof (repository as Partial<MonthlyExpensesRepository>).listAll === "function"
      ? await repository.listAll()
      : [];
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

  for (const snapshot of latestSnapshotsByLoan.values()) {
    const { lenderId, lenderName, lenderType } = resolveLender(snapshot, lenders);
    const entryKey = `${snapshot.direction}|${lenderId ?? lenderName}|${lenderType}`;
    const remainingInstallments = Math.max(
      snapshot.totalInstallments - snapshot.paidInstallments,
      0,
    );
    const remainingAmount = Number(
      (snapshot.monthlyAmount * remainingInstallments).toFixed(2),
    );
    const currentEntry = entriesByLender.get(entryKey);

    // A loan with no outstanding balance is already settled, so it must not
    // surface as a current debt: it adds neither its description, timeline, nor
    // active count, and on its own it cannot keep a lender in the report. It is
    // still counted in `trackedLoanCount` so "registered" loans reflect history.
    const hasOutstandingBalance = remainingAmount > 0;

    if (!currentEntry) {
      entriesByLender.set(entryKey, {
        activeLoanCount: hasOutstandingBalance ? 1 : 0,
        direction: snapshot.direction,
        expenseDescriptions: hasOutstandingBalance ? [snapshot.description] : [],
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
    currentEntry.expenseDescriptions = Array.from(
      new Set([...currentEntry.expenseDescriptions, snapshot.description]),
    ).sort((left, right) => left.localeCompare(right, "es"));
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
