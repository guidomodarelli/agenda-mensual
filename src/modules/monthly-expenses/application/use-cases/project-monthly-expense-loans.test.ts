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

  it("keeps each month's own amount when refreshing a recurring expense from a newer snapshot", () => {
    const targetMonth = "2026-02";
    // February stores the recurrence at its own price (350000)...
    const storedFebruary = buildRecurringItem({
      recurrence: { startMonth: "2026-01" },
      subtotal: 350000,
    });
    const targetDocument = buildDocument(targetMonth, [storedFebruary]);
    // ...while a newer March snapshot raised the price and renamed it.
    const documents = [
      targetDocument,
      buildDocument("2026-03", [
        buildRecurringItem({
          description: "Alquiler actualizado",
          recurrence: { startMonth: "2026-01" },
          subtotal: 400000,
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    // Recurring expenses can change price month to month: February keeps its own
    // amount, while the shared definition (description) still propagates.
    expect(projected?.id).toBe("rent-1");
    expect(projected?.subtotal).toBe(350000);
    expect(projected?.description).toBe("Alquiler actualizado");
  });

  it("uses the latest amount when projecting a recurring expense into a new month", () => {
    const documents = [
      buildDocument("2026-01", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-01" },
          subtotal: 350000,
        }),
      ]),
      buildDocument("2026-03", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-01" },
          subtotal: 400000,
        }),
      ]),
    ];

    // A month with no stored copy inherits the most recent amount.
    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-05",
      baseItems: [],
    });

    expect(projected?.subtotal).toBe(400000);
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

  it("promotes a stale plain row to a recurrence converted in an older month", () => {
    const documents = [
      // The expense was converted to recurring in March (canonical, older month).
      buildDocument("2026-03", [
        buildRecurringItem({ recurrence: { startMonth: "2026-03" } }),
      ]),
      // May still stores a PLAIN row with the same id, left by a prior replication.
      buildDocument("2026-05", [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "rent-1",
          occurrencesPerMonth: 1,
          subtotal: 350000,
        },
      ]),
    ];
    const mayDocument = documents[1];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-05",
      baseItems: mayDocument.items,
    });

    // The plain May row is refreshed (promoted) to the recurrence definition.
    expect(projected?.id).toBe("rent-1");
    expect(projected?.recurrence?.startMonth).toBe("2026-03");
  });

  it("honors a cancellation saved in an older month over a newer open snapshot", () => {
    const documents = [
      // April carries the cancellation (recurrence ends in April)...
      buildDocument("2026-04", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-04" },
        }),
      ]),
      // ...while a newer June month still holds an open-ended snapshot.
      buildDocument("2026-06", [buildRecurringItem()]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    // The April cancellation wins despite the newer open June snapshot.
    expect(projectInto("2026-04")).toHaveLength(1);
    expect(projectInto("2026-05")).toHaveLength(0);
    expect(projectInto("2026-06")).toHaveLength(0);
  });

  it("takes the canonical definition from within the active range, not a stale future month", () => {
    const documents = [
      // April is the cancellation month and the latest in-range definition
      // (subtotal 1000)...
      buildDocument("2026-04", [
        buildRecurringItem({
          subtotal: 1000,
          recurrence: { startMonth: "2026-03", endMonth: "2026-04" },
        }),
      ]),
      // ...while a newer, still-open June month carries a different (stale,
      // out-of-range) subtotal that must NOT leak into the active range.
      buildDocument("2026-06", [
        buildRecurringItem({ subtotal: 1500 }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-03",
      baseItems: [],
    });

    expect(projected?.subtotal).toBe(1000);
    expect(projected?.recurrence?.endMonth).toBe("2026-04");
  });

  it("uses the earliest cancellation when several months carry an end month", () => {
    const documents = [
      buildDocument("2026-05", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-05" },
        }),
      ]),
      buildDocument("2026-07", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-07" },
        }),
      ]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    expect(projectInto("2026-05")).toHaveLength(1);
    expect(projectInto("2026-06")).toHaveLength(0);
  });

  it("re-enables projection once reactivation clears every stored end month", () => {
    // After reactivation no stored snapshot carries an end month, so the
    // recurrence projects forward again.
    const documents = [
      buildDocument("2026-04", [buildRecurringItem()]),
      buildDocument("2026-06", [buildRecurringItem()]),
    ];

    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth: "2026-08",
        baseItems: [],
      }),
    ).toHaveLength(1);
  });
});

describe("getOutOfRangeStoredLoanIds", () => {
  it("drops a cancelled recurring copy even when it is its own newest snapshot", () => {
    const targetMonth = "2026-07";
    // The only stored month is the future month itself, so it is its own newest
    // snapshot; its recurrence ends in May, before July.
    const targetDocument = buildDocument(targetMonth, [
      buildRecurringItem({
        recurrence: { startMonth: "2026-03", endMonth: "2026-05" },
      }),
    ]);

    expect(
      getOutOfRangeStoredLoanIds({
        documents: [targetDocument],
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual(["rent-1"]);
  });

  it("keeps an active recurring copy that still covers the target month", () => {
    const targetMonth = "2026-07";
    const targetDocument = buildDocument(targetMonth, [
      buildRecurringItem({
        recurrence: { startMonth: "2026-03", endMonth: "2026-09" },
      }),
    ]);

    expect(
      getOutOfRangeStoredLoanIds({
        documents: [targetDocument],
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual([]);
  });

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

  it("reports a stale plain copy left after the recurrence ended before its month", () => {
    const targetMonth = "2026-08";
    // August still stores a PLAIN copy (same id) from a prior replication...
    const targetDocument = buildDocument(targetMonth, [
      {
        currency: "ARS",
        description: "Alquiler",
        id: "rent-1",
        occurrencesPerMonth: 1,
        subtotal: 350000,
      },
    ]);
    // ...while the recurrence was cancelled to end in May, before August.
    const documents = [
      buildDocument("2026-05", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-05" },
        }),
      ]),
      targetDocument,
    ];

    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual(["rent-1"]);
  });

  it("keeps a historical plain copy stored before the recurrence start", () => {
    const targetMonth = "2026-01";
    // January stores a PLAIN copy (same id) from before the recurrence existed...
    const targetDocument = buildDocument(targetMonth, [
      {
        currency: "ARS",
        description: "Alquiler",
        id: "rent-1",
        occurrencesPerMonth: 1,
        subtotal: 350000,
      },
    ]);
    // ...while the recurrence only starts in March.
    const documents = [
      targetDocument,
      buildDocument("2026-03", [
        buildRecurringItem({ recurrence: { startMonth: "2026-03" } }),
      ]),
    ];

    // The pre-recurrence one-off is historical and must be preserved.
    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual([]);
  });

  it("keeps a recurring copy stored before the recurrence start month", () => {
    const targetMonth = "2026-01";
    // The store shares one recurrence definition per expense id, so a copy
    // replicated into a month BEFORE the chosen start loads carrying the
    // recurrence (start in March) even though its own month predates it. This
    // happens when an existing one-off with past replicas is converted into a
    // recurring expense in a later month.
    const targetDocument = buildDocument(targetMonth, [
      buildRecurringItem({ recurrence: { startMonth: "2026-03" } }),
    ]);
    const documents = [
      targetDocument,
      buildDocument("2026-03", [
        buildRecurringItem({ recurrence: { startMonth: "2026-03" } }),
      ]),
    ];

    // The pre-start occurrence is real historical data: dropping it would erase
    // past monthly totals for the converted expense.
    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual([]);
  });

  it("drops a recurring copy stored after the recurrence was cancelled", () => {
    const targetMonth = "2026-08";
    // A recurring copy still materialized in a month AFTER the cancellation end
    // must be dropped so the cancelled expense stops counting.
    const targetDocument = buildDocument(targetMonth, [
      buildRecurringItem({
        recurrence: { startMonth: "2026-03", endMonth: "2026-05" },
      }),
    ]);
    const documents = [
      buildDocument("2026-03", [
        buildRecurringItem({
          recurrence: { startMonth: "2026-03", endMonth: "2026-05" },
        }),
      ]),
      targetDocument,
    ];

    expect(
      getOutOfRangeStoredLoanIds({
        documents,
        targetMonth,
        baseItems: targetDocument.items,
      }),
    ).toEqual(["rent-1"]);
  });

  it("does not report a genuine plain expense with no loan/recurrence canonical", () => {
    const targetMonth = "2026-08";
    const targetDocument = buildDocument(targetMonth, [
      {
        currency: "ARS",
        description: "Internet",
        id: "internet-1",
        occurrencesPerMonth: 1,
        subtotal: 20000,
      },
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
