import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getProviders } from "next-auth/react";

import SignInPage from "@/app/auth/signin/page";
import { SignInPageClient } from "@/app/auth/signin/signin-page-client";

jest.mock("next/navigation", () => ({
  redirect: jest.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  getProviders: jest.fn(),
}));

jest.mock("@/modules/auth/infrastructure/next-auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/app/auth/signin/signin-page-client", () => ({
  SignInPageClient: jest.fn(() => null),
}));

const mockedGetProviders = jest.mocked(getProviders);
const mockedGetServerSession = jest.mocked(getServerSession);
const mockedRedirect = jest.mocked(redirect);
const mockedSignInPageClient = jest.mocked(SignInPageClient);

describe("SignInPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(mockedGetProviders).not.toHaveBeenCalled();
  });

  it("renders a controlled provider error when the server session cannot be loaded", async () => {
    mockedGetServerSession.mockRejectedValue(new Error("Session lookup failed."));

    const signInPageElement = await SignInPage();

    expect(signInPageElement.props).toEqual({
      hasProviderError: true,
      providers: {},
    });
    expect(mockedSignInPageClient).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedGetProviders).not.toHaveBeenCalled();
  });
});
