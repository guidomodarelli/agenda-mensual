import type { Account } from "next-auth";

import {
  buildGoogleSessionToken,
  hasExpiredGoogleAccessToken,
  refreshGoogleSessionToken,
  type GoogleSessionToken,
} from "./google-oauth-token";

const ORIGINAL_ENV = process.env;

describe("google-oauth-token", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      NEXTAUTH_SECRET: "next-auth-secret",
      NEXTAUTH_URL: "http://localhost:3000",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("builds a Google session token from the OAuth account payload", () => {
    const result = buildGoogleSessionToken({
      account: {
        access_token: "google-access-token",
        expires_at: 1_772_000_000,
        provider: "google",
        refresh_token: "google-refresh-token",
        scope:
          "openid email profile https://www.googleapis.com/auth/drive.file",
        token_type: "Bearer",
        type: "oauth",
      } as Account,
      token: {},
    });

    expect(result).toMatchObject({
      googleAccessToken: "google-access-token",
      googleAccessTokenExpiresAt: 1_772_000_000,
      googleRefreshToken: "google-refresh-token",
      googleScope:
        "openid email profile https://www.googleapis.com/auth/drive.file",
      googleTokenType: "Bearer",
    });
  });

  it("refreshes an expired Google access token and keeps the current refresh token", async () => {
    const expiredToken: GoogleSessionToken = {
      googleAccessToken: "expired-access-token",
      googleAccessTokenExpiresAt: 1_700_000_000,
      googleRefreshToken: "stable-refresh-token",
      googleScope:
        "openid email profile https://www.googleapis.com/auth/drive.appdata",
      googleTokenType: "Bearer",
    };

    const fetchImplementation = jest.fn().mockResolvedValue({
      json: async () => ({
        access_token: "fresh-access-token",
        expires_in: 3600,
        scope:
          "openid email profile https://www.googleapis.com/auth/drive.appdata",
        token_type: "Bearer",
      }),
      ok: true,
      status: 200,
    });

    const result = await refreshGoogleSessionToken(
      expiredToken,
      fetchImplementation,
      new Date("2026-03-08T12:00:00.000Z"),
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        body: expect.any(URLSearchParams),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    );
    expect(result).toMatchObject({
      googleAccessToken: "fresh-access-token",
      googleRefreshToken: "stable-refresh-token",
      googleScope:
        "openid email profile https://www.googleapis.com/auth/drive.appdata",
      googleTokenType: "Bearer",
    });
    expect(result.googleAccessTokenExpiresAt).toBe(1_772_974_800);
  });

  it("treats tokens expiring within the safety window as expired", () => {
    const result = hasExpiredGoogleAccessToken(
      {
        googleAccessTokenExpiresAt: 100,
      },
      new Date("1970-01-01T00:00:41.000Z"),
    );

    expect(result).toBe(true);
  });
});
