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

  it("evaluates field presence for tiene:/no: meta filters", () => {
    const hasLink = predicate([
      { key: "link", negated: false, value: { kind: "presence", value: "hasValue" } },
    ]);
    expect(hasLink(createRow({ paymentLink: "https://x" }))).toBe(true);
    expect(hasLink(createRow({ paymentLink: "" }))).toBe(false);

    const noSent = predicate([
      { key: "enviados", negated: false, value: { kind: "presence", value: "noValue" } },
    ]);
    const sentRow = createRow({
      paymentRecords: [
        { id: "a", coveredPayments: 1, registeredAt: null, sendStatus: "sent" },
      ],
    });
    expect(noSent(sentRow)).toBe(false);
    expect(noSent(createRow({ paymentRecords: [] }))).toBe(true);

    // La presencia de carpeta se evalúa por campo (no por el bucket de folders).
    const hasFolder = predicate([
      { key: "carpeta", negated: false, value: { kind: "presence", value: "hasValue" } },
    ]);
    expect(hasFolder(createRow({ expenseFolderId: "f1" }))).toBe(true);
    expect(hasFolder(createRow({ expenseFolderId: "" }))).toBe(false);
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

  it("matches an ends-with link ignoring the normalized trailing slash", () => {
    // Los links se guardan con barra final (`.../`); `*.com.ar` debe matchear igual.
    const endsWith = predicate([
      {
        key: "link",
        negated: false,
        value: { kind: "textMatch", op: "endsWith", text: ".com.ar" },
      },
    ]);

    expect(
      endsWith(createRow({ paymentLink: "https://oficinavirtual.coopelectric.com.ar/" })),
    ).toBe(true);
    expect(
      endsWith(createRow({ paymentLink: "https://example.com/path" })),
    ).toBe(false);
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

  it("compares subtotal in ARS-displayed currency for USD rows", () => {
    const context: MonthlyExpenseFilterContext = {
      exchangeRateSnapshot: {
        blueRate: 1500,
        month: "2026-06",
        officialRate: 1000,
        solidarityRate: 1300,
      },
    };
    const matches = buildMonthlyExpensesQueryPredicate(
      [{ key: "subtotal", negated: false, value: { kind: "numberRange", min: 10000 } }],
      context,
    );
    // 10 USD * 1300 = 13000 ARS, lo que muestra la celda, así que matchea el
    // umbral en ARS aunque el valor crudo en USD (10) no lo haría.
    const usdRow = createRow({ currency: "USD", subtotal: "10" });

    expect(matches(usdRow)).toBe(true);
  });

  it("matches prestamista by lender id (enum)", () => {
    const matches = predicate([
      { key: "prestamista", negated: false, value: { kind: "enum", value: "lender-1" } },
    ]);

    expect(matches(createRow({ lenderId: "lender-1" }))).toBe(true);
    expect(matches(createRow({ lenderId: "lender-2" }))).toBe(false);
    expect(matches(createRow({ lenderId: "" }))).toBe(false);
  });

  it("matches legacy prestamista rows by displayed name when lenderId is empty", () => {
    const context: MonthlyExpenseFilterContext = {
      exchangeRateSnapshot: null,
      lenderNamesById: new Map([["lender-1", "Juan Pérez"]]),
    };
    const matches = buildMonthlyExpensesQueryPredicate(
      [{ key: "prestamista", negated: false, value: { kind: "enum", value: "lender-1" } }],
      context,
    );

    // Fila legacy: muestra el nombre pero no guarda lenderId (acento-insensible).
    expect(matches(createRow({ lenderId: "", lenderName: "Juan Perez" }))).toBe(true);
    // Nombre distinto: no matchea.
    expect(matches(createRow({ lenderId: "", lenderName: "Otro" }))).toBe(false);
    // Sin nombre ni id: no matchea.
    expect(matches(createRow({ lenderId: "", lenderName: "" }))).toBe(false);
  });

  it("ANDs multiple filters of different kinds", () => {
    const matches = predicate([
      { key: "subtotal", negated: false, value: { kind: "numberRange", min: 500 } },
      { key: "prestamista", negated: false, value: { kind: "enum", value: "lender-1" } },
    ]);

    expect(matches(createRow({ subtotal: "1000", lenderId: "lender-1" }))).toBe(true);
    expect(matches(createRow({ subtotal: "100", lenderId: "lender-1" }))).toBe(false);
    expect(matches(createRow({ subtotal: "1000", lenderId: "lender-2" }))).toBe(false);
  });
});
