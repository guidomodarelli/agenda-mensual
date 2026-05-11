import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getProviders } from "next-auth/react";

import SignInPage from "./page";

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

jest.mock("./signin-page-client", () => ({
  SignInPageClient: jest.fn(() => null),
}));

const mockedGetProviders = jest.mocked(getProviders);
const mockedGetServerSession = jest.mocked(getServerSession);
const mockedRedirect = jest.mocked(redirect);

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
});
