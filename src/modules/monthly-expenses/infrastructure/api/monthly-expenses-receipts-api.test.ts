import { vi, describe, it, expect } from "vitest";
import {
  uploadMonthlyExpenseReceiptViaApi,
} from "./monthly-expenses-receipts-api";

const uploadPayload = {
  contentBase64: "dGVzdA==",
  coveredPayments: 2,
  expenseDescription: "Internet",
  fileName: "comprobante.pdf",
  month: "2026-03",
  mimeType: "application/pdf",
};

describe("monthly-expenses-receipts-api client", () => {
  it("sends x-correlation-id header on upload requests", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          allReceiptsFolderId: "all-receipts-folder-id",
          allReceiptsFolderViewUrl:
            "https://drive.google.com/drive/folders/all-receipts-folder-id",
          coveredPayments: 2,
          fileId: "receipt-file-id",
          fileName: "comprobante.pdf",
          fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
          registeredAt: "2026-04-14T12:00:00.000Z",
          monthlyFolderId: "receipt-folder-id",
          monthlyFolderViewUrl:
            "https://drive.google.com/drive/folders/receipt-folder-id",
        },
      }),
      ok: true,
    });

    await uploadMonthlyExpenseReceiptViaApi(
      uploadPayload,
      {
        fetchImplementation,
      },
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

  it("reports upload progress when using XMLHttpRequest", async () => {
    const originalXmlHttpRequest = global.XMLHttpRequest;
    const progressCallback = vi.fn();
    const setRequestHeader = vi.fn();
    const open = vi.fn();

    class MockXMLHttpRequest {
      onabort: ((event: ProgressEvent<EventTarget>) => unknown) | null = null;
      onerror: ((event: ProgressEvent<EventTarget>) => unknown) | null = null;
      onload: ((event: ProgressEvent<EventTarget>) => unknown) | null = null;
      requestBody = "";
      response: unknown = null;
      responseText = "";
      responseType: XMLHttpRequestResponseType = "";
      status = 0;
      upload: {
        onprogress: ((event: ProgressEvent<EventTarget>) => unknown) | null;
      } = {
        onprogress: null,
      };

      open = open;
      setRequestHeader = setRequestHeader;

      send = (body: string) => {
        this.requestBody = body;

        if (this.upload.onprogress) {
          this.upload.onprogress({
            lengthComputable: true,
            loaded: 75,
            total: 100,
          } as ProgressEvent<EventTarget>);
        }

        this.status = 200;
        this.response = {
          data: {
            allReceiptsFolderId: "all-receipts-folder-id",
            allReceiptsFolderViewUrl:
              "https://drive.google.com/drive/folders/all-receipts-folder-id",
            coveredPayments: 2,
            fileId: "receipt-file-id",
            fileName: "comprobante.pdf",
            fileViewUrl: "https://drive.google.com/file/d/receipt-file-id/view",
            registeredAt: "2026-04-14T12:00:00.000Z",
            monthlyFolderId: "receipt-folder-id",
            monthlyFolderViewUrl:
              "https://drive.google.com/drive/folders/receipt-folder-id",
          },
        };

        this.onload?.(new ProgressEvent("load"));
      };
    }

    Object.defineProperty(global, "XMLHttpRequest", {
      configurable: true,
      value: MockXMLHttpRequest,
      writable: true,
    });

    try {
      await uploadMonthlyExpenseReceiptViaApi(uploadPayload, {
        onUploadProgress: progressCallback,
      });
    } finally {
      Object.defineProperty(global, "XMLHttpRequest", {
        configurable: true,
        value: originalXmlHttpRequest,
        writable: true,
      });
    }

    expect(open).toHaveBeenCalledWith(
      "POST",
      "/api/storage/monthly-expenses-receipts",
    );
    expect(setRequestHeader).toHaveBeenCalledWith(
      "content-type",
      "application/json",
    );
    expect(progressCallback).toHaveBeenCalledWith(75);
  });
});
