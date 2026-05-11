import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { DrizzleUserRegistrationTracesRepository } from "../turso/repositories/drizzle-user-registration-traces-repository";
import { getGoogleOAuthServerConfig } from "../oauth/google-oauth-config";
import {
  buildGoogleSessionToken,
  hasExpiredGoogleAccessToken,
  refreshGoogleSessionToken,
  type GoogleSessionToken,
} from "../oauth/google-oauth-token";
import { createMigratedTursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";
import { appLogger } from "@/modules/shared/infrastructure/observability/app-logger";

const googleOAuthServerConfig = getGoogleOAuthServerConfig();
const MISSING_REGISTRATION_TRACE_ERROR = "MissingRegistrationTrace";
const JWT_SESSION_ERROR_CODE = "JWT_SESSION_ERROR";
const RECOVERABLE_JWT_ERROR_CODES = new Set([
  "ERR_JWE_DECRYPTION_FAILED",
  "ERR_JWE_INVALID",
  "ERR_JWT_INVALID",
]);
const RECOVERABLE_JWT_ERROR_MESSAGES = new Set([
  "JWT invalid",
  "decryption operation failed",
]);

const googleProvider = googleOAuthServerConfig
  ? GoogleProvider({
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
          scope: googleOAuthServerConfig.scopeString,
        },
      },
      clientId: googleOAuthServerConfig.clientId,
      clientSecret: googleOAuthServerConfig.clientSecret,
    })
  : null;

type AuthSessionToken = GoogleSessionToken & {
  authError?: typeof MISSING_REGISTRATION_TRACE_ERROR;
  email?: string | null;
  registrationTraceVerifiedAtIso?: string;
  sub?: string;
};

type JwtCallbackParameters = {
  account?: {
    provider?: string;
  } | null;
  token: AuthSessionToken;
  user?: {
    email?: string | null;
  } | null;
};

function normalizeRegistrationEmail(email: string | null | undefined): string | null {
  const normalizedEmail = email?.trim().toLowerCase();

  return normalizedEmail ? normalizedEmail : null;
}

function invalidateSessionToken(token: AuthSessionToken): AuthSessionToken {
  return {
    ...token,
    authError: MISSING_REGISTRATION_TRACE_ERROR,
    email: undefined,
    registrationTraceVerifiedAtIso: undefined,
    sub: undefined,
  };
}

function getMetadataError(metadata: unknown): unknown {
  if (metadata && typeof metadata === "object" && "error" in metadata) {
    return (metadata as { error?: unknown }).error;
  }

  return metadata;
}

function getErrorProperty(error: unknown, propertyName: string): unknown {
  if (!error || typeof error !== "object" || !(propertyName in error)) {
    return undefined;
  }

  return (error as Record<string, unknown>)[propertyName];
}

function isRecoverableJwtSessionError(metadata: unknown): boolean {
  const error = getMetadataError(metadata);
  const errorCode = getErrorProperty(error, "code");
  const errorMessage =
    error instanceof Error ? error.message : getErrorProperty(error, "message");

  if (
    typeof errorCode === "string" &&
    RECOVERABLE_JWT_ERROR_CODES.has(errorCode)
  ) {
    return true;
  }

  return (
    typeof errorMessage === "string" &&
    RECOVERABLE_JWT_ERROR_MESSAGES.has(errorMessage)
  );
}

async function createRegistrationTracesRepository() {
  const database = await createMigratedTursoDatabase();

  return new DrizzleUserRegistrationTracesRepository(database);
}

async function verifyLegacySessionRegistrationTrace(
  token: AuthSessionToken,
): Promise<AuthSessionToken> {
  if (token.registrationTraceVerifiedAtIso) {
    return token;
  }

  const userSubject = token.sub?.trim();

  if (!userSubject) {
    return token;
  }

  const traceabilityRepository = await createRegistrationTracesRepository();
  const registrationTrace =
    await traceabilityRepository.getRegistrationTraceByUserSubject(userSubject);

  if (!registrationTrace) {
    return invalidateSessionToken(token);
  }

  return {
    ...token,
    authError: undefined,
    registrationTraceVerifiedAtIso: new Date().toISOString(),
  };
}

async function registerGoogleSignInTrace({
  account,
  token,
  user,
}: JwtCallbackParameters): Promise<AuthSessionToken> {
  const googleSessionToken = buildGoogleSessionToken({
    account: account as Parameters<typeof buildGoogleSessionToken>[0]["account"],
    token,
  }) as AuthSessionToken;
  const userSubject = googleSessionToken.sub?.trim();
  const registrationEmail = normalizeRegistrationEmail(
    user?.email ?? googleSessionToken.email,
  );

  if (!userSubject || !registrationEmail) {
    return invalidateSessionToken(googleSessionToken);
  }

  const nowIso = new Date().toISOString();
  const traceabilityRepository = await createRegistrationTracesRepository();

  await traceabilityRepository.upsertRegistrationTrace({
    authProvider: "google",
    nowIso,
    registrationEmail,
    userSubject,
  });

  return {
    ...googleSessionToken,
    authError: undefined,
    email: registrationEmail,
    registrationTraceVerifiedAtIso: nowIso,
  };
}

export const authOptions: NextAuthOptions = {
  callbacks: {
    async jwt(parameters) {
      const { account, token } = parameters as JwtCallbackParameters;

      if (account?.provider === "google") {
        return registerGoogleSignInTrace(parameters as JwtCallbackParameters);
      }

      const googleSessionToken = await verifyLegacySessionRegistrationTrace(
        token as AuthSessionToken,
      );

      if (
        !googleSessionToken.googleAccessToken ||
        !googleSessionToken.googleAccessTokenExpiresAt
      ) {
        return googleSessionToken;
      }

      if (!hasExpiredGoogleAccessToken(googleSessionToken)) {
        return googleSessionToken;
      }

      try {
        return await refreshGoogleSessionToken(googleSessionToken);
      } catch (error) {
        appLogger.error("next-auth failed to refresh Google access token", {
          context: {
            operation: "next-auth:jwt:refresh-google-session-token",
          },
          error,
        });

        return {
          ...googleSessionToken,
          googleTokenError: "RefreshGoogleAccessTokenError",
        };
      }
    },
  },
  logger: {
    error(code, metadata) {
      const logContext = {
        code,
        operation: "next-auth:logger:error",
      };

      if (code === JWT_SESSION_ERROR_CODE && isRecoverableJwtSessionError(metadata)) {
        appLogger.warn("next-auth received an invalid JWT session cookie", {
          context: logContext,
          error: metadata,
        });
        return;
      }

      appLogger.error("next-auth emitted an error", {
        context: logContext,
        error: metadata,
      });
    },
    warn(code) {
      appLogger.warn("next-auth emitted a warning", {
        context: {
          code,
          operation: "next-auth:logger:warn",
        },
      });
    },
  },
  pages: {
    error: "/auth/error",
    signIn: "/auth/signin",
  },
  providers: googleProvider ? [googleProvider] : [],
  secret: googleOAuthServerConfig?.nextAuthSecret,
  session: {
    strategy: "jwt",
  },
};
