import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  readSharedReceiptPayload,
  type SharedReceiptPayload,
} from "@/modules/monthly-expenses/infrastructure/pwa/shared-receipt-payload";
import ReceiptShareTargetPage from "./receipt-share-target-page";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/finance-app-shell/finance-app-shell", () => ({
  useFinanceAppShellNavigation: vi.fn(),
}));


vi.mock("@/components/monthly-expenses/receipt-file-uploader", () => ({
  ReceiptFileUploader: ({ onInvalidFileType }: { onInvalidFileType?: () => void }) => (
    <div data-testid="receipt-file-uploader">
      <button onClick={onInvalidFileType} type="button">
        trigger-invalid-file-type
      </button>
    </div>
  ),
}));

vi.mock("@/modules/monthly-expenses/infrastructure/pwa/shared-receipt-payload", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/modules/monthly-expenses/infrastructure/pwa/shared-receipt-payload")>(),
  clearSharedReceiptPayload: vi.fn(),
  consumeSharedReceiptPayload: vi.fn(),
  readSharedReceiptPayload: vi.fn().mockResolvedValue(null),
}));

const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
const mockedUseSession = vi.mocked(useSession);
const mockedReadSharedReceiptPayload = vi.mocked(readSharedReceiptPayload);

const IPHONE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const SHARED_INTERNET_RECEIPT: SharedReceiptPayload = {
  contentBase64: "JVBERi0xLjQ=",
  fileName: "2026-09-01_internet.pdf",
  mimeType: "application/pdf",
  receivedAtIso: "2026-09-01T12:00:00.000Z",
  sizeBytes: 8,
  source: "web-share-target",
};

const originalFetch = global.fetch;

/** Answers the month document request with an electricity and a three-payment internet expense. */
function respondWithMonthDocument() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const month = new URL(String(input), "http://localhost").searchParams.get("month");
    return new Response(
      JSON.stringify({
        data: {
          items: [
            { currency: "ARS", description: "Luz", id: "electricity-expense", occurrencesPerMonth: 1, subtotal: 100, total: 100 },
            { currency: "ARS", description: "Internet", id: "internet-expense", occurrencesPerMonth: 3, subtotal: 50, total: 150 },
          ],
          month,
        },
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  }) as typeof fetch;
}

/** Renders the page signed in, with a shared internet receipt waiting to be associated. */
function renderWithSharedInternetReceipt() {
  mockedUseSession.mockReturnValue({
    data: { expires: "2099-01-01T00:00:00.000Z", user: { email: "persona@example.com" } },
    status: "authenticated",
    update: vi.fn(),
  } as ReturnType<typeof useSession>);
  mockedReadSharedReceiptPayload.mockResolvedValueOnce(SHARED_INTERNET_RECEIPT);
  respondWithMonthDocument();
  render(<ReceiptShareTargetPage />);
}

describe("ReceiptShareTargetPage", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockedUseRouter.mockReturnValue({
      push: vi.fn().mockResolvedValue(true),
      replace: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as unknown as ReturnType<typeof useSearchParams>);
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    } as ReturnType<typeof useSession>);
  });

  it("keeps manual uploader available after selecting an invalid file type", async () => {
    const user = userEvent.setup();

    render(<ReceiptShareTargetPage />);

    await waitFor(() => {
      expect(screen.getByTestId("receipt-file-uploader")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "trigger-invalid-file-type" }));

    expect(screen.getByText("Solo se admiten comprobantes PDF, JPG, PNG, WEBP, HEIC o HEIF.")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-file-uploader")).toBeInTheDocument();
    expect(screen.queryByText("Secciones")).not.toBeInTheDocument();
  });

  it("shows the share error reported in the URL and keeps the manual uploader", async () => {
    mockedUseSearchParams.mockReturnValue({
      get: vi.fn((name: string) => (name === "shareError" ? "missing-file" : null)),
    } as unknown as ReturnType<typeof useSearchParams>);

    render(<ReceiptShareTargetPage />);

    expect(
      await screen.findByText("No recibimos un archivo al compartir con Control Mensual."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("receipt-file-uploader")).toBeInTheDocument();
  });

  it("tells iOS users to pick the receipt manually", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(IPHONE_USER_AGENT);

    render(<ReceiptShareTargetPage />);

    expect(
      await screen.findByText(/iOS no soporta recibir archivos compartidos en PWAs/),
    ).toBeInTheDocument();
  });

  it("preselects the expense that matches the shared receipt and keeps a manual choice", async () => {
    renderWithSharedInternetReceipt();

    const expenseSelect = screen.getByLabelText("Gasto existente");
    await waitFor(() => expect(expenseSelect).toHaveValue("internet-expense"));

    fireEvent.change(expenseSelect, { target: { value: "electricity-expense" } });

    expect(expenseSelect).toHaveValue("electricity-expense");
  });

  it("keeps partial coverage between one payment and the pending payments", async () => {
    const user = userEvent.setup();
    renderWithSharedInternetReceipt();
    await waitFor(() => expect(screen.getByLabelText("Gasto existente")).toHaveValue("internet-expense"));

    await user.click(screen.getByRole("radio", { name: "Parcial" }));
    const coveredPaymentsInput = screen.getByLabelText("Pagos cubiertos");
    expect(coveredPaymentsInput).toHaveValue(1);

    fireEvent.change(coveredPaymentsInput, { target: { value: "9" } });
    expect(coveredPaymentsInput).toHaveValue(3);

    fireEvent.change(coveredPaymentsInput, { target: { value: "2" } });
    expect(coveredPaymentsInput).toHaveValue(2);

    fireEvent.change(coveredPaymentsInput, { target: { value: "" } });
    expect(coveredPaymentsInput).toHaveValue(3);
  });
});
