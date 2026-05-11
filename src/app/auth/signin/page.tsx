import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
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
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  try {
    providers = ((await getProviders()) ?? {}) as ProviderMap;
  } catch {
    hasProviderError = true;
  }

  return (
    <SignInPageClient
      hasProviderError={hasProviderError}
      providers={providers}
    />
  );
}
