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
const RECOVERABLE_JWT_SESSION_ERROR = "JWT_SESSION_ERROR";

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

      if (code === RECOVERABLE_JWT_SESSION_ERROR) {
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
