import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { ThemedToaster as Toaster } from "beez-ui";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { useTheme } from "next-themes";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockedUseTheme = vi.mocked(useTheme);
const mockedSonner: Mock<(...args: [unknown]) => ReactElement> = vi.fn(
  (...args: [unknown]) => {
    void args;

    return <div data-testid="sonner" />;
  },
);

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => mockedSonner(props),
}));

describe("Toaster", () => {
  beforeEach(() => {
    mockedSonner.mockClear();
  });

  it("uses resolved dark theme when available", () => {
    mockedUseTheme.mockReturnValue({
      forcedTheme: undefined,
      resolvedTheme: "dark",
      setTheme: vi.fn(),
      systemTheme: "dark",
      theme: "system",
      themes: ["light", "dark"],
    });

    render(<Toaster />);

    expect(screen.getByTestId("sonner")).toBeInTheDocument();
    expect(mockedSonner).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" }),
    );
  });

  it("falls back to light when theme values are not resolved", () => {
    mockedUseTheme.mockReturnValue({
      forcedTheme: undefined,
      resolvedTheme: undefined,
      setTheme: vi.fn(),
      systemTheme: undefined,
      theme: "system",
      themes: ["light", "dark"],
    });

    render(<Toaster />);

    expect(screen.getByTestId("sonner")).toBeInTheDocument();
    expect(mockedSonner).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "light" }),
    );
  });
});
