"use client";

import {
  Link,
  Button,
  Card,
  TypingAnimation,
} from "@astra-kit/ui";

import { useSearchParams } from "next/navigation";
import { signIn, type ClientSafeProvider } from "next-auth/react";

import styles from "../auth-page.module.scss";

type ProviderMap = Record<string, ClientSafeProvider>;

interface SignInPageClientProps {
  hasProviderError: boolean;
  providers: ProviderMap;
}

export function SignInPageClient({
  hasProviderError,
  providers,
}: SignInPageClientProps) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl")?.trim() || "/";
  const googleProvider = Object.values(providers).find(
    (provider) => provider.id === "google",
  );

  const handleGoogleSignIn = () => {
    if (!googleProvider) {
      return;
    }

    void signIn(googleProvider.id, { callbackUrl });
  };

  return (
    <section className={styles.page}>
      <TypingAnimation
        aria-label="Ingreso a tu cuenta"
        as="h1"
        className={styles.pageHeading}
        showCursor={false}
        startOnView={false}
      >
        Ingreso a tu cuenta
      </TypingAnimation>
      <Card
        className={styles.card}
        description="Esta base usa App Router, SSR y adapters de infraestructura para integrar servicios externos sin mezclar reglas de negocio."
        footer={
          <div className={styles.actions}>
            <Button
              disabled={!googleProvider || hasProviderError}
              onClick={handleGoogleSignIn}
              type="button"
            >
              Continuar con Google
            </Button>
            <Link className={styles.secondaryLink} href="/">
              Volver al inicio
            </Link>
          </div>
        }
        title="Conectar Google"
      >
        {googleProvider ? (
          <p className={styles.warning}>
            El login usa el proveedor oficial de Google con permisos mínimos
            para las operaciones de almacenamiento necesarias.
          </p>
        ) : (
          <p className={styles.warning}>
            La autenticación con Google todavía no está lista en este entorno.
            Completá las variables del servidor y reintentá.
          </p>
        )}
        {hasProviderError ? (
          <p className={styles.warning}>
            No pudimos consultar los proveedores de autenticación. Reintentá
            más tarde.
          </p>
        ) : null}
      </Card>
    </section>
  );
}
