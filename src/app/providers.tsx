"use client";

import { ThemedToaster as Toaster } from "@golfo/ui";
import { GolfoUIProvider } from "@golfo/ui/next";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useEffect, type ReactNode } from "react";

import { registerServiceWorker } from "@/modules/shared/infrastructure/pages/register-service-worker";

/** Retains existing saved preferences while using the shared library theme. */
const APP_THEME_OPTIONS = {
  defaultTheme: "system",
  disableTransitionOnChange: true,
  enableColorScheme: false,
  enableSystem: true,
  storageKey: "theme",
  themes: ["light", "dark"],
};

interface AppProvidersProps {
  children: ReactNode;
  session: Session | null;
}

/** Composes authentication, the shared Next adapter and the existing PWA lifecycle. */
export function AppProviders({ children, session }: AppProvidersProps) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <SessionProvider session={session}>
      <GolfoUIProvider themeOptions={APP_THEME_OPTIONS}>
        {children}
        <Toaster closeButton position="top-center" richColors />
      </GolfoUIProvider>
    </SessionProvider>
  );
}
