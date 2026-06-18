import {
  createMonthlyExpensesDocument,
  type MonthlyExpenseItemInput,
  type MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import {
  getOutOfRangeStoredLoanIds,
  projectMonthlyExpenseLoans,
} from "./project-monthly-expense-loans";

function buildDocument(
  month: string,
  items: MonthlyExpenseItemInput[],
): MonthlyExpensesDocument {
  return createMonthlyExpensesDocument({ items, month }, "Building test document");
}

function buildLoanItem(
  overrides: Partial<MonthlyExpenseItemInput> = {},
): MonthlyExpenseItemInput {
  return {
    currency: "ARS",
    description: "Notebook",
    id: "loan-1",
    occurrencesPerMonth: 1,
    subtotal: 1000,
    ...overrides,
    loan: {
      installmentCount: 6,
      startMonth: "2026-03",
      ...overrides.loan,
    },
  };
}

const FOLDERS_FIXTURE = {
  allReceiptsFolderId: "all-receipts-folder",
  allReceiptsFolderViewUrl:
    "https://drive.google.com/drive/folders/all-receipts-folder",
  monthlyFolderId: "monthly-folder-march",
  monthlyFolderViewUrl:
    "https://drive.google.com/drive/folders/monthly-folder-march",
};

describe("projectMonthlyExpenseLoans", () => {
  it("preserves the shared all-receipts folder and clears the monthly folder for new projections", () => {
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({
          folders: FOLDERS_FIXTURE,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-05",
      baseItems: [],
    });

    expect(projected?.folders).toEqual({
      allReceiptsFolderId: "all-receipts-folder",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/all-receipts-folder",
      monthlyFolderId: "",
      monthlyFolderViewUrl: "",
    });
  });

  it("omits folders from refreshes so the stored copy keeps its own folder state", () => {
    const targetMonth = "2026-03";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({
        folders: FOLDERS_FIXTURE,
        loan: { installmentCount: 6, startMonth: "2026-03" },
      }),
    ]);
    const documents = [
      targetDocument,
      buildDocument("2026-05", [
        buildLoanItem({
          folders: FOLDERS_FIXTURE,
          subtotal: 1500,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
    ];

    const [refreshed] = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    expect(refreshed?.subtotal).toBe(1500);
    expect(refreshed?.folders).toBeUndefined();
  });


  it("does not project a loan the user excluded from the target month", () => {
    const documents = [
      buildDocument("2026-05", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
      ]),
    ];

    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth: "2026-04",
        baseItems: [],
        excludedLoanIds: ["loan-1"],
      }),
    ).toHaveLength(0);
    // Without the exclusion the same loan would be projected.
    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth: "2026-04",
        baseItems: [],
      }),
    ).toHaveLength(1);
  });

  it("projects a loan that starts next month into every month within its range", () => {
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-04" } }),
      ]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    // 2026-04..2026-09 is the [startMonth, endMonth] range.
    expect(projectInto("2026-04")).toHaveLength(1);
    expect(projectInto("2026-09")).toHaveLength(1);
    // Before the start month and after the end month it is not projected.
    expect(projectInto("2026-03")).toHaveLength(0);
    expect(projectInto("2026-10")).toHaveLength(0);
  });

  it("projects a loan already in progress into previous, current and following months", () => {
    const documents = [
      buildDocument("2026-05", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
      ]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    // Range 2026-03..2026-08, regardless of which month physically holds it.
    expect(projectInto("2026-03")).toHaveLength(1);
    expect(projectInto("2026-04")).toHaveLength(1);
    expect(projectInto("2026-06")).toHaveLength(1);
    expect(projectInto("2026-08")).toHaveLength(1);
    expect(projectInto("2026-02")).toHaveLength(0);
    expect(projectInto("2026-09")).toHaveLength(0);
  });

  it("does not project a loan already present in the target month", () => {
    const targetMonth = "2026-04";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
    ]);
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
      ]),
      targetDocument,
    ];

    const projected = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    expect(projected).toHaveLength(0);
  });

  it("refreshes a stored copy whose canonical snapshot lives in a newer month", () => {
    const targetMonth = "2026-03";
    const staleStoredItem = buildLoanItem({
      subtotal: 1000,
      loan: { installmentCount: 6, startMonth: "2026-03" },
    });
    const targetDocument = buildDocument(targetMonth, [staleStoredItem]);
    const documents = [
      targetDocument,
      buildDocument("2026-05", [
        buildLoanItem({
          subtotal: 1500,
          loan: { installmentCount: 9, startMonth: "2026-03" },
        }),
      ]),
    ];

    const projected = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    expect(projected).toHaveLength(1);
    expect(projected[0]?.id).toBe("loan-1");
    expect(projected[0]?.subtotal).toBe(1500);
    expect(projected[0]?.loan?.installmentCount).toBe(9);
  });

  it("does not refresh a stored copy that already is the latest snapshot", () => {
    const targetMonth = "2026-05";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({
        subtotal: 1500,
        loan: { installmentCount: 6, startMonth: "2026-03" },
      }),
    ]);
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({
          subtotal: 1000,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
      targetDocument,
    ];

    const projected = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    expect(projected).toHaveLength(0);
  });

  it("uses the most recent snapshot as the canonical loan definition", () => {
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({
          subtotal: 1000,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
      buildDocument("2026-05", [
        buildLoanItem({
          subtotal: 1500,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-04",
      baseItems: [],
    });

    expect(projected?.subtotal).toBe(1500);
  });

  it("projects loans without any per-month payment state", () => {
    const documents = [
      buildDocument("2026-05", [
        buildLoanItem({
          loan: { installmentCount: 6, startMonth: "2026-03" },
          manualCoveredPayments: 1,
          paymentRecords: [
            { coveredPayments: 1, id: "paid-record" },
          ],
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-06",
      baseItems: [],
    });

    expect(projected?.id).toBe("loan-1");
    expect(projected?.loan?.startMonth).toBe("2026-03");
    expect(projected?.paymentRecords).toBeUndefined();
    expect(projected?.receipts).toBeUndefined();
    expect(projected?.manualCoveredPayments).toBeUndefined();
    expect(projected?.isPaid).toBeUndefined();
  });

  it("ignores non-loan expenses", () => {
    const documents = [
      buildDocument("2026-05", [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          occurrencesPerMonth: 1,
          subtotal: 100,
        },
      ]),
    ];

    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth: "2026-06",
        baseItems: [],
      }),
    ).toHaveLength(0);
  });

  it("emits explicit cleared definition fields so a refresh overlay clears stale values", () => {
    const targetMonth = "2026-03";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({
        loan: { installmentCount: 6, startMonth: "2026-03" },
        paymentLink: "https://pay.example.com/old",
        requiresReceiptShare: true,
        receiptSharePhoneDigits: "5491122334455",
      }),
    ]);
    const documents = [
      targetDocument,
      buildDocument("2026-05", [
        // Newer canonical snapshot no longer carries the optional fields.
        buildLoanItem({
          subtotal: 1500,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
    ];

    const [refreshed] = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    expect(refreshed?.paymentLink).toBeNull();
    expect(refreshed?.requiresReceiptShare).toBe(false);
    expect(refreshed?.receiptSharePhoneDigits).toBeNull();
  });

  it("does not refresh a stored copy whose newer canonical range no longer covers the month", () => {
    const targetMonth = "2026-08";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({ loan: { installmentCount: 12, startMonth: "2026-03" } }),
    ]);
    const documents = [
      targetDocument,
      buildDocument("2026-09", [
        // Shortened to 3 installments → range 2026-03..2026-05, excludes 2026-08.
        buildLoanItem({ loan: { installmentCount: 3, startMonth: "2026-03" } }),
      ]),
    ];

    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toHaveLength(0);
  });
});

function buildRecurringItem(
  overrides: Partial<MonthlyExpenseItemInput> = {},
): MonthlyExpenseItemInput {
  return {
    currency: "ARS",
    description: "Alquiler",
    id: "rent-1",
    occurrencesPerMonth: 1,
    subtotal: 350000,
    ...overrides,
    recurrence: {
      startMonth: "2026-03",
      ...overrides.recurrence,
    },
  };
}

describe("projectMonthlyExpenseLoans with recurring expenses", () => {
  it("projects an open-ended recurring expense into every later month", () => {
    const documents = [buildDocument("2026-03", [buildRecurringItem()])];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    expect(projectInto("2026-03")).toHaveLength(1);
    expect(projectInto("2026-12")).toHaveLength(1);
    expect(projectInto("2030-01")).toHaveLength(1);
    // Before the start month it is not projected.
    expect(projectInto("2026-02")).toHaveLength(0);
  });

  it("stops projecting a cancelled recurring expense after its end month", () => {
    const documents = [
      buildDocument("2026-03", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-06" },
        }),
      ]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    expect(projectInto("2026-06")).toHaveLength(1);
    expect(projectInto("2026-07")).toHaveLength(0);
  });

  it("propagates a cancellation from a newer month to older snapshots", () => {
    const documents = [
      buildDocument("2026-03", [buildRecurringItem()]),
      // In July the user cancelled it effective June.
      buildDocument("2026-07", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-06" },
        }),
      ]),
    ];

    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth: "2026-08",
        baseItems: [],
      }),
    ).toHaveLength(0);
  });

  it("drops a stored recurring copy a newer cancellation pushed out of range", () => {
    const targetMonth = "2026-08";
    const targetDocument = buildDocument(targetMonth, [buildRecurringItem()]);
    const documents = [
      targetDocument,
      buildDocument("2026-09", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-06" },
        }),
      ]),
    ];

    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual(["rent-1"]);
  });

  it("projects recurring expenses without any per-month payment state", () => {
    const documents = [
      buildDocument("2026-03", [
        buildRecurringItem({
          manualCoveredPayments: 1,
          paymentRecords: [{ coveredPayments: 1, id: "paid-record" }],
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-04",
      baseItems: [],
    });

    expect(projected?.recurrence?.startMonth).toBe("2026-03");
    expect(projected?.paymentRecords).toBeUndefined();
    expect(projected?.manualCoveredPayments).toBeUndefined();
  });
});

describe("getOutOfRangeStoredLoanIds", () => {
  it("reports a stored loan a newer canonical snapshot pushed out of range", () => {
    const targetMonth = "2026-08";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({ loan: { installmentCount: 12, startMonth: "2026-03" } }),
    ]);
    const documents = [
      targetDocument,
      buildDocument("2026-09", [
        buildLoanItem({ loan: { installmentCount: 3, startMonth: "2026-03" } }),
      ]),
    ];

    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual(["loan-1"]);
  });

  it("does not report a stored loan still within its canonical range", () => {
    const targetMonth = "2026-04";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
    ]);
    const documents = [
      targetDocument,
      buildDocument("2026-05", [
        buildLoanItem({
          subtotal: 1500,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
    ];

    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual([]);
  });

  it("does not report a stored loan that is its own latest snapshot", () => {
    const targetMonth = "2026-08";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({ loan: { installmentCount: 3, startMonth: "2026-03" } }),
    ]);

    expect(
      getOutOfRangeStoredLoanIds({
        documents: [targetDocument],
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual([]);
  });
});
