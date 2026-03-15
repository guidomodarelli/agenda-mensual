import "@/styles/globals.css";
import "@/styles/globals.scss";

import Head from "next/head";
import { Inter, Geist_Mono } from "next/font/google";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { ThemeProvider } from "next-themes";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const interSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

type PagePropsWithSession = {
  session?: Session | null;
};

const APP_NAME = "Mis Finanzas";
const PAGE_TITLE_BY_PATHNAME: Record<string, string> = {
  "/": "Inicio",
  "/auth/error": "Error de autenticacion",
  "/auth/signin": "Conectar Google",
  "/cotizaciones": "Cotizaciones del dolar",
  "/gastos": "Gastos del mes",
  "/prestadores": "Prestadores",
  "/reportes/deudas": "Reporte de deudas",
};

function getDocumentTitle(pathname: string): string {
  const pageTitle = PAGE_TITLE_BY_PATHNAME[pathname];

  return pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
}

export default function App({
  Component,
  pageProps,
}: AppProps<PagePropsWithSession>) {
  const router = useRouter();
  const { session, ...restPageProps } = pageProps;
  const documentTitle = getDocumentTitle(router.pathname);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    async function loadReactGrabCodexProvider() {
      await import("react-grab");
      await import("@react-grab/codex/client");
    }

    void loadReactGrabCodexProvider();
  }, []);

  return (
    <SessionProvider session={session}>
      <Head>
        <title>{documentTitle}</title>
      </Head>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableColorScheme={false}
        enableSystem
        storageKey="theme"
        themes={["light", "dark"]}
      >
        <TooltipProvider>
          <div className={`${interSans.className} ${interSans.variable} ${geistMono.variable}`}>
            <Component {...restPageProps} />
            <Toaster closeButton position="top-center" richColors />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
