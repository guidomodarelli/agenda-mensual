import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession, type Session } from "next-auth";
import type { ClientSafeProvider } from "next-auth/react";

import { authOptions } from "@/modules/auth/infrastructure/next-auth/auth-options";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";

import { SignInPageClient } from "./signin-page-client";

type ProviderMap = Record<string, ClientSafeProvider>;

function createGoogleProviderFallback(): ClientSafeProvider {
  return {
    callbackUrl: "/api/auth/callback/google",
    id: "google",
    name: "Google",
    signinUrl: "/api/auth/signin/google",
    type: "oauth",
  };
}

export const metadata: Metadata = {
  title: "Conectar Google",
};

export default async function SignInPage() {
  let providers: ProviderMap = {};
  let session: Session | null = null;

  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  if (session) {
    redirect("/");
  }

  if (isGoogleOAuthConfigured()) {
    providers = {
      google: createGoogleProviderFallback(),
    };
  }

  return (
    <SignInPageClient
      hasProviderError={false}
      providers={providers}
    />
  );
}
