import {
  calculateMonthlyExpenseTotal,
  calculateLoanEndMonth,
  calculatePaidLoanInstallments,
  createMonthlyExpensesDocument,
  MAX_OCCURRENCES_UNIT_LENGTH,
  occurrenceDurationToHours,
} from "./monthly-expenses-document";

describe("monthlyExpensesDocument", () => {
  it("normalizes expense rows and calculates totals for each item", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "  Empleada domestica  ",
            id: "expense-1",
            loan: {
              installmentCount: 12,
              lenderName: "  Papa  ",
              startMonth: "2026-01",
            },
            occurrencesPerMonth: 8,
            subtotal: 6000,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result).toEqual({
      hasReplicatedFromPreviousMonth: false,
      items: [
        {
          currency: "ARS",
          description: "Empleada domestica",
          id: "expense-1",
          loan: {
            direction: "payable",
            endMonth: "2026-12",
            installmentCount: 12,
            lenderName: "Papa",
            paidInstallments: 3,
            startMonth: "2026-01",
          },
          manualCoveredPayments: 0,
          occurrencesPerMonth: 8,
          paymentLink: null,
          paymentRecords: [],
          receipts: [],
          subtotal: 6000,
          subtotalUnit: "occurrence",
          total: 48000,
        },
      ],
      month: "2026-03",
    });
  });

  it("rejects an invalid month before persisting the document", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [],
          month: "03-2026",
        },
        "Saving monthly expenses",
      ),
    ).toThrow("Saving monthly expenses requires a month in YYYY-MM format.");
  });

  it("rejects items without description, subtotal, or monthly occurrences", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "  ",
              id: "expense-1",
              occurrencesPerMonth: 0,
              subtotal: 0,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires every expense to include a description, a subtotal greater than 0, and occurrences per month greater than 0.",
    );
  });

  it("rejects loan items without a valid start month and installment count", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo tarjeta",
              id: "expense-1",
              loan: {
                installmentCount: 0,
                startMonth: "2026/01",
              },
              occurrencesPerMonth: 1,
              subtotal: 50000,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires a loan start month in YYYY-MM format.",
    );
  });

  it("normalizes receivable loan direction when another person owes money", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Prestamo a proveedor",
            id: "expense-1",
            loan: {
              direction: "receivable",
              installmentCount: 4,
              lenderName: "Proveedor",
              startMonth: "2026-01",
            },
            occurrencesPerMonth: 1,
            subtotal: 10000,
          },
        ],
        month: "2026-02",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.loan?.direction).toBe("receivable");
  });

  it("keeps currency totals stable for decimal subtotals", () => {
    expect(
      calculateMonthlyExpenseTotal({
        occurrencesPerMonth: 8,
        subtotal: 2.49,
      }),
    ).toBe(19.92);
  });

  it("ignores the duration for occurrence-priced subtotals", () => {
    expect(
      calculateMonthlyExpenseTotal({
        durationHours: 4.5,
        occurrencesPerMonth: 2,
        subtotal: 5000,
        subtotalUnit: "occurrence",
      }),
    ).toBe(10000);
  });

  it("multiplies by the duration for hourly-priced subtotals", () => {
    expect(
      calculateMonthlyExpenseTotal({
        durationHours: 4.5,
        occurrencesPerMonth: 2,
        subtotal: 5000,
        subtotalUnit: "hour",
      }),
    ).toBe(45000);
  });

  it("treats a missing duration as one hour for hourly-priced subtotals", () => {
    expect(
      calculateMonthlyExpenseTotal({
        durationHours: 0,
        occurrencesPerMonth: 3,
        subtotal: 5000,
        subtotalUnit: "hour",
      }),
    ).toBe(15000);
  });

  it("parses the per-occurrence duration into decimal hours", () => {
    expect(occurrenceDurationToHours("veces de 4h 30")).toBe(4.5);
    expect(occurrenceDurationToHours("veces de 2h")).toBe(2);
    expect(occurrenceDurationToHours("veces de 30 min")).toBe(0.5);
    expect(occurrenceDurationToHours("veces de 30m")).toBe(0.5);
    expect(occurrenceDurationToHours("veces")).toBe(0);
    expect(occurrenceDurationToHours("")).toBe(0);
    expect(occurrenceDurationToHours(null)).toBe(0);
  });

  it("derives the total from the subtotal unit and duration when normalizing a document", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Empleada doméstica",
            id: "expense-hourly",
            occurrencesPerMonth: 2,
            occurrencesUnit: "veces de 4h 30",
            subtotal: 5000,
            subtotalUnit: "hour",
          },
        ],
        month: "2026-06",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.subtotalUnit).toBe("hour");
    expect(result.items[0]?.total).toBe(45000);
  });

  it("defaults the subtotal unit to occurrence when none is provided", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-occurrence",
            occurrencesPerMonth: 2,
            occurrencesUnit: "veces de 4h 30",
            subtotal: 5000,
          },
        ],
        month: "2026-06",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.subtotalUnit).toBe("occurrence");
    expect(result.items[0]?.total).toBe(10000);
  });

  it("calculates the loan end month from the start month and installments", () => {
    expect(
      calculateLoanEndMonth({
        installmentCount: 12,
        startMonth: "2026-01",
      }),
    ).toBe("2026-12");
  });

  it("calculates paid installments for the visible month and caps them at the total", () => {
    expect(
      calculatePaidLoanInstallments({
        installmentCount: 12,
        startMonth: "2026-01",
        targetMonth: "2026-02",
      }),
    ).toBe(2);

    expect(
      calculatePaidLoanInstallments({
        installmentCount: 12,
        startMonth: "2026-01",
        targetMonth: "2027-02",
      }),
    ).toBe(12);
  });

  it("supports regular expenses without loan metadata", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "USD",
            description: "Google One",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 2.49,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]).toEqual({
      currency: "USD",
      description: "Google One",
      id: "expense-1",
      manualCoveredPayments: 0,
      occurrencesPerMonth: 1,
      paymentLink: null,
      paymentRecords: [],
      receipts: [],
      subtotal: 2.49,
      subtotalUnit: "occurrence",
      total: 2.49,
    });
  });

  it("keeps isPaid when explicitly enabled for an expense without receipts", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            isPaid: true,
            occurrencesPerMonth: 1,
            subtotal: 100,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.isPaid).toBe(true);
  });

  it("keeps expenses pending when covered payments do not reach occurrences", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Limpieza",
            id: "expense-1",
            manualCoveredPayments: 1,
            occurrencesPerMonth: 8,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 2,
                fileId: "receipt-file-id-1",
                fileName: "transferencia_01.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id-1/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 3,
                fileId: "receipt-file-id-2",
                fileName: "transferencia_02.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id-2/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
            ],
            subtotal: 100,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.manualCoveredPayments).toBe(1);
    expect(result.items[0]?.receipts.map((receipt) => receipt.coveredPayments)).toEqual([
      2,
      3,
    ]);
    expect(result.items[0]?.isPaid).toBeUndefined();
  });

  it("marks an expense as paid when covered payments reach occurrences", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Limpieza",
            id: "expense-1",
            manualCoveredPayments: 2,
            occurrencesPerMonth: 8,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 3,
                fileId: "receipt-file-id-1",
                fileName: "transferencia_01.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id-1/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 3,
                fileId: "receipt-file-id-2",
                fileName: "transferencia_02.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id-2/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
            ],
            subtotal: 100,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.isPaid).toBe(true);
  });

  it("migrates legacy isPaid=true without coverage to full manual coverage", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            isPaid: true,
            occurrencesPerMonth: 8,
            subtotal: 100,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.manualCoveredPayments).toBe(8);
    expect(result.items[0]?.isPaid).toBe(true);
  });

  it("forces isPaid to true when receipts exist", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            isPaid: false,
            occurrencesPerMonth: 1,
            receipts: [
              {
                allReceiptsFolderId: "receipt-folder-id",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 1,
                fileId: "receipt-file-id",
                fileName: "comprobante.pdf",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id/view",
                monthlyFolderId: "receipt-month-folder-id",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
            ],
            subtotal: 100,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.isPaid).toBe(true);
  });

  it("normalizes payment links and adds https protocol when omitted", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Electricidad",
            id: "expense-1",
            occurrencesPerMonth: 1,
            paymentLink: "  pagos.empresa-energia.com  ",
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.paymentLink).toBe("https://pagos.empresa-energia.com");
  });

  it("rejects payment links that are not valid URLs", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Electricidad",
              id: "expense-1",
              occurrencesPerMonth: 1,
              paymentLink: "asdads",
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow("Saving monthly expenses requires every payment link to be a valid URL.");
  });

  it("requires a valid international receipt share phone when sharing is enabled", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Electricidad",
              id: "expense-1",
              occurrencesPerMonth: 1,
              requiresReceiptShare: true,
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires a valid international receipt share phone when receipt sharing is enabled.",
    );
  });

  it("normalizes receipt share phone digits and defaults share status to pending", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Electricidad",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receiptSharePhoneDigits: "+54 9 11 2345-6789",
            requiresReceiptShare: true,
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.receiptSharePhoneDigits).toBe("5491123456789");
    expect(result.items[0]?.receiptShareStatus).toBe("pending");
    expect(result.items[0]?.requiresReceiptShare).toBe(true);
  });

  it("rejects invalid receipt share statuses", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Electricidad",
              id: "expense-1",
              occurrencesPerMonth: 1,
              receiptSharePhoneDigits: "5491123456789",
              receiptShareStatus: "done" as unknown as "pending",
              requiresReceiptShare: true,
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires every receipt share status to be pending or sent.",
    );
  });

  it("normalizes receipt metadata and keeps Drive links", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [
              {
                allReceiptsFolderId: " receipt-folder-id ",
                allReceiptsFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-folder-id",
                coveredPayments: 2,
                fileId: " receipt-file-id ",
                fileName: " comprobante.pdf ",
                fileViewUrl:
                  "https://drive.google.com/file/d/receipt-file-id/view",
                monthlyFolderId: " receipt-month-folder-id ",
                monthlyFolderViewUrl:
                  "https://drive.google.com/drive/folders/receipt-month-folder-id",
              },
            ],
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.receipts).toEqual([
      {
        allReceiptsFolderId: "receipt-folder-id",
        allReceiptsFolderViewUrl:
          "https://drive.google.com/drive/folders/receipt-folder-id",
        coveredPayments: 2,
        fileId: "receipt-file-id",
        fileName: "comprobante.pdf",
        fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
        monthlyFolderId: "receipt-month-folder-id",
        monthlyFolderViewUrl:
          "https://drive.google.com/drive/folders/receipt-month-folder-id",
      },
    ]);
  });

  it("rejects receipt metadata when Drive URLs are invalid", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-1",
              occurrencesPerMonth: 1,
              receipts: [
                {
                  allReceiptsFolderId: "receipt-folder-id",
                  allReceiptsFolderViewUrl:
                    "https://drive.google.com/drive/folders/receipt-folder-id",
                  coveredPayments: 1,
                  fileId: "receipt-file-id",
                  fileName: "comprobante.pdf",
                  fileViewUrl: "not-a-url",
                  monthlyFolderId: "receipt-month-folder-id",
                  monthlyFolderViewUrl:
                    "https://drive.google.com/drive/folders/receipt-month-folder-id",
                },
              ],
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires every receipt to include valid Drive URLs.",
    );
  });

  it("rejects receipt metadata when coveredPayments is not a positive integer", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-1",
              occurrencesPerMonth: 8,
              receipts: [
                {
                  allReceiptsFolderId: "receipt-folder-id",
                  allReceiptsFolderViewUrl:
                    "https://drive.google.com/drive/folders/receipt-folder-id",
                  coveredPayments: 0,
                  fileId: "receipt-file-id",
                  fileName: "comprobante.pdf",
                  fileViewUrl:
                    "https://drive.google.com/file/d/receipt-file-id/view",
                  monthlyFolderId: "receipt-month-folder-id",
                  monthlyFolderViewUrl:
                    "https://drive.google.com/drive/folders/receipt-month-folder-id",
                },
              ],
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires every receipt to include covered payments greater than 0.",
    );
  });

  it("rejects manualCoveredPayments when it is negative", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-1",
              manualCoveredPayments: -1,
              occurrencesPerMonth: 8,
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires manual covered payments greater than or equal to 0.",
    );
  });

  it("keeps folder metadata even when an item has no receipts", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: " receipt-folder-id ",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              monthlyFolderId: " receipt-month-folder-id ",
              monthlyFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-month-folder-id",
            },
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [],
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    });
    expect(result.items[0]?.receipts).toEqual([]);
  });

  it("keeps shared folder metadata when the monthly folder reference is intentionally blank", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: " receipt-folder-id ",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              monthlyFolderId: " ",
              monthlyFolderViewUrl: " ",
            },
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [],
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "",
      monthlyFolderViewUrl: "",
    });
  });

  it("normalizes the occurrences unit and keeps the total based on the quantity only", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Clases de ingles",
            id: "expense-1",
            occurrencesPerMonth: 4,
            occurrencesUnit: "  semanas  ",
            subtotal: 5000,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.occurrencesUnit).toBe("semanas");
    expect(result.items[0]?.total).toBe(20000);
  });

  it("omits the occurrences unit when it is empty or whitespace", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            occurrencesUnit: "   ",
            subtotal: 100,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]).not.toHaveProperty("occurrencesUnit");
  });

  it("rejects an occurrences unit longer than the allowed maximum", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Clases",
              id: "expense-1",
              occurrencesPerMonth: 4,
              occurrencesUnit: "x".repeat(MAX_OCCURRENCES_UNIT_LENGTH + 1),
              subtotal: 5000,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      `Saving monthly expenses requires every occurrence unit to be at most ${MAX_OCCURRENCES_UNIT_LENGTH} characters.`,
    );
  });
});
