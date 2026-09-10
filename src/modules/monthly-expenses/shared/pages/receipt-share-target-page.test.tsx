import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

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

describe("ReceiptShareTargetPage", () => {
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
});
