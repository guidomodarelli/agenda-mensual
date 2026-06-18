/**
 * Per-user cache for the computed monthly expenses loans report.
 *
 * Building the report scans every stored monthly document, which is expensive
 * over a long history. The result only changes when the user writes a monthly
 * document or a lender, or when the calendar month rolls over (remaining
 * installments are measured against the current month). This module memoizes the
 * computation in the Next data cache keyed by user and current month, and exposes
 * a tag-based invalidation hook for the mutation routes.
 *
 * @module monthlyExpensesLoansReportCache
 */
import { revalidateTag, unstable_cache } from "next/cache";

import type { MonthlyExpensesLoansReportResult } from "../../application/results/monthly-expenses-loans-report-result";

/** Cache namespace shared by every user's loans report entry. */
const LOANS_REPORT_CACHE_KEY = "monthly-expenses-loans-report";
/**
 * Safety-net revalidation window. Tag invalidation handles writes and the cache
 * key handles month rollover, so this only bounds staleness from any write path
 * that forgets to invalidate.
 */
const LOANS_REPORT_CACHE_REVALIDATE_SECONDS = 60 * 60;

/**
 * Builds the cache tag invalidated whenever a user's loans or lenders change.
 *
 * @param userSubject - Authenticated user subject the report belongs to.
 * @returns The per-user cache tag.
 */
export function getMonthlyExpensesLoansReportCacheTag(
  userSubject: string,
): string {
  return `${LOANS_REPORT_CACHE_KEY}:${userSubject}`;
}

/**
 * Returns the user's loans report from cache, computing it on a miss.
 *
 * The heavy `computeReport` callback only runs when the cache is cold; otherwise
 * the stored result is served. The cache key includes the user subject (so users
 * never share a report) and the current month (so the report recomputes when the
 * month changes).
 *
 * @param dependencies.computeReport - Computes the report on a cache miss.
 * @param dependencies.currentMonth - Current month identifier (`YYYY-MM`).
 * @param dependencies.userSubject - Authenticated user subject.
 * @returns The cached or freshly computed loans report.
 */
export function getCachedMonthlyExpensesLoansReport({
  computeReport,
  currentMonth,
  userSubject,
}: {
  computeReport: () => Promise<MonthlyExpensesLoansReportResult>;
  currentMonth: string;
  userSubject: string;
}): Promise<MonthlyExpensesLoansReportResult> {
  return unstable_cache(
    computeReport,
    [LOANS_REPORT_CACHE_KEY, userSubject, currentMonth],
    {
      revalidate: LOANS_REPORT_CACHE_REVALIDATE_SECONDS,
      tags: [getMonthlyExpensesLoansReportCacheTag(userSubject)],
    },
  )();
}

/**
 * Invalidates a user's cached loans report after a write that can change it
 * (saving a monthly document or editing the lenders catalog).
 *
 * @param userSubject - Authenticated user subject whose report changed.
 */
export function revalidateMonthlyExpensesLoansReportCache(
  userSubject: string,
): void {
  // `{ expire: 0 }` purges the tag immediately (Next 16 requires a cache-life
  // profile as the second argument).
  revalidateTag(getMonthlyExpensesLoansReportCacheTag(userSubject), {
    expire: 0,
  });
}
