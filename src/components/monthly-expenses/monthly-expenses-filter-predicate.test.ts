import type {
  AppliedFilter,
} from "@/components/ui/filter-query-grammar";

import {
  buildMonthlyExpensesQueryPredicate,
  matchesFolder,
  matchesTextMatch,
  type MonthlyExpenseFilterContext,
} from "./monthly-expenses-filter-predicate";
import type { MonthlyExpensesEditableRow } from "./monthly-expenses-table.types";

const CONTEXT: MonthlyExpenseFilterContext = {
  exchangeRateSnapshot: null,
  vigenciaSortMode: "startMonth",
};

function createRow(
  overrides: Partial<MonthlyExpensesEditableRow> = {},
): MonthlyExpensesEditableRow {
  return {
    allReceiptsFolderId: "",
    allReceiptsFolderViewUrl: "",
    currency: "ARS",
    description: "Gasto",
    expenseFolderId: "",
    id: "expense-1",
    installmentCount: "",
    isLoan: false,
    lenderId: "",
    lenderName: "",
    loanEndMonth: "",
    loanPaidInstallments: null,
    loanProgress: "",
    loanRemainingInstallments: null,
    loanTotalInstallments: null,
    manualCoveredPayments: "0",
    monthlyFolderId: "",
    monthlyFolderViewUrl: "",
    occurrencesPerMonth: "1",
    occurrencesUnit: "",
    isRecurring: false,
    recurrenceStartMonth: "",
    recurrenceEndMonth: "",
    recurrenceIsActive: false,
    paymentLink: "",
    receiptShareMessage: "",
    receiptSharePhoneDigits: "",
    requiresReceiptShare: false,
    receipts: [],
    sortOrder: null,
    startMonth: "",
    subtotal: "1000",
    subtotalUnit: "occurrence",
    total: "1000",
    ...overrides,
  };
}

describe("matchesTextMatch", () => {
  it("matches presence, contains, prefix, suffix and equals (accent-insensitive)", () => {
    expect(matchesTextMatch({ kind: "textMatch", op: "has" }, "x")).toBe(true);
    expect(matchesTextMatch({ kind: "textMatch", op: "has" }, "")).toBe(false);
    expect(matchesTextMatch({ kind: "textMatch", op: "notHas" }, "")).toBe(true);
    expect(
      matchesTextMatch({ kind: "textMatch", op: "contains", text: "ejemplo" }, "https://Ejemplo.com"),
    ).toBe(true);
    expect(
      matchesTextMatch({ kind: "textMatch", op: "startsWith", text: "https" }, "https://x"),
    ).toBe(true);
    expect(
      matchesTextMatch({ kind: "textMatch", op: "endsWith", text: ".pdf" }, "https://x/file.pdf"),
    ).toBe(true);
    expect(
      matchesTextMatch({ kind: "textMatch", op: "equals", text: "juan" }, "Juán"),
    ).toBe(true);
    expect(
      matchesTextMatch({ kind: "textMatch", op: "contains", text: "abc" }, ""),
    ).toBe(false);
  });
});

describe("matchesFolder", () => {
  it("matches include, exclude target and unassigned", () => {
    expect(matchesFolder({ kind: "folder", folderId: "f1" }, "f1")).toBe(true);
    expect(matchesFolder({ kind: "folder", folderId: "f1" }, "f2")).toBe(false);
    expect(matchesFolder({ kind: "folder", folderId: "__unassigned__" }, "")).toBe(true);
    expect(matchesFolder({ kind: "folder", folderId: "__unassigned__" }, "f1")).toBe(false);
  });
});

describe("buildMonthlyExpensesQueryPredicate", () => {
  function predicate(appliedFilters: AppliedFilter[]) {
    return buildMonthlyExpensesQueryPredicate(appliedFilters, CONTEXT);
  }

  it("filters by a number range and treats null installment fields as no match", () => {
    const matches = predicate([
      { key: "cuotas-restantes", negated: false, value: { kind: "numberRange", max: 3 } },
    ]);

    expect(matches(createRow({ loanRemainingInstallments: 2 }))).toBe(true);
    expect(matches(createRow({ loanRemainingInstallments: 5 }))).toBe(false);
    expect(matches(createRow({ loanRemainingInstallments: null }))).toBe(false);
  });

  it("counts sent receipts for the enviados qualifier", () => {
    const matches = predicate([
      { key: "enviados", negated: false, value: { kind: "numberRange", min: 2 } },
    ]);
    const sentRow = createRow({
      paymentRecords: [
        { id: "a", coveredPayments: 1, registeredAt: null, sendStatus: "sent" },
        { id: "b", coveredPayments: 1, registeredAt: null, sendStatus: "sent" },
      ],
    });
    const pendingRow = createRow({
      paymentRecords: [
        { id: "a", coveredPayments: 1, registeredAt: null, sendStatus: "pending" },
      ],
    });

    expect(matches(sentRow)).toBe(true);
    expect(matches(pendingRow)).toBe(false);
  });

  it("matches link text and inverts on negation", () => {
    const startsWith = predicate([
      { key: "link", negated: false, value: { kind: "textMatch", op: "startsWith", text: "https" } },
    ]);
    expect(startsWith(createRow({ paymentLink: "https://x" }))).toBe(true);
    expect(startsWith(createRow({ paymentLink: "http://x" }))).toBe(false);

    const notContains = predicate([
      { key: "link", negated: true, value: { kind: "textMatch", op: "contains", text: "mp" } },
    ]);
    expect(notContains(createRow({ paymentLink: "https://mp.com" }))).toBe(false);
    expect(notContains(createRow({ paymentLink: "https://x.com" }))).toBe(true);
  });

  it("ORs positive folder filters and excludes negated ones", () => {
    const includeAorB = predicate([
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "a" } },
      { key: "carpeta", negated: false, value: { kind: "folder", folderId: "b" } },
    ]);
    expect(includeAorB(createRow({ expenseFolderId: "a" }))).toBe(true);
    expect(includeAorB(createRow({ expenseFolderId: "b" }))).toBe(true);
    expect(includeAorB(createRow({ expenseFolderId: "c" }))).toBe(false);

    const excludeA = predicate([
      { key: "carpeta", negated: true, value: { kind: "folder", folderId: "a" } },
    ]);
    expect(excludeA(createRow({ expenseFolderId: "a" }))).toBe(false);
    expect(excludeA(createRow({ expenseFolderId: "b" }))).toBe(true);
  });

  it("ANDs multiple filters of different kinds", () => {
    const matches = predicate([
      { key: "subtotal", negated: false, value: { kind: "numberRange", min: 500 } },
      { key: "prestamista", negated: false, value: { kind: "textMatch", op: "equals", text: "juan" } },
    ]);

    expect(matches(createRow({ subtotal: "1000", lenderName: "Juan" }))).toBe(true);
    expect(matches(createRow({ subtotal: "100", lenderName: "Juan" }))).toBe(false);
    expect(matches(createRow({ subtotal: "1000", lenderName: "Pedro" }))).toBe(false);
  });
});
