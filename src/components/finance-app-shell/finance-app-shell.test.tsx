import { vi, describe, it, expect, beforeEach } from "vitest";
import { TooltipProvider } from "beez-ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

import { FinanceAppShell } from "./finance-app-shell";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
const mockedUseSession = vi.mocked(useSession);
const mockedRouterPush = vi.fn();

describe("FinanceAppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(signIn).mockReset();
    vi.mocked(signOut).mockReset();
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
      update: vi.fn(),
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

  it("renders the shared sidebar variant with brand, navigation, and account footer", () => {
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

  it("should restore the collapsed sidebar when the existing preference is saved", async () => {
    window.localStorage.setItem("control-mensual.sidebar.open", "false");
    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await waitFor(() => expect(document.querySelector("[data-slot='sidebar'][data-state]"))
      .toHaveAttribute("data-state", "collapsed"));
  });

  it("should persist the SSR cookie and local preference when the sidebar is toggled", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <FinanceAppShell initialSidebarOpen isOAuthConfigured>
          <h1>Page content</h1>
        </FinanceAppShell>
      </TooltipProvider>,
    );

    await user.keyboard("{Control>}b{/Control}");

    expect(window.localStorage.getItem("control-mensual.sidebar.open")).toBe("false");
    expect(document.cookie).toContain("control-mensual.sidebar.open=false");
    expect(document.querySelector("[data-slot='sidebar'][data-state]"))
      .toHaveAttribute("data-state", "collapsed");
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
      update: vi.fn(),
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

    expect(vi.mocked(signIn)).toHaveBeenCalledWith("google", {
      callbackUrl: "/gastos",
    });
  });

  it("starts Google sign in from the top bar account menu", async () => {
    const user = userEvent.setup();

    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
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

    expect(vi.mocked(signIn)).toHaveBeenCalledWith("google", {
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

    expect(vi.mocked(signOut)).toHaveBeenCalledWith({
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

  it("closes the mobile sidebar sheet when selecting a section", async () => {
    const user = userEvent.setup();
    const originalInnerWidth = window.innerWidth;
    const originalMatchMedia = window.matchMedia;

    // Viewport mobile para useIsMobile (innerWidth < 768 + matchMedia).
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 400,
      writable: true,
    });
    window.matchMedia = vi.fn().mockImplementation(function (query: string) { return ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }); }) as unknown as typeof window.matchMedia;

    try {
      render(
        <TooltipProvider>
          <FinanceAppShell initialSidebarOpen isOAuthConfigured>
            <h1>Page content</h1>
          </FinanceAppShell>
        </TooltipProvider>,
      );

      await user.click(
        screen.getByRole("button", { name: "Abrir menu lateral" }),
      );

      const mobileSidebarSheet = await screen.findByRole("dialog");
      await user.click(
        within(mobileSidebarSheet).getByRole("link", {
          name: "Cotizaciones del dólar",
        }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
        writable: true,
      });
      window.matchMedia = originalMatchMedia;
    }
  });

  it("uses the root path as auth callback from auth routes", async () => {
    const user = userEvent.setup();

    mockedUsePathname.mockReturnValue("/auth/signin");
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
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

    expect(vi.mocked(signIn)).toHaveBeenCalledWith("google", {
      callbackUrl: "/",
    });
  });

  it("opens the sign in page with callback when OAuth is not configured in the shell", async () => {
    const user = userEvent.setup();

    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
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

    expect(vi.mocked(signIn)).not.toHaveBeenCalled();
    expect(mockedRouterPush).toHaveBeenCalledWith(
      "/auth/signin?callbackUrl=%2Fgastos",
    );
  });
});
