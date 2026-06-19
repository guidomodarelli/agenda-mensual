import {
  createMonthlyExpensesFileName,
  mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument,
  mapMonthlyExpensesDocumentToGoogleDriveFile,
  parseGoogleDriveMonthlyExpensesContent,
} from "./mapper";

describe("monthlyExpensesGoogleDriveMapper", () => {
  it("serializes the monthly document into a Drive JSON file", () => {
    const result = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Expensas",
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 55032.07,
          total: 55032.07,
        },
      ],
      month: "2026-03",
    });

    expect(result).toEqual({
      content: JSON.stringify(
        {
          items: [
            {
              currency: "ARS",
              description: "Expensas",
              id: "expense-1",
              occurrencesPerMonth: 1,
              paymentLink: null,
              subtotal: 55032.07,
            },
          ],
          month: "2026-03",
        },
        null,
        2,
      ),
      mimeType: "application/json",
      name: "control-mensual-2026-marzo.json",
    });
    expect(createMonthlyExpensesFileName("2026-03")).toBe(
      "control-mensual-2026-marzo.json",
    );
  });

  it("serializes loan metadata without derived fields", () => {
    const result = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Prestamo familiar",
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
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 50000,
          total: 50000,
        },
      ],
      month: "2026-03",
    });

    expect(result.content).toBe(
      JSON.stringify(
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo familiar",
              id: "expense-1",
              loan: {
                direction: "payable",
                installmentCount: 12,
                lenderName: "Papa",
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              paymentLink: null,
              subtotal: 50000,
            },
          ],
          month: "2026-03",
        },
        null,
        2,
      ),
    );
  });

  it("round-trips recurrence metadata through Drive storage", () => {
    const result = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Alquiler",
          id: "expense-1",
          recurrence: {
            startMonth: "2026-01",
            endMonth: "2026-06",
            isActive: false,
          },
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 350000,
          total: 350000,
        },
      ],
      month: "2026-03",
    });

    const serializedItem = JSON.parse(result.content).items[0];
    expect(serializedItem.recurrence).toEqual({
      startMonth: "2026-01",
      endMonth: "2026-06",
    });

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      result.content,
      "Loading monthly expenses",
    );
    expect(parsed.items[0]?.recurrence).toEqual({
      startMonth: "2026-01",
      endMonth: "2026-06",
      // The document month (2026-03) falls inside [2026-01, 2026-06].
      isActive: true,
    });
  });

  it("omits a null recurrence end month when round-tripping through Drive storage", () => {
    const result = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Expensas",
          id: "expense-1",
          recurrence: { startMonth: "2026-01", endMonth: null, isActive: true },
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 90000,
          total: 90000,
        },
      ],
      month: "2026-03",
    });

    const serializedItem = JSON.parse(result.content).items[0];
    expect(serializedItem.recurrence).toEqual({ startMonth: "2026-01" });

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      result.content,
      "Loading monthly expenses",
    );
    expect(parsed.items[0]?.recurrence?.endMonth).toBeNull();
  });

  it("parses stored Drive content into the internal monthly document", () => {
    const result = parseGoogleDriveMonthlyExpensesContent(
      JSON.stringify({
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
      }),
      "Loading monthly expenses",
    );

    expect(result).toEqual({
      excludedLoanIds: [],
      hasReplicatedFromPreviousMonth: false,
      items: [
        {
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
        },
      ],
      month: "2026-03",
    });
  });

  it("parses stored loan metadata and derives the payment progress", () => {
    const result = parseGoogleDriveMonthlyExpensesContent(
      JSON.stringify({
        items: [
          {
            currency: "ARS",
            description: "Prestamo tarjeta",
            id: "expense-1",
            loan: {
              direction: "receivable",
              installmentCount: 12,
              lenderName: "Papa",
              startMonth: "2026-01",
            },
            occurrencesPerMonth: 1,
            subtotal: 50000,
          },
        ],
        month: "2026-03",
      }),
      "Loading monthly expenses",
    );

    expect(result).toEqual({
      excludedLoanIds: [],
      hasReplicatedFromPreviousMonth: false,
      items: [
        {
          currency: "ARS",
          description: "Prestamo tarjeta",
          id: "expense-1",
          loan: {
            direction: "receivable",
            endMonth: "2026-12",
            installmentCount: 12,
            lenderName: "Papa",
            paidInstallments: 3,
            startMonth: "2026-01",
          },
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          paymentRecords: [],
          receipts: [],
          subtotal: 50000,
          subtotalUnit: "occurrence",
          total: 50000,
        },
      ],
      month: "2026-03",
    });
  });

  it("maps file metadata into the stored document result", () => {
    expect(
      mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument(
        {
          id: "monthly-expenses-file-id",
          name: "control-mensual-2026-marzo.json",
          webViewLink:
            "https://drive.google.com/file/d/monthly-expenses-file-id/view",
        },
        "2026-03",
      ),
    ).toEqual({
      id: "monthly-expenses-file-id",
      month: "2026-03",
      name: "control-mensual-2026-marzo.json",
      viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
    });
  });

  it("serializes and parses paymentLink when provided", () => {
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Electricidad",
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: "pagos.empresa-energia.com",
          receipts: [],
          subtotal: 45,
          total: 45,
        },
      ],
      month: "2026-03",
    });

    expect(serialized.content).toContain(
      '"paymentLink": "pagos.empresa-energia.com"',
    );

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    expect(parsed.items[0]?.paymentLink).toBe("https://pagos.empresa-energia.com");
  });

  it("round-trips excludedLoanIds through Drive storage", () => {
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      excludedLoanIds: ["loan-9", "loan-1"],
      items: [
        {
          currency: "ARS",
          description: "Electricidad",
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 45,
          total: 45,
        },
      ],
      month: "2026-03",
    });

    expect(serialized.content).toContain('"excludedLoanIds"');

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    // Domain normalization sorts and dedupes the ids.
    expect(parsed.excludedLoanIds).toEqual(["loan-1", "loan-9"]);
  });

  it("omits excludedLoanIds when empty and parses them to an empty list", () => {
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      excludedLoanIds: [],
      items: [
        {
          currency: "ARS",
          description: "Electricidad",
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 45,
          total: 45,
        },
      ],
      month: "2026-03",
    });

    expect(serialized.content).not.toContain('"excludedLoanIds"');

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    expect(parsed.excludedLoanIds).toEqual([]);
  });

  it("serializes and parses isPaid when enabled", () => {
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          isPaid: true,
          manualCoveredPayments: 1,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 100,
          total: 100,
        },
      ],
      month: "2026-03",
    });

    expect(serialized.content).toContain('"isPaid": true');

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    expect(parsed.items[0]?.isPaid).toBe(true);
  });

  it("serializes and parses the occurrences unit when provided", () => {
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Clases de ingles",
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 4,
          occurrencesUnit: "semanas",
          paymentLink: null,
          receipts: [],
          subtotal: 5000,
          total: 20000,
        },
      ],
      month: "2026-03",
    });

    expect(serialized.content).toContain('"occurrencesUnit": "semanas"');

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    expect(parsed.items[0]?.occurrencesUnit).toBe("semanas");
  });

  it("parses legacy content without an occurrences unit", () => {
    const parsed = parseGoogleDriveMonthlyExpensesContent(
      JSON.stringify({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 100,
          },
        ],
        month: "2026-03",
      }),
      "Loading monthly expenses",
    );

    expect(parsed.items[0]).not.toHaveProperty("occurrencesUnit");
  });

  it("throws when parsing an invalid paymentLink", () => {
    expect(() =>
      parseGoogleDriveMonthlyExpensesContent(
        JSON.stringify({
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
        }),
        "Loading monthly expenses",
      ),
    ).toThrow("Loading monthly expenses could not parse the stored monthly expenses document.");
  });

  it("serializes and parses receipt sharing metadata", () => {
    const receipt = {
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      coveredPayments: 1,
      fileId: "receipt-file-id",
      fileName: "comprobante.pdf",
      fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    };
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentRecords: [
            {
              coveredPayments: 1,
              id: "payment-1",
              receipt,
              registeredAt: null,
              sendStatus: "sent",
            },
          ],
          receiptShareMessage: "Hola",
          receiptSharePhoneDigits: "5491123456789",
          requiresReceiptShare: true,
          paymentLink: null,
          receipts: [receipt],
          subtotal: 45,
          total: 45,
        },
      ],
      month: "2026-03",
    });

    expect(serialized.content).toContain('"requiresReceiptShare": true');
    expect(serialized.content).toContain('"receiptSharePhoneDigits": "5491123456789"');
    expect(serialized.content).toContain('"sendStatus": "sent"');

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    expect(parsed.items[0]?.requiresReceiptShare).toBe(true);
    expect(parsed.items[0]?.receiptSharePhoneDigits).toBe("5491123456789");
    expect(parsed.items[0]?.paymentRecords?.[0]?.sendStatus).toBe("sent");
  });

  it("throws when parsing an invalid receiptSharePhoneDigits", () => {
    expect(() =>
      parseGoogleDriveMonthlyExpensesContent(
        JSON.stringify({
          items: [
            {
              currency: "ARS",
              description: "Internet",
              id: "expense-1",
              occurrencesPerMonth: 1,
              receiptSharePhoneDigits: "123",
              requiresReceiptShare: true,
              subtotal: 45,
            },
          ],
          month: "2026-03",
        }),
        "Loading monthly expenses",
      ),
    ).toThrow("Loading monthly expenses could not parse the stored monthly expenses document.");
  });

  it("parses legacy singular receipt payloads into receipts array", () => {
    const result = parseGoogleDriveMonthlyExpensesContent(
      JSON.stringify({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipt: {
              fileId: "receipt-file-id",
              fileName: "comprobante.pdf",
              fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
              folderId: "receipt-folder-id",
              folderViewUrl: "https://drive.google.com/drive/folders/receipt-folder-id",
            },
            subtotal: 100,
          },
        ],
        month: "2026-03",
      }),
      "Loading monthly expenses",
    );

    expect(result.items[0]?.receipts).toEqual([
      {
        allReceiptsFolderId: "receipt-folder-id",
        allReceiptsFolderViewUrl:
          "https://drive.google.com/drive/folders/receipt-folder-id",
        coveredPayments: 1,
        fileId: "receipt-file-id",
        fileName: "comprobante.pdf",
        fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
        monthlyFolderId: "receipt-folder-id",
        monthlyFolderViewUrl:
          "https://drive.google.com/drive/folders/receipt-folder-id",
      },
    ]);
  });

  it("serializes and parses folder metadata at item level without receipts", () => {
    const serialized = mapMonthlyExpensesDocumentToGoogleDriveFile({
      items: [
        {
          currency: "ARS",
          description: "Internet",
          folders: {
            allReceiptsFolderId: "receipt-folder-id",
            allReceiptsFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-folder-id",
            monthlyFolderId: "receipt-month-folder-id",
            monthlyFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-month-folder-id",
          },
          id: "expense-1",
          manualCoveredPayments: 0,
          occurrencesPerMonth: 1,
          paymentLink: null,
          receipts: [],
          subtotal: 45,
          total: 45,
        },
      ],
      month: "2026-03",
    });

    const parsed = parseGoogleDriveMonthlyExpensesContent(
      serialized.content,
      "Loading monthly expenses",
    );

    expect(parsed.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "receipt-month-folder-id",
      monthlyFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-month-folder-id",
    });
    expect(parsed.items[0]?.receipts).toEqual([]);
  });

  it("parses shared folder metadata when the monthly folder reference is blank", () => {
    const result = parseGoogleDriveMonthlyExpensesContent(
      JSON.stringify({
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: "receipt-folder-id",
              allReceiptsFolderViewUrl:
                "https://drive.google.com/drive/folders/receipt-folder-id",
              monthlyFolderId: "",
              monthlyFolderViewUrl: "",
            },
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 45,
          },
        ],
        month: "2026-03",
      }),
      "Loading monthly expenses",
    );

    expect(result.items[0]?.folders).toEqual({
      allReceiptsFolderId: "receipt-folder-id",
      allReceiptsFolderViewUrl:
        "https://drive.google.com/drive/folders/receipt-folder-id",
      monthlyFolderId: "",
      monthlyFolderViewUrl: "",
    });
    expect(result.items[0]?.receipts).toEqual([]);
  });
});
