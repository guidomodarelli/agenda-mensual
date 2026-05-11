import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession, type Session } from "next-auth";
import { getProviders, type ClientSafeProvider } from "next-auth/react";

import { authOptions } from "@/modules/auth/infrastructure/next-auth/auth-options";

import { SignInPageClient } from "./signin-page-client";

type ProviderMap = Record<string, ClientSafeProvider>;

export const metadata: Metadata = {
  title: "Conectar Google",
};

export default async function SignInPage() {
  let hasProviderError = false;
  let providers: ProviderMap = {};
  let session: Session | null = null;

  try {
    session = await getServerSession(authOptions);
  } catch {
    hasProviderError = true;
  }

  if (session) {
    redirect("/");
  }

  if (!hasProviderError) {
    try {
      providers = ((await getProviders()) ?? {}) as ProviderMap;
    } catch {
      hasProviderError = true;
    }
  }

  return (
    <SignInPageClient
      hasProviderError={hasProviderError}
      providers={providers}
    />
  );
}
