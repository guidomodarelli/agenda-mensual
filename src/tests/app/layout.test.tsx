jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/modules/auth/infrastructure/next-auth/auth-options", () => ({
  authOptions: {},
}));

import { getRootServerSession } from "@/app/layout";

describe("getRootServerSession", () => {
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
