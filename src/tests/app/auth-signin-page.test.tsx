import { vi, describe, it, expect, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SignInPage from "@/app/auth/signin/page";
import { SignInPageClient } from "@/app/auth/signin/signin-page-client";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import { renderServerComponent } from "@/tests/render-server-component";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/infrastructure/next-auth/auth-options", () => ({
  authOptions: {},
}));

vi.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: vi.fn(),
}));

vi.mock("@/app/auth/signin/signin-page-client", () => ({
  SignInPageClient: vi.fn(function () { return null; }),
}));

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedRedirect = vi.mocked(redirect);
const mockedSignInPageClient = vi.mocked(SignInPageClient);
const mockedIsGoogleOAuthConfigured = vi.mocked(isGoogleOAuthConfigured);

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsGoogleOAuthConfigured.mockReturnValue(false);
  });

  it("redirects authenticated users before loading providers", async () => {
    mockedGetServerSession.mockResolvedValue({
      expires: "2026-12-31T00:00:00.000Z",
      user: {
        email: "user@example.com",
      },
    });

    await expect(renderServerComponent(<SignInPage />)).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("keeps Google provider available when the server session cannot be loaded", async () => {
    mockedGetServerSession.mockRejectedValue(new Error("Session lookup failed."));
    mockedIsGoogleOAuthConfigured.mockReturnValue(true);

    await renderServerComponent(<SignInPage />);

    expect(mockedSignInPageClient).toHaveBeenCalledWith({
      hasProviderError: false,
      providers: {
        google: {
          callbackUrl: "/api/auth/callback/google",
          id: "google",
          name: "Google",
          signinUrl: "/api/auth/signin/google",
          type: "oauth",
        },
      },
    }, undefined);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("renders no provider when Google OAuth is not configured", async () => {
    mockedGetServerSession.mockResolvedValue(null);

    await renderServerComponent(<SignInPage />);

    expect(mockedSignInPageClient).toHaveBeenCalledWith({
      hasProviderError: false,
      providers: {},
    }, undefined);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
