import { describe, it, expect } from "vitest";
import { type AppliedFilter } from "beez-ui";


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
    usdRate: {
      appliesIibb: true,
      appliesIva: false,
      base: "official",
      customRate: null,
    },
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

  it("filters by payment status with the estado qualifier", () => {
    const matchesCompleted = predicate([
      {
        key: "estado",
        negated: false,
        value: { kind: "enum", value: "completed" },
      },
    ]);
    const completedRow = createRow({
      manualCoveredPayments: "1",
      occurrencesPerMonth: "1",
    });
    const pendingRow = createRow({
      manualCoveredPayments: "0",
      occurrencesPerMonth: "1",
    });

    expect(matchesCompleted(completedRow)).toBe(true);
    expect(matchesCompleted(pendingRow)).toBe(false);

    const matchesPending = predicate([
      {
        key: "estado",
        negated: false,
        value: { kind: "enum", value: "pending" },
      },
    ]);

    expect(matchesPending(pendingRow)).toBe(true);
    expect(matchesPending(completedRow)).toBe(false);
  });

  it("filters by row currency with the moneda qualifier", () => {
    const matchesUsd = predicate([
      { key: "moneda", negated: false, value: { kind: "enum", value: "USD" } },
    ]);

    expect(matchesUsd(createRow({ currency: "USD" }))).toBe(true);
    expect(matchesUsd(createRow({ currency: "ARS" }))).toBe(false);

    const matchesArs = predicate([
      { key: "moneda", negated: false, value: { kind: "enum", value: "ARS" } },
    ]);

    expect(matchesArs(createRow({ currency: "ARS" }))).toBe(true);
    expect(matchesArs(createRow({ currency: "USD" }))).toBe(false);
  });

  it("matches the receipt share phone digits and their presence", () => {
    const matchesSuffix = predicate([
      {
        key: "telefono",
        negated: false,
        value: { kind: "textMatch", op: "endsWith", text: "1234" },
      },
    ]);

    expect(
      matchesSuffix(createRow({ receiptSharePhoneDigits: "5491111231234" })),
    ).toBe(true);
    expect(
      matchesSuffix(createRow({ receiptSharePhoneDigits: "5491111235678" })),
    ).toBe(false);

    const hasPhone = predicate([
      {
        key: "telefono",
        negated: false,
        value: { kind: "presence", value: "hasValue" },
      },
    ]);

    expect(hasPhone(createRow({ receiptSharePhoneDigits: "549111" }))).toBe(
      true,
    );
    expect(hasPhone(createRow({ receiptSharePhoneDigits: "" }))).toBe(false);
  });

  it("matches the receipt share message and its presence", () => {
    const matchesText = predicate([
      {
        key: "mensaje",
        negated: false,
        value: { kind: "textMatch", op: "contains", text: "alquiler" },
      },
    ]);

    expect(
      matchesText(createRow({ receiptShareMessage: "Pago Alquiler abril" })),
    ).toBe(true);
    expect(
      matchesText(createRow({ receiptShareMessage: "Expensas" })),
    ).toBe(false);

    const noMessage = predicate([
      {
        key: "mensaje",
        negated: false,
        value: { kind: "presence", value: "noValue" },
      },
    ]);

    expect(noMessage(createRow({ receiptShareMessage: "" }))).toBe(true);
    expect(noMessage(createRow({ receiptShareMessage: "Hola" }))).toBe(false);
  });

  it("counts attached receipts for the comprobantes qualifier and its presence", () => {
    const receipt = {
      allReceiptsFolderId: "",
      allReceiptsFolderViewUrl: "",
      coveredPayments: 1,
      fileId: "file-1",
      fileName: "comprobante.pdf",
      fileViewUrl: "",
      monthlyFolderId: "",
      monthlyFolderViewUrl: "",
    };
    const matchesMin = predicate([
      {
        key: "comprobantes",
        negated: false,
        value: { kind: "numberRange", min: 2 },
      },
    ]);

    expect(
      matchesMin(
        createRow({
          receipts: [receipt, { ...receipt, fileId: "file-2" }],
        }),
      ),
    ).toBe(true);
    expect(matchesMin(createRow({ receipts: [receipt] }))).toBe(false);

    const noReceipts = predicate([
      {
        key: "comprobantes",
        negated: false,
        value: { kind: "presence", value: "noValue" },
      },
    ]);

    expect(noReceipts(createRow({ receipts: [] }))).toBe(true);
    expect(noReceipts(createRow({ receipts: [receipt] }))).toBe(false);
  });

  it("evaluates recurrence presence for tiene:/no: meta filters", () => {
    const hasRecurrence = predicate([
      {
        key: "recurrencia",
        negated: false,
        value: { kind: "presence", value: "hasValue" },
      },
    ]);

    expect(hasRecurrence(createRow({ isRecurring: true }))).toBe(true);
    expect(
      hasRecurrence(
        createRow({ isRecurring: true, recurrenceEndMonth: "2026-04" }),
      ),
    ).toBe(true);
    expect(hasRecurrence(createRow({ isRecurring: false }))).toBe(false);

    const noRecurrence = predicate([
      {
        key: "recurrencia",
        negated: false,
        value: { kind: "presence", value: "noValue" },
      },
    ]);

    expect(noRecurrence(createRow({ isRecurring: true }))).toBe(false);
    expect(noRecurrence(createRow({ isRecurring: false }))).toBe(true);
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

  it("bases USD presence on the row currency, not on the converted value", () => {
    const arsRow = createRow({ currency: "ARS", total: "1000" });
    const usdRow = createRow({ currency: "USD", total: "50" });

    // tiene:usd = gastos cuya moneda de base es USD; la conversión no cuenta
    // (con snapshot, cualquier fila ARS convertiría y el filtro no serviría).
    const context: MonthlyExpenseFilterContext = {
      exchangeRateSnapshot: {
        blueRate: 1500,
        month: "2026-06",
        officialRate: 1000,
        solidarityRate: 1300,
      },
    };
    const hasUsd = buildMonthlyExpensesQueryPredicate(
      [{ key: "usd", negated: false, value: { kind: "presence", value: "hasValue" } }],
      context,
    );
    const lacksUsd = buildMonthlyExpensesQueryPredicate(
      [{ key: "usd", negated: false, value: { kind: "presence", value: "noValue" } }],
      context,
    );

    expect(hasUsd(usdRow)).toBe(true);
    expect(hasUsd(arsRow)).toBe(false);
    expect(lacksUsd(arsRow)).toBe(true);
    expect(lacksUsd(usdRow)).toBe(false);
  });

  it("matches prestamista by lender id (enum)", () => {
    const matches = predicate([
      { key: "contraparte", negated: false, value: { kind: "enum", value: "lender-1" } },
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
      [{ key: "contraparte", negated: false, value: { kind: "enum", value: "lender-1" } }],
      context,
    );

    // Fila legacy: muestra el nombre pero no guarda lenderId (acento-insensible).
    expect(matches(createRow({ lenderId: "", lenderName: "Juan Perez" }))).toBe(true);
    // Nombre distinto: no matchea.
    expect(matches(createRow({ lenderId: "", lenderName: "Otro" }))).toBe(false);
    // Sin nombre ni id: no matchea.
    expect(matches(createRow({ lenderId: "", lenderName: "" }))).toBe(false);
  });

  it("filters prestamista by text when lender catalog is empty (textMatch)", () => {
    // Cuando el catálogo de prestamistas está vacío, el qualifier se emite como
    // textMatch. El matcher debe comparar contra row.lenderName en vez de pasar
    // todas las filas como no-op.
    const matches = predicate([
      {
        key: "contraparte",
        negated: false,
        value: { kind: "textMatch", op: "contains", text: "juan" },
      },
    ]);

    expect(matches(createRow({ lenderName: "Juan Pérez" }))).toBe(true);
    expect(matches(createRow({ lenderName: "juan perez" }))).toBe(true);
    expect(matches(createRow({ lenderName: "María López" }))).toBe(false);
    expect(matches(createRow({ lenderName: "" }))).toBe(false);
  });

  it("textMatch prestamista with has/notHas ops", () => {
    const matchesHas = predicate([
      {
        key: "contraparte",
        negated: false,
        value: { kind: "textMatch", op: "has" },
      },
    ]);
    const matchesNotHas = predicate([
      {
        key: "contraparte",
        negated: false,
        value: { kind: "textMatch", op: "notHas" },
      },
    ]);

    expect(matchesHas(createRow({ lenderName: "Juan" }))).toBe(true);
    expect(matchesHas(createRow({ lenderName: "" }))).toBe(false);
    expect(matchesNotHas(createRow({ lenderName: "" }))).toBe(true);
    expect(matchesNotHas(createRow({ lenderName: "Juan" }))).toBe(false);
  });

  it("ANDs multiple filters of different kinds", () => {
    const matches = predicate([
      { key: "subtotal", negated: false, value: { kind: "numberRange", min: 500 } },
      { key: "contraparte", negated: false, value: { kind: "enum", value: "lender-1" } },
    ]);

    expect(matches(createRow({ subtotal: "1000", lenderId: "lender-1" }))).toBe(true);
    expect(matches(createRow({ subtotal: "100", lenderId: "lender-1" }))).toBe(false);
    expect(matches(createRow({ subtotal: "1000", lenderId: "lender-2" }))).toBe(false);
  });
});
