import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FinanceAppShell } from "./finance-app-shell";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseRouter = jest.mocked(useRouter);
const mockedUseSearchParams = jest.mocked(useSearchParams);
const mockedUseSession = jest.mocked(useSession);
const mockedRouterPush = jest.fn();

describe("FinanceAppShell", () => {
  beforeEach(() => {
    jest.mocked(signIn).mockReset();
    jest.mocked(signOut).mockReset();
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
    mockedUsePathname.mockReturnValue("/gastos");
    mockedRouterPush.mockReset();
    mockedUseRouter.mockReturnValue({
      push: mockedRouterPush,
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue({
      toString: () => "",
    } as ReturnType<typeof useSearchParams>);
  });

  it("renders the shadcn sidebar variant with brand, navigation, and account footer", () => {
    render(
      <TooltipProvider>
        <FinanceAppShell
          initialSidebarOpen
          isOAuthConfigured
        >
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    const sidebar = document.querySelector("[data-slot='sidebar'][data-state]");

    expect(sidebar).toHaveAttribute("data-variant", "sidebar");
    expect(screen.getByText("Control Mensual")).toBeInTheDocument();
    expect(screen.getByText("Panel de trabajo")).toBeInTheDocument();
    expect(screen.getByText("Secciones")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir menu lateral" }),
    ).toBeInTheDocument();
  });

  it("opens the account footer menu with app account actions", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <FinanceAppShell
          initialSidebarOpen
          isOAuthConfigured
        >
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cuenta activa" }));

    expect(screen.getAllByText("Admin User")).toHaveLength(2);
    expect(screen.getAllByText("admin@example.com")).toHaveLength(2);
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it("shows sign in action in the account footer menu when session is disconnected", async () => {
    const user = userEvent.setup();

    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(
      <TooltipProvider>
        <FinanceAppShell
          initialSidebarOpen
          isOAuthConfigured
        >
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cuenta activa" }));

    expect(screen.getAllByText("Incógnito")).toHaveLength(2);
    expect(screen.getAllByText("Sin cuenta")).toHaveLength(2);

    await user.click(screen.getByRole("menuitem", { name: "Iniciar sesión" }));

    expect(jest.mocked(signIn)).toHaveBeenCalledWith("google", {
      callbackUrl: "/gastos",
    });
  });

  it("starts Google sign in from the top bar account menu", async () => {
    const user = userEvent.setup();

    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Conectar cuenta de Google" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Iniciar sesión" }));

    expect(jest.mocked(signIn)).toHaveBeenCalledWith("google", {
      callbackUrl: "/gastos",
    });
  });

  it("disconnects from the top bar account menu", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Cuenta de Google conectada" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

    expect(jest.mocked(signOut)).toHaveBeenCalledWith({
      callbackUrl: "/gastos",
    });
  });

  it("derives the active navigation item from the current route", () => {
    mockedUsePathname.mockReturnValue("/cotizaciones");

    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Cotizaciones del dólar" }),
    ).toHaveAttribute("data-active", "true");
    expect(
      screen.getByRole("link", { name: "Control mensual" }),
    ).toHaveAttribute("data-active", "false");
  });

  it("uses the root path as auth callback from auth routes", async () => {
    const user = userEvent.setup();

    mockedUsePathname.mockReturnValue("/auth/signin");
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cuenta activa" }));
    await user.click(screen.getByRole("menuitem", { name: "Iniciar sesión" }));

    expect(jest.mocked(signIn)).toHaveBeenCalledWith("google", {
      callbackUrl: "/",
    });
  });

  it("opens the sign in page with callback when OAuth is not configured in the shell", async () => {
    const user = userEvent.setup();

    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured={false}>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cuenta activa" }));
    await user.click(screen.getByRole("menuitem", { name: "Iniciar sesión" }));

    expect(jest.mocked(signIn)).not.toHaveBeenCalled();
    expect(mockedRouterPush).toHaveBeenCalledWith(
      "/auth/signin?callbackUrl=%2Fgastos",
    );
  });
});
