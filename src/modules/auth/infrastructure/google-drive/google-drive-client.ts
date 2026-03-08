import type { GetServerSidePropsContext, NextApiRequest } from "next";
import type { drive_v3 } from "googleapis";
import { google } from "googleapis";
import { getToken } from "next-auth/jwt";

import { getGoogleOAuthServerConfig } from "../oauth/google-oauth-config";
import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
  hasExpiredGoogleAccessToken,
  refreshGoogleSessionToken,
  type GoogleSessionToken,
} from "../oauth/google-oauth-token";

type ServerAuthRequest = GetServerSidePropsContext["req"] | NextApiRequest;
type GetJwtImplementation = typeof getToken;
type AuthenticatedGoogleSessionToken = GoogleSessionToken & {
  googleAccessToken: string;
  googleAccessTokenExpiresAt: number;
  googleRefreshToken: string;
};

function assertGoogleSessionToken(
  token: GoogleSessionToken | null,
): AuthenticatedGoogleSessionToken {
  if (!token) {
    throw new GoogleOAuthAuthenticationError(
      "google-drive-client:getGoogleSessionTokenFromRequest requires an authenticated NextAuth session.",
    );
  }

  if (!token.googleAccessToken || !token.googleAccessTokenExpiresAt) {
    throw new GoogleOAuthAuthenticationError(
      "google-drive-client:getGoogleSessionTokenFromRequest found a NextAuth session without Google access token metadata. Sign in with Google again.",
    );
  }

  if (!token.googleRefreshToken) {
    throw new GoogleOAuthAuthenticationError(
      "google-drive-client:getGoogleSessionTokenFromRequest found a NextAuth session without Google refresh token metadata. Sign in with Google again.",
    );
  }

  return token as AuthenticatedGoogleSessionToken;
}

export async function getGoogleSessionTokenFromRequest(
  request: ServerAuthRequest,
  dependencies: {
    fetchImplementation?: typeof fetch;
    getJwt?: GetJwtImplementation;
  } = {},
): Promise<AuthenticatedGoogleSessionToken> {
  const googleOAuthServerConfig = getGoogleOAuthServerConfig();

  if (!googleOAuthServerConfig) {
    throw new GoogleOAuthConfigurationError(
      "google-drive-client:getGoogleSessionTokenFromRequest requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL server configuration.",
    );
  }

  const sessionToken = assertGoogleSessionToken(
    (await (dependencies.getJwt ?? getToken)({
      req: request as Parameters<GetJwtImplementation>[0]["req"],
      secret: googleOAuthServerConfig.nextAuthSecret,
    })) as GoogleSessionToken | null,
  );

  if (!hasExpiredGoogleAccessToken(sessionToken)) {
    return sessionToken;
  }

  return (await refreshGoogleSessionToken(
    sessionToken,
    dependencies.fetchImplementation,
  )) as AuthenticatedGoogleSessionToken;
}

export async function getGoogleDriveClientFromRequest(
  request: ServerAuthRequest,
  dependencies: {
    fetchImplementation?: typeof fetch;
    getJwt?: GetJwtImplementation;
  } = {},
): Promise<drive_v3.Drive> {
  const googleOAuthServerConfig = getGoogleOAuthServerConfig();

  if (!googleOAuthServerConfig) {
    throw new GoogleOAuthConfigurationError(
      "google-drive-client:getGoogleDriveClientFromRequest requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL server configuration.",
    );
  }

  const sessionToken = await getGoogleSessionTokenFromRequest(
    request,
    dependencies,
  );
  const oauth2Client = new google.auth.OAuth2(
    googleOAuthServerConfig.clientId,
    googleOAuthServerConfig.clientSecret,
  );

  oauth2Client.setCredentials({
    access_token: sessionToken.googleAccessToken,
    expiry_date: sessionToken.googleAccessTokenExpiresAt * 1000,
    refresh_token: sessionToken.googleRefreshToken,
    scope: sessionToken.googleScope,
    token_type: sessionToken.googleTokenType,
  });

  return google.drive({
    auth: oauth2Client,
    version: "v3",
  });
}
