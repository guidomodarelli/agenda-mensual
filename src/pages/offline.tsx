import Link from "next/link";

import { TypingAnimation } from "@/components/ui/typing-animation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import styles from "./offline-page.module.scss";

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <TypingAnimation
        aria-label="Sin conexión"
        as="h1"
        className={styles.pageHeading}
        showCursor={false}
        startOnView={false}
      >
        Sin conexión
      </TypingAnimation>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>No hay internet en este momento</CardTitle>
          <CardDescription>
            Guardamos una vista offline para que puedas abrir la aplicación
            aunque no tengas red temporalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className={styles.bodyCopy}>
            Cuando vuelvas a tener conexión, recargá la página para continuar
            con datos actualizados.
          </p>
        </CardContent>
        <CardFooter className={styles.actions}>
          <Button asChild>
            <Link href="/gastos">Intentar abrir la app</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Inicio</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
