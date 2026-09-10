import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
describe("authOptions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      NEXTAUTH_SECRET: "next-auth-secret",
      NEXTAUTH_URL: "http://localhost:3000",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("upserts registration traceability for Google sign-in", async () => {
    const upsertRegistrationTraceMock = vi.fn().mockResolvedValue(undefined);
    const getRegistrationTraceByUserSubjectMock = vi.fn();

    await (vi.resetModules(), (async () => {
      vi.doMock("../turso/repositories/drizzle-user-registration-traces-repository", () => ({
        DrizzleUserRegistrationTracesRepository: vi.fn().mockImplementation(function () { return ({
          getRegistrationTraceByUserSubject: getRegistrationTraceByUserSubjectMock,
          upsertRegistrationTrace: upsertRegistrationTraceMock,
        }); }),
      }));
      vi.doMock("@/modules/shared/infrastructure/database/drizzle/turso-database", () => ({
        createMigratedTursoDatabase: vi.fn().mockResolvedValue({}),
      }));

      const { authOptions } = await import("./auth-options");

      const result = await authOptions.callbacks?.jwt?.({
        account: {
          access_token: "google-access-token",
          expires_at: 1_772_000_000,
          provider: "google",
          scope: "openid email profile",
          token_type: "Bearer",
        } as never,
        token: {
          email: "PERSON@EXAMPLE.COM",
          sub: "google-user-123",
        },
        user: {
          email: "PERSON@EXAMPLE.COM",
        } as never,
      });

      expect(upsertRegistrationTraceMock).toHaveBeenCalledWith({
        authProvider: "google",
        nowIso: expect.any(String),
        registrationEmail: "person@example.com",
        userSubject: "google-user-123",
      });
      expect(result).toEqual(
        expect.objectContaining({
          registrationTraceVerifiedAtIso: expect.any(String),
          sub: "google-user-123",
        }),
      );
    })());
  });

  it("invalidates a legacy session when no traceability record exists", async () => {
    const getRegistrationTraceByUserSubjectMock = vi.fn().mockResolvedValue(null);
    const upsertRegistrationTraceMock = vi.fn();

    await (vi.resetModules(), (async () => {
      vi.doMock("../turso/repositories/drizzle-user-registration-traces-repository", () => ({
        DrizzleUserRegistrationTracesRepository: vi.fn().mockImplementation(function () { return ({
          getRegistrationTraceByUserSubject: getRegistrationTraceByUserSubjectMock,
          upsertRegistrationTrace: upsertRegistrationTraceMock,
        }); }),
      }));
      vi.doMock("@/modules/shared/infrastructure/database/drizzle/turso-database", () => ({
        createMigratedTursoDatabase: vi.fn().mockResolvedValue({}),
      }));
      vi.doMock("../oauth/google-oauth-token", async () => {
        const actual = await vi.importActual<typeof import("../oauth/google-oauth-token")>("../oauth/google-oauth-token");

        return {
          ...actual,
          hasExpiredGoogleAccessToken: vi.fn(() => false),
        };
      });

      const { authOptions } = await import("./auth-options");

      const result = await authOptions.callbacks?.jwt?.({
        account: null,
        token: {
          email: "person@example.com",
          googleAccessToken: "active-access-token",
          googleAccessTokenExpiresAt: 2_772_000_000,
          sub: "google-user-123",
        },
        user: {
          id: "google-user-123",
        } as never,
      });

      expect(getRegistrationTraceByUserSubjectMock).toHaveBeenCalledWith(
        "google-user-123",
      );
      expect(result).toEqual(
        expect.objectContaining({
          authError: "MissingRegistrationTrace",
          email: undefined,
          sub: undefined,
        }),
      );
      expect(upsertRegistrationTraceMock).not.toHaveBeenCalled();
    })());
  });

  it("keeps legacy session valid when traceability record exists", async () => {
    const getRegistrationTraceByUserSubjectMock = vi.fn().mockResolvedValue({
      authProvider: "google",
      lastVerifiedAtIso: "2026-04-27T10:00:00.000Z",
      registeredAtIso: "2026-04-20T10:00:00.000Z",
      registrationEmail: "person@example.com",
      userSubject: "google-user-123",
    });

    await (vi.resetModules(), (async () => {
      vi.doMock("../turso/repositories/drizzle-user-registration-traces-repository", () => ({
        DrizzleUserRegistrationTracesRepository: vi.fn().mockImplementation(function () { return ({
          getRegistrationTraceByUserSubject: getRegistrationTraceByUserSubjectMock,
          upsertRegistrationTrace: vi.fn(),
        }); }),
      }));
      vi.doMock("@/modules/shared/infrastructure/database/drizzle/turso-database", () => ({
        createMigratedTursoDatabase: vi.fn().mockResolvedValue({}),
      }));
      vi.doMock("../oauth/google-oauth-token", async () => {
        const actual = await vi.importActual<typeof import("../oauth/google-oauth-token")>("../oauth/google-oauth-token");

        return {
          ...actual,
          hasExpiredGoogleAccessToken: vi.fn(() => false),
        };
      });

      const { authOptions } = await import("./auth-options");

      const result = await authOptions.callbacks?.jwt?.({
        account: null,
        token: {
          email: "person@example.com",
          googleAccessToken: "active-access-token",
          googleAccessTokenExpiresAt: 2_772_000_000,
          sub: "google-user-123",
        },
        user: {
          id: "google-user-123",
        } as never,
      });

      expect(result).toEqual(
        expect.objectContaining({
          authError: undefined,
          registrationTraceVerifiedAtIso: expect.any(String),
          sub: "google-user-123",
        }),
      );
    })());
  });

  it("logs when Google token refresh fails in the jwt callback", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(function () { return undefined; });
    const getRegistrationTraceByUserSubjectMock = vi.fn().mockResolvedValue({
      authProvider: "google",
      lastVerifiedAtIso: "2026-04-27T10:00:00.000Z",
      registeredAtIso: "2026-04-20T10:00:00.000Z",
      registrationEmail: "person@example.com",
      userSubject: "google-user-123",
    });

    await (vi.resetModules(), (async () => {
      vi.doMock("../turso/repositories/drizzle-user-registration-traces-repository", () => ({
        DrizzleUserRegistrationTracesRepository: vi.fn().mockImplementation(function () { return ({
          getRegistrationTraceByUserSubject: getRegistrationTraceByUserSubjectMock,
          upsertRegistrationTrace: vi.fn(),
        }); }),
      }));
      vi.doMock("@/modules/shared/infrastructure/database/drizzle/turso-database", () => ({
        createMigratedTursoDatabase: vi.fn().mockResolvedValue({}),
      }));
      vi.doMock("../oauth/google-oauth-token", async () => {
        const actual = await vi.importActual<typeof import("../oauth/google-oauth-token")>("../oauth/google-oauth-token");

        return {
          ...actual,
          hasExpiredGoogleAccessToken: vi.fn(() => true),
          refreshGoogleSessionToken: vi.fn().mockRejectedValue(
            new Error("refresh failed"),
          ),
        };
      });

      const { authOptions } = await import("./auth-options");

      const result = await authOptions.callbacks?.jwt?.({
        account: null,
        token: {
          googleAccessToken: "expired-access-token",
          googleAccessTokenExpiresAt: 1,
          googleRefreshToken: "refresh-token",
          sub: "google-user-123",
        },
        user: {
          id: "google-user-123",
        } as never,
      });

      expect(result).toEqual(
        expect.objectContaining({
          googleTokenError: "RefreshGoogleAccessTokenError",
        }),
      );
      expect(errorSpy).toHaveBeenCalled();
    })());
  });

  it("downgrades invalid JWT session cookies to warning logs", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(function () { return undefined; });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(function () { return undefined; });

    warnSpy.mockClear();
    errorSpy.mockClear();

    await (vi.resetModules(), (async () => {
      const { authOptions } = await import("./auth-options");

      authOptions.logger?.error?.("JWT_SESSION_ERROR", {
        error: new Error("decryption operation failed"),
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    })());
  });

  it("keeps non-recoverable JWT session errors as error logs", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(function () { return undefined; });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(function () { return undefined; });

    warnSpy.mockClear();
    errorSpy.mockClear();

    await (vi.resetModules(), (async () => {
      const { authOptions } = await import("./auth-options");

      authOptions.logger?.error?.("JWT_SESSION_ERROR", {
        error: new Error("Turso registration trace lookup failed"),
      });

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    })());
  });
});
