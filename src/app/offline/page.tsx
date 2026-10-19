import { Link, Card, TypingAnimation } from "@astra-kit/ui";
import type { Metadata } from "next";

import styles from "./offline-page.module.scss";

export const metadata: Metadata = {
  title: "Sin conexión",
};

export default function OfflinePage() {
  return (
    <section className={styles.page}>
      <TypingAnimation
        aria-label="Sin conexión"
        as="h1"
        className={styles.pageHeading}
        showCursor={false}
        startOnView={false}
      >
        Sin conexión
      </TypingAnimation>
      <Card
        className={styles.card}
        description="Guardamos una vista offline para que puedas abrir la aplicación aunque no tengas red temporalmente."
        footer={
          <div className={styles.actions}>
            <Link className={styles.primaryLink} href="/gastos">
              Intentar abrir la app
            </Link>
            <Link className={styles.secondaryLink} href="/">
              Inicio
            </Link>
          </div>
        }
        title="No hay internet en este momento"
      >
        <p className={styles.bodyCopy}>
          Cuando vuelvas a tener conexión, recargá la página para continuar con
          datos actualizados.
        </p>
      </Card>
    </section>
  );
}
