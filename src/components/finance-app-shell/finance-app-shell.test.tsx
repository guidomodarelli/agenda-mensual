import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn, signOut, useSession } from "next-auth/react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { FinanceAppShell } from "./finance-app-shell";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(),
}));

const mockedUseSession = jest.mocked(useSession);

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
  });

  it("renders the shadcn sidebar variant with brand, navigation, and account footer", () => {
    render(
      <TooltipProvider>
        <FinanceAppShell
          activeSection="expenses"
          authRedirectPath="/gastos"
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
      screen.getByRole("button", { name: "Toggle Sidebar" }),
    ).toBeInTheDocument();
  });

  it("opens the account footer menu with app account actions", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <FinanceAppShell
          activeSection="expenses"
          authRedirectPath="/gastos"
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
});
