import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { TypingAnimation } from "@/components/ui/typing-animation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>No pudimos conectar tu cuenta</CardTitle>
          <CardDescription>
            La aplicación protege los detalles internos y muestra una respuesta
            segura cuando la autenticación falla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className={styles.warning}>{getAuthErrorMessage(errorCode)}</p>
        </CardContent>
        <CardFooter className={styles.actions}>
          <Button asChild>
            <Link href="/auth/signin">Intentar de nuevo</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
