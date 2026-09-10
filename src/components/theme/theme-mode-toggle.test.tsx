import { vi, describe, it, expect, afterEach } from "vitest";
import { TooltipProvider } from "beez-ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme, type UseThemeProps } from "next-themes";

import { ThemeModeToggle } from "./theme-mode-toggle";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockedUseTheme = vi.mocked(useTheme);

function createThemeMock(
  resolvedTheme: UseThemeProps["resolvedTheme"],
  setTheme = vi.fn(),
): UseThemeProps {
  return {
    forcedTheme: undefined,
    resolvedTheme,
    setTheme,
    systemTheme: resolvedTheme === "dark" ? "dark" : "light",
    theme: resolvedTheme ?? "system",
    themes: ["light", "dark", "system"],
  };
}

function renderThemeModeToggle() {
  return render(
    <TooltipProvider>
      <ThemeModeToggle />
    </TooltipProvider>,
  );
}

describe("ThemeModeToggle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockedUseTheme.mockReset();
    document.documentElement.removeAttribute("transition-style");
  });

  it("switches from light to dark mode", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();

    mockedUseTheme.mockReturnValue(createThemeMock("light", setTheme));

    renderThemeModeToggle();

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement).toHaveAttribute(
      "transition-style",
      "in:circle:center",
    );
  });

  it("switches from dark to light mode", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();

    mockedUseTheme.mockReturnValue(createThemeMock("dark", setTheme));

    renderThemeModeToggle();

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("stays disabled until the resolved theme is available", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();
    const containsSpy = vi.spyOn(
      document.documentElement.classList,
      "contains",
    );

    mockedUseTheme.mockReturnValue(createThemeMock(undefined, setTheme));

    renderThemeModeToggle();

    const button = screen.getByRole("button", { name: "Alternar tema" });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(setTheme).not.toHaveBeenCalled();
    expect(containsSpy).not.toHaveBeenCalled();
  });

  it("shows tooltip text", async () => {
    const user = userEvent.setup();

    mockedUseTheme.mockReturnValue(createThemeMock("light"));

    renderThemeModeToggle();

    await user.hover(screen.getByRole("button", { name: "Alternar tema" }));

    expect(
      await screen.findByRole("tooltip", { name: "Cambiar a modo oscuro" }),
    ).toBeInTheDocument();
  });

  it("clears transition attribute after animation duration", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    mockedUseTheme.mockReturnValue(createThemeMock("light"));

    renderThemeModeToggle();

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));

    expect(document.documentElement).toHaveAttribute(
      "transition-style",
      "in:circle:center",
    );

    vi.advanceTimersByTime(1500);

    expect(document.documentElement).not.toHaveAttribute("transition-style");
  });
});
