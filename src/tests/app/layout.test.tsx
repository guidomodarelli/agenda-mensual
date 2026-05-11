jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/modules/auth/infrastructure/next-auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: jest.fn(),
}));

import { render, screen } from "@testing-library/react";
import { cookies } from "next/headers";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactElement, ReactNode } from "react";

import RootLayout, { getRootServerSession } from "@/app/layout";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import { SIDEBAR_STATE_COOKIE_NAME } from "@/modules/shared/infrastructure/pages/sidebar-state";

const mockedCookies = jest.mocked(cookies);
const mockedGetServerSession = jest.mocked(getServerSession);
const mockedIsGoogleOAuthConfigured = jest.mocked(isGoogleOAuthConfigured);
const mockedUsePathname = jest.mocked(usePathname);
const mockedUseRouter = jest.mocked(useRouter);
const mockedUseSearchParams = jest.mocked(useSearchParams);

describe("getRootServerSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null without loading a session when auth is not configured", async () => {
    const getConfiguredAuthSession = jest.fn();

    const session = await getRootServerSession({
      getConfiguredAuthSession,
      isAuthConfigured: () => false,
    });

    expect(session).toBeNull();
    expect(getConfiguredAuthSession).not.toHaveBeenCalled();
  });

  it("loads the configured session when auth is configured", async () => {
    const expectedSession = {
      expires: "2026-12-31T00:00:00.000Z",
      user: {
        email: "user@example.com",
      },
    };
    const getConfiguredAuthSession = jest.fn().mockResolvedValue(expectedSession);

    const session = await getRootServerSession({
      getConfiguredAuthSession,
      isAuthConfigured: () => true,
    });

    expect(session).toBe(expectedSession);
    expect(getConfiguredAuthSession).toHaveBeenCalledTimes(1);
  });
});

describe("RootLayout", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        addEventListener: jest.fn(),
        addListener: jest.fn(),
        dispatchEvent: jest.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    });
    mockedCookies.mockResolvedValue({
      get: (cookieName: string) =>
        cookieName === SIDEBAR_STATE_COOKIE_NAME
          ? {
              value: "false",
            }
          : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    mockedGetServerSession.mockResolvedValue({
      expires: "2026-12-31T00:00:00.000Z",
      user: {
        email: "user@example.com",
        name: "Test User",
      },
    });
    mockedIsGoogleOAuthConfigured.mockReturnValue(true);
    mockedUsePathname.mockReturnValue("/gastos");
    mockedUseRouter.mockReturnValue({
      push: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue({
      toString: () => "",
    } as ReturnType<typeof useSearchParams>);
  });

  it("renders providers, the global finance shell, and route children", async () => {
    const rootLayoutElement = await RootLayout({
      children: <h1>Route content</h1>,
    });
    const bodyElement = (
      rootLayoutElement as ReactElement<{
        children: ReactElement<{ children: ReactNode }>;
      }>
    ).props.children;

    render(<>{bodyElement.props.children}</>);

    expect(screen.getByText("Control Mensual")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir menu lateral" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Route content" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='sidebar']")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
  });
});
