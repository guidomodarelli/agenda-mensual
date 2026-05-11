import "@/styles/globals.css";
import "@/styles/globals.scss";

import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";

import { authOptions } from "@/modules/auth/infrastructure/next-auth/auth-options";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";

import { AppProviders } from "./providers";

const interSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const APP_NAME = "Control Mensual";
const APP_DESCRIPTION = "Gestiona tu control mensual: pagos, deudas, cuotas, prestamos, comprobantes y prestamistas, con reportes de seguimiento.";
const APP_ICON_VERSION = "20260511";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  applicationName: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    apple: [
      {
        sizes: "180x180",
        url: `/apple-touch-icon.png?v=${APP_ICON_VERSION}`,
      },
    ],
    icon: [
      {
        sizes: "48x48",
        url: `/favicon.ico?v=${APP_ICON_VERSION}`,
      },
      {
        type: "image/svg+xml",
        url: `/favicon.svg?v=${APP_ICON_VERSION}`,
      },
      {
        sizes: "96x96",
        type: "image/png",
        url: `/favicon-96x96.png?v=${APP_ICON_VERSION}`,
      },
    ],
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
};

export const viewport: Viewport = {
  themeColor: "#121826",
};

type GetRootServerSessionDependencies = {
  getConfiguredAuthSession?: typeof getServerSession;
  isAuthConfigured?: typeof isGoogleOAuthConfigured;
};

export async function getRootServerSession({
  getConfiguredAuthSession = () => getServerSession(authOptions),
  isAuthConfigured = isGoogleOAuthConfigured,
}: GetRootServerSessionDependencies = {}) {
  if (!isAuthConfigured()) {
    return null;
  }

  return getConfiguredAuthSession();
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getRootServerSession();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${interSans.className} ${interSans.variable} ${geistMono.variable}`}>
        <AppProviders session={session}>{children}</AppProviders>
      </body>
    </html>
  );
}
