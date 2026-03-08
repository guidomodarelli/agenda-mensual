import { z } from "zod";

import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_SCOPE_STRING,
} from "./google-oauth-scopes";

const googleOAuthServerEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  NEXTAUTH_SECRET: z.string().trim().min(1),
  NEXTAUTH_URL: z.string().trim().url(),
});

export interface GoogleOAuthServerConfig {
  clientId: string;
  clientSecret: string;
  nextAuthSecret: string;
  nextAuthUrl: string;
  scopes: readonly string[];
  scopeString: string;
}

export function getGoogleOAuthServerConfig(): GoogleOAuthServerConfig | null {
  const parsedEnvironment = googleOAuthServerEnvSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });

  if (!parsedEnvironment.success) {
    return null;
  }

  return {
    clientId: parsedEnvironment.data.GOOGLE_CLIENT_ID,
    clientSecret: parsedEnvironment.data.GOOGLE_CLIENT_SECRET,
    nextAuthSecret: parsedEnvironment.data.NEXTAUTH_SECRET,
    nextAuthUrl: parsedEnvironment.data.NEXTAUTH_URL,
    scopes: GOOGLE_OAUTH_SCOPES,
    scopeString: GOOGLE_OAUTH_SCOPE_STRING,
  };
}

export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthServerConfig() !== null;
}
