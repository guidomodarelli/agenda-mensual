import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SignInPage from "@/app/auth/signin/page";
import { SignInPageClient } from "@/app/auth/signin/signin-page-client";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/modules/auth/infrastructure/next-auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: jest.fn(),
}));

jest.mock("@/app/auth/signin/signin-page-client", () => ({
  SignInPageClient: jest.fn(() => null),
}));

const mockedGetServerSession = jest.mocked(getServerSession);
const mockedRedirect = jest.mocked(redirect);
const mockedSignInPageClient = jest.mocked(SignInPageClient);
const mockedIsGoogleOAuthConfigured = jest.mocked(isGoogleOAuthConfigured);

describe("SignInPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsGoogleOAuthConfigured.mockReturnValue(false);
  });

  it("redirects authenticated users before loading providers", async () => {
    mockedGetServerSession.mockResolvedValue({
      expires: "2026-12-31T00:00:00.000Z",
      user: {
        email: "user@example.com",
      },
    });

    await expect(SignInPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("keeps Google provider available when the server session cannot be loaded", async () => {
    mockedGetServerSession.mockRejectedValue(new Error("Session lookup failed."));
    mockedIsGoogleOAuthConfigured.mockReturnValue(true);

    const signInPageElement = await SignInPage();

    expect(signInPageElement.props).toEqual({
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
    });
    expect(mockedSignInPageClient).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("renders no provider when Google OAuth is not configured", async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const signInPageElement = await SignInPage();

    expect(signInPageElement.props).toEqual({
      hasProviderError: false,
      providers: {},
    });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
