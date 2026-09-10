import { vi, describe, it, expect, beforeEach } from "vitest";
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("@/modules/auth/infrastructure/next-auth/auth-options", () => ({
  authOptions: {},
}));

vi.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: vi.fn(),
}));

import { screen } from "@testing-library/react";
import { cookies } from "next/headers";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getServerSession } from "next-auth";
import { renderServerComponent } from "@/tests/render-server-component";

import RootLayout, { getRootServerSession } from "@/app/layout";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import { SIDEBAR_STATE_COOKIE_NAME } from "@/modules/shared/infrastructure/pages/sidebar-state";

const mockedCookies = vi.mocked(cookies);
const mockedGetServerSession = vi.mocked(getServerSession);
const mockedIsGoogleOAuthConfigured = vi.mocked(isGoogleOAuthConfigured);
const mockedUsePathname = vi.mocked(usePathname);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);

describe("getRootServerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without loading a session when auth is not configured", async () => {
    const getConfiguredAuthSession = vi.fn();

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
    const getConfiguredAuthSession = vi.fn().mockResolvedValue(expectedSession);

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
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
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
      push: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue({
      toString: () => "",
    } as ReturnType<typeof useSearchParams>);
  });

  it("renders providers, the global finance shell, and route children", async () => {
    await renderServerComponent(<RootLayout><h1>Route content</h1></RootLayout>);

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
