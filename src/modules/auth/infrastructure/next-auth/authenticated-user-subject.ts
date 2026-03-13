import type { GetServerSidePropsContext, NextApiRequest } from "next";
import { getToken } from "next-auth/jwt";

import { getGoogleOAuthServerConfig } from "../oauth/google-oauth-config";
import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "../oauth/google-oauth-token";

type ServerAuthRequest = GetServerSidePropsContext["req"] | NextApiRequest;
type GetJwtImplementation = typeof getToken;

type NextAuthJwtPayload = {
  sub?: string | null;
};

export async function getAuthenticatedUserSubjectFromRequest(
  request: ServerAuthRequest,
  dependencies: {
    getJwt?: GetJwtImplementation;
  } = {},
): Promise<string> {
  const googleOAuthServerConfig = getGoogleOAuthServerConfig();

  if (!googleOAuthServerConfig) {
    throw new GoogleOAuthConfigurationError(
      "authenticated-user-subject:missing NEXTAUTH_SECRET server configuration.",
    );
  }

  const token = (await (dependencies.getJwt ?? getToken)({
    req: request as Parameters<GetJwtImplementation>[0]["req"],
    secret: googleOAuthServerConfig.nextAuthSecret,
  })) as NextAuthJwtPayload | null;
  const userSubject = token?.sub?.trim();

  if (!userSubject) {
    throw new GoogleOAuthAuthenticationError(
      "authenticated-user-subject:request requires an authenticated Google session.",
    );
  }

  return userSubject;
}
