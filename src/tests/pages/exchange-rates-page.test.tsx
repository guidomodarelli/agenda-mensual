import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import type { ReactElement } from "react";
import { toast } from "sonner";

import ExchangeRatesPage from "@/modules/exchange-rates/shared/pages/exchange-rates-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(),
}));

jest.mock("sonner", () => {
  const mockToast = Object.assign(jest.fn(), {
    error: jest.fn(),
    info: jest.fn(),
    promise: jest.fn((promise: Promise<unknown>) => promise),
    success: jest.fn(),
    warning: jest.fn(),
  });

  return {
    toast: mockToast,
  };
});

type MockedToast = jest.Mock & {
  error: jest.Mock;
  info: jest.Mock;
  promise: jest.Mock;
  success: jest.Mock;
  warning: jest.Mock;
};

const mockedUseRouter = jest.mocked(useRouter);
const mockedUseSession = jest.mocked(useSession);
const mockedSignIn = jest.mocked(signIn);
const mockedSignOut = jest.mocked(signOut);
const mockedToast = toast as unknown as MockedToast;
const originalFetch = global.fetch;

function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const bootstrap: StorageBootstrapResult = {
  architecture: {
    dataStrategy: "ssr-first",
    middleendLocation: "src/modules",
    routing: "app-router",
  },
  authStatus: "configured",
  requiredScopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file",
  ],
  storageTargets: [
    {
      id: "userFiles",
      requiredScope: "https://www.googleapis.com/auth/drive.file",
      writesUserVisibleFiles: true,
    },
  ],
};

const basePageProps = {
  bootstrap,
  result: {
    blueRate: 1290,
    canEditIibb: true,
    iibbRateDecimal: 0.02,
    loadErrorCode: null,
    loadError: null,
    maxSelectableMonth: "2026-03",
    minSelectableMonth: "2026-01",
    officialRate: 1200,
    selectedMonth: "2026-03",
    solidarityRate: 1476,
  },
};

describe("ExchangeRatesPage", () => {
  beforeEach(() => {
    mockedSignIn.mockReset();
    mockedSignOut.mockReset();
    mockedToast.mockReset();
    mockedToast.error.mockReset();
    mockedToast.info.mockReset();
    mockedToast.promise.mockReset();
    mockedToast.success.mockReset();
    mockedToast.warning.mockReset();
    mockedUseRouter.mockReturnValue({
      replace: jest.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSession.mockReturnValue({
      data: {
        expires: "2026-03-14T12:00:00.000Z",
        user: {
          email: "admin@example.com",
          image: null,
          name: "Admin User",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("renders the three exchange rate values without a local shell wrapper", () => {
    renderWithProviders(<ExchangeRatesPage {...basePageProps} />);

    expect(
      screen.getByRole("heading", { name: "Cotizaciones del dólar" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$.*1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText(/\$.*1\.290,00/)).toBeInTheDocument();
    expect(screen.getByText(/\$.*1\.476,00/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mes y año")).toHaveValue("2026-03");
    expect(screen.queryByText("Secciones")).not.toBeInTheDocument();
  });

  it("shows the IIBB input only for admins and saves the updated value", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          iibbRateDecimal: 0.05,
        },
      }),
      ok: true,
    });

    renderWithProviders(<ExchangeRatesPage {...basePageProps} />);

    const iibbInput = screen.getByLabelText("IIBB en formato decimal");
    await user.clear(iibbInput);
    await user.type(iibbInput, "0.05");
    await user.click(screen.getByRole("button", { name: "Guardar IIBB" }));

    await waitFor(() => {
      expect(screen.getByText(/IIBB \(5,00%\)/)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/exchange-rates/settings",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("navigates with the selected month in the query string", async () => {
    const replace = jest.fn().mockResolvedValue(true);
    mockedUseRouter.mockReturnValue({
      replace,
    } as unknown as ReturnType<typeof useRouter>);

    renderWithProviders(<ExchangeRatesPage {...basePageProps} />);

    fireEvent.change(screen.getByLabelText("Mes y año"), {
      target: {
        value: "2026-02",
      },
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/cotizaciones?month=2026-02",
        {
          scroll: false,
        },
      );
    });
  });

  it("renders the IIBB setting as read-only for non-admin users", () => {
    renderWithProviders(
      <ExchangeRatesPage
        {...basePageProps}
        result={{
          ...basePageProps.result,
          canEditIibb: false,
        }}
      />,
    );

    expect(
      screen.queryByLabelText("IIBB en formato decimal"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Solo los admins configurados en la allowlist pueden editar este valor global.",
      ),
    ).toBeInTheDocument();
  });

  it("renders a controlled error state when the rates could not be loaded", () => {
    renderWithProviders(
      <ExchangeRatesPage
        {...basePageProps}
        result={{
          ...basePageProps.result,
          loadError: "No pudimos cargar las cotizaciones del dólar en este momento.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar las cotizaciones del dólar en este momento.",
    );
    expect(screen.getAllByText("No disponible")).toHaveLength(3);
  });
});
