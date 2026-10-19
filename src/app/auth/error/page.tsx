import { Link, Card, TypingAnimation } from "beez-ui";
import type { Metadata } from "next";

import { getAuthErrorMessage } from "@/modules/auth/application/queries/get-auth-error-message";
import type { AppPageSearchParams } from "@/modules/shared/infrastructure/next-app/legacy-page-context";

import styles from "../auth-page.module.scss";

export const metadata: Metadata = {
  title: "Error de autenticacion",
};

interface AuthErrorPageProps {
  searchParams?: Promise<AppPageSearchParams>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorCode =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;

  return (
    <section className={styles.page}>
      <TypingAnimation
        aria-label="Error de autenticación"
        as="h1"
        className={styles.pageHeading}
        showCursor={false}
        startOnView={false}
      >
        Error de autenticación
      </TypingAnimation>
      <Card
        className={styles.card}
        description="La aplicación protege los detalles internos y muestra una respuesta segura cuando la autenticación falla."
        footer={
          <div className={styles.actions}>
            <Link className={styles.primaryLink} href="/auth/signin">
              Intentar de nuevo
            </Link>
            <Link className={styles.secondaryLink} href="/">
              Ir al inicio
            </Link>
          </div>
        }
        title="No pudimos conectar tu cuenta"
      >
        <p className={styles.warning}>{getAuthErrorMessage(errorCode)}</p>
      </Card>
    </section>
  );
}
