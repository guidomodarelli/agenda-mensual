import { vi, describe, it, expect, afterEach } from "vitest";
import { AnimatedThemeToggler } from "beez-ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme, type UseThemeProps } from "next-themes";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockedUseTheme = vi.mocked(useTheme);

function createThemeMock(
  theme: UseThemeProps["theme"],
  setTheme = vi.fn(),
  resolvedTheme: UseThemeProps["resolvedTheme"] = theme === "light" ? "light" : "dark",
): UseThemeProps {
  return {
    forcedTheme: undefined,
    resolvedTheme,
    setTheme,
    systemTheme:
      resolvedTheme === "light" || resolvedTheme === "dark"
        ? resolvedTheme
        : undefined,
    theme,
    themes: ["light", "dark", "system"],
  };
}

describe("AnimatedThemeToggler", () => {
  afterEach(() => {
    mockedUseTheme.mockReset();
    vi.restoreAllMocks();
  });

  it("shows system as the selected theme by default", async () => {
    const user = userEvent.setup();

    mockedUseTheme.mockReturnValue(createThemeMock("system"));

    render(<AnimatedThemeToggler aria-label="Alternar tema" />);

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));

    expect(screen.getByRole("menuitemradio", { name: "Sistema" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("changes the selected theme from the menu", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();

    mockedUseTheme.mockReturnValue(createThemeMock("system", setTheme));

    render(<AnimatedThemeToggler aria-label="Alternar tema" />);

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Claro" }));

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("shows the resolved system theme icon in the trigger", () => {
    mockedUseTheme.mockReturnValue(createThemeMock("system", vi.fn(), "dark"));

    const { container } = render(
      <AnimatedThemeToggler aria-label="Alternar tema" />,
    );

    expect(container.querySelector(".lucide-moon")).toBeInTheDocument();
  });
});
