"use client";

import {
  Button,
  Input,
  Label,
  TypingAnimation,
  toast,
} from "beez-ui";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  type ExchangeRatesRoutePageProps,
} from "@/modules/exchange-rates/infrastructure/pages/exchange-rates-server-props";
import { saveMonthlyIibbRateViaApi } from "@/modules/exchange-rates/infrastructure/api/exchange-rates-settings-api";
import {
  getTechnicalErrorCode,
} from "@/modules/shared/infrastructure/errors/technical-error";
import {
  renderErrorWithCode,
} from "@/modules/shared/infrastructure/errors/technical-error-ui";

import styles from "./exchange-rates-page.module.scss";

function formatCurrency(value: number, isAvailable: boolean): string {
  if (!isAvailable) {
    return "No disponible";
  }

  return new Intl.NumberFormat("es-AR", {
    currency: "ARS",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent",
  }).format(value);
}

function parseIibbRateDecimal(input: string): number | null {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    return null;
  }

  const parsedValue = Number(normalizedInput);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export default function ExchangeRatesPage({
  result,
}: ExchangeRatesRoutePageProps) {
  const router = useRouter();
  const [currentResult, setCurrentResult] = useState(result);
  const [iibbInputValue, setIibbInputValue] = useState(
    String(result.iibbRateDecimal),
  );
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(
    result.loadError,
  );
  const [feedbackErrorCode, setFeedbackErrorCode] = useState(result.loadErrorCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A newly loaded month replaces local edits during render, so stale values never paint.
  const [loadedResult, setLoadedResult] = useState(result);
  if (result !== loadedResult) {
    setLoadedResult(result);
    setCurrentResult(result);
    setIibbInputValue(String(result.iibbRateDecimal));
    setFeedbackMessage(result.loadError);
    setFeedbackErrorCode(result.loadErrorCode);
  }
  const isRatesAvailable = !currentResult.loadError;

  const handleMonthChange = (selectedMonth: string) => {
    const normalizedMonth = selectedMonth.trim();

    if (
      !normalizedMonth ||
      normalizedMonth === currentResult.selectedMonth ||
      normalizedMonth > currentResult.maxSelectableMonth
    ) {
      return;
    }

    void router.replace(`/cotizaciones?month=${encodeURIComponent(normalizedMonth)}`, {
      scroll: false,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentResult.canEditIibb) {
      return;
    }

    const parsedIibbRateDecimal = parseIibbRateDecimal(iibbInputValue);

    if (
      parsedIibbRateDecimal == null ||
      parsedIibbRateDecimal < 0 ||
      parsedIibbRateDecimal >= 1
    ) {
      setFeedbackMessage(
        "Ingresá un valor decimal válido para IIBB entre 0 y 1. Por ejemplo: 0.02.",
      );
      setFeedbackErrorCode(null);
      toast.warning("Ingresá un valor válido para IIBB.");
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);
    setFeedbackErrorCode(null);

    try {
      const savedRate = await saveMonthlyIibbRateViaApi({
        iibbRateDecimal: parsedIibbRateDecimal,
        month: currentResult.selectedMonth,
      });

      setCurrentResult((previousResult) => ({
        ...previousResult,
        iibbRateDecimal: savedRate.iibbRateDecimal,
        solidarityRate: savedRate.solidarityRate,
      }));
      setIibbInputValue(String(savedRate.iibbRateDecimal));
      toast.success("El IIBB del mes se guardó correctamente.");
    } catch (error) {
      const nextFeedbackMessage =
        error instanceof Error
          ? error.message
          : "No pudimos guardar el IIBB del mes.";

      setFeedbackMessage(nextFeedbackMessage);
      const technicalErrorCode = getTechnicalErrorCode(error);

      setFeedbackErrorCode(technicalErrorCode);
      toast.error(
        renderErrorWithCode(
          "No pudimos guardar el IIBB del mes.",
          technicalErrorCode,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.section}>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>Mercado cambiario</p>
          <TypingAnimation
            aria-label="Cotizaciones del dólar"
            as="h1"
            className={styles.pageHeading}
            showCursor={false}
            startOnView={false}
          >
            Cotizaciones del dólar
          </TypingAnimation>
          <p className={styles.description}>
            Consultá el valor oficial, blue y solidario del mes seleccionado.
          </p>
        </div>

        <section className={styles.settingsBlock}>
          <h2 className={styles.blockTitle}>Mes de consulta</h2>
          <div className={styles.settingsField}>
            <Label htmlFor="exchange-rates-month">Mes y año</Label>
            <Input
              id="exchange-rates-month"
              max={currentResult.maxSelectableMonth}
              onChange={(event) => handleMonthChange(event.target.value)}
              type="month"
              value={currentResult.selectedMonth}
            />
            <p className={styles.helperText}>
              Podés consultar cualquier mes anterior hasta{" "}
              {currentResult.maxSelectableMonth}. No se permiten meses
              futuros.
            </p>
          </div>
        </section>

        {feedbackMessage ? (
          <p className={`${styles.feedbackText} ${styles.errorText}`} role="alert">
            <span>{feedbackMessage}</span>
            {feedbackErrorCode ? (
              <span className={styles.feedbackErrorCode}>{`Code: ${feedbackErrorCode}`}</span>
            ) : null}
          </p>
        ) : null}

        <section className={styles.ratesRow} aria-label="Cotizaciones del mes">
          <div className={styles.rateItem}>
            <p className={styles.rateLabel}>Dólar oficial</p>
            <p className={styles.rateValue}>
              {formatCurrency(currentResult.officialRate, isRatesAvailable)}
            </p>
            <p className={styles.rateHint}>Referencia base para el cálculo.</p>
          </div>
          <div className={styles.rateItem}>
            <p className={styles.rateLabel}>Dólar blue</p>
            <p className={styles.rateValue}>
              {formatCurrency(currentResult.blueRate, isRatesAvailable)}
            </p>
            <p className={styles.rateHint}>
              Valor obtenido desde la cotización informal.
            </p>
          </div>
          <div className={styles.rateItem}>
            <p className={styles.rateLabel}>Dólar solidario</p>
            <p className={styles.rateValue}>
              {formatCurrency(currentResult.solidarityRate, isRatesAvailable)}
            </p>
            <p className={styles.rateHint}>
              Oficial + IVA ({formatPercentage(0.21)}) + IIBB (
              {formatPercentage(currentResult.iibbRateDecimal)}).
            </p>
          </div>
        </section>

        <section className={styles.settingsBlock}>
          <h2 className={styles.blockTitle}>
            IIBB del mes {currentResult.selectedMonth}
          </h2>
          {currentResult.canEditIibb ? (
            <form className={styles.settingsForm} onSubmit={handleSubmit}>
              <div className={styles.settingsField}>
                <Label htmlFor="iibbRateDecimal">IIBB en formato decimal</Label>
                <Input
                  id="iibbRateDecimal"
                  inputMode="decimal"
                  onChange={(event) => setIibbInputValue(event.target.value)}
                  placeholder="0.02"
                  step="0.0001"
                  type="number"
                  value={iibbInputValue}
                />
                <p className={styles.helperText}>
                  Usá decimal. Ejemplo: 0.02 equivale a 2%. Se aplica solo al mes
                  seleccionado.
                </p>
              </div>
              <div className={styles.settingsActions}>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Guardando IIBB..." : "Guardar IIBB"}
                </Button>
              </div>
            </form>
          ) : (
            <div className={styles.settingsField}>
              <p className={styles.readOnlyValue}>
                {formatPercentage(currentResult.iibbRateDecimal)}
              </p>
              <p className={styles.helperText}>
                Solo los admins configurados en la allowlist pueden editar el
                IIBB del mes.
              </p>
            </div>
          )}
        </section>
    </section>
  );
}
