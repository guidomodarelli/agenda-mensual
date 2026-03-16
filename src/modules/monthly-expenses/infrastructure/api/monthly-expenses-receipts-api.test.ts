import {
  uploadMonthlyExpenseReceiptViaApi,
} from "./monthly-expenses-receipts-api";

describe("monthly-expenses-receipts-api client", () => {
  it("sends x-correlation-id header on upload requests", async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          allReceiptsFolderId: "all-receipts-folder-id",
          allReceiptsFolderViewUrl:
            "https://drive.google.com/drive/folders/all-receipts-folder-id",
          coveredPayments: 2,
          fileId: "receipt-file-id",
          fileName: "comprobante.pdf",
          fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
          monthlyFolderId: "receipt-folder-id",
          monthlyFolderViewUrl:
            "https://drive.google.com/drive/folders/receipt-folder-id",
        },
      }),
      ok: true,
    });

    await uploadMonthlyExpenseReceiptViaApi(
      {
        contentBase64: "dGVzdA==",
        coveredPayments: 2,
        expenseDescription: "Internet",
        fileName: "comprobante.pdf",
        month: "2026-03",
        mimeType: "application/pdf",
      },
      fetchImplementation,
    );

    const options = fetchImplementation.mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const headers = new Headers(options?.headers);
    const requestPayload = JSON.parse(String(options?.body));

    expect(headers.get("x-correlation-id")).toEqual(expect.any(String));
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(requestPayload.coveredPayments).toBe(2);
  });
});
