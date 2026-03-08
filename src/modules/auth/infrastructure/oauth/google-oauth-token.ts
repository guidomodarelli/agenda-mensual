import type { Account } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";

import { getGoogleOAuthServerConfig } from "./google-oauth-config";

const GOOGLE_ACCESS_TOKEN_EXPIRY_BUFFER_IN_SECONDS = 60;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const googleTokenRefreshResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().trim().min(1).optional(),
  scope: z.string().trim().min(1).optional(),
  token_type: z.string().trim().min(1).optional(),
});

type FetchImplementation = typeof fetch;

export interface GoogleSessionToken extends JWT {
  googleAccessToken?: string;
  googleAccessTokenExpiresAt?: number;
  googleRefreshToken?: string;
  googleScope?: string;
  googleTokenError?: "RefreshGoogleAccessTokenError";
  googleTokenType?: string;
}

class GoogleOAuthError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class GoogleOAuthAuthenticationError extends GoogleOAuthError {}

export class GoogleOAuthConfigurationError extends GoogleOAuthError {}

export class GoogleOAuthTokenRefreshError extends GoogleOAuthError {}

function getUnixTimestamp(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

export function buildGoogleSessionToken({
  account,
  token,
}: {
  account: Account;
  token: JWT;
}): GoogleSessionToken {
  const googleSessionToken = token as GoogleSessionToken;

  if (account.provider !== "google") {
    return googleSessionToken;
  }

  if (
    !account.access_token ||
    !account.expires_at ||
    !account.scope ||
    !account.token_type
  ) {
    throw new GoogleOAuthAuthenticationError(
      "google-oauth-token:buildGoogleSessionToken could not persist the Google OAuth payload because access_token, expires_at, scope, or token_type is missing.",
    );
  }

  googleSessionToken.googleAccessToken = account.access_token;
  googleSessionToken.googleAccessTokenExpiresAt = account.expires_at;
  googleSessionToken.googleRefreshToken =
    account.refresh_token ?? googleSessionToken.googleRefreshToken;
  googleSessionToken.googleScope = account.scope;
  googleSessionToken.googleTokenType = account.token_type;
  delete googleSessionToken.googleTokenError;

  return googleSessionToken;
}

export function hasExpiredGoogleAccessToken(
  token: Pick<GoogleSessionToken, "googleAccessTokenExpiresAt">,
  now = new Date(),
): boolean {
  if (!token.googleAccessTokenExpiresAt) {
    return true;
  }

  return (
    token.googleAccessTokenExpiresAt <=
    getUnixTimestamp(now) + GOOGLE_ACCESS_TOKEN_EXPIRY_BUFFER_IN_SECONDS
  );
}

export async function refreshGoogleSessionToken(
  token: GoogleSessionToken,
  fetchImplementation: FetchImplementation = fetch,
  now = new Date(),
): Promise<GoogleSessionToken> {
  const googleOAuthServerConfig = getGoogleOAuthServerConfig();

  if (!googleOAuthServerConfig) {
    throw new GoogleOAuthConfigurationError(
      "google-oauth-token:refreshGoogleSessionToken requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL server configuration.",
    );
  }

  if (!token.googleRefreshToken) {
    throw new GoogleOAuthAuthenticationError(
      "google-oauth-token:refreshGoogleSessionToken requires a Google refresh token. Sign in with Google again.",
    );
  }

  const response = await fetchImplementation(GOOGLE_TOKEN_ENDPOINT, {
    body: new URLSearchParams({
      client_id: googleOAuthServerConfig.clientId,
      client_secret: googleOAuthServerConfig.clientSecret,
      grant_type: "refresh_token",
      refresh_token: token.googleRefreshToken,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const responseText =
      typeof response.text === "function" ? await response.text() : "";

    throw new GoogleOAuthTokenRefreshError(
      `google-oauth-token:refreshGoogleSessionToken received ${response.status} from ${GOOGLE_TOKEN_ENDPOINT}. ${responseText}`.trim(),
    );
  }

  const parsedPayload = googleTokenRefreshResponseSchema.parse(
    await response.json(),
  );

  return {
    ...token,
    googleAccessToken: parsedPayload.access_token,
    googleAccessTokenExpiresAt:
      getUnixTimestamp(now) + parsedPayload.expires_in,
    googleRefreshToken: parsedPayload.refresh_token ?? token.googleRefreshToken,
    googleScope: parsedPayload.scope ?? token.googleScope,
    googleTokenType: parsedPayload.token_type ?? token.googleTokenType,
    googleTokenError: undefined,
  };
}
