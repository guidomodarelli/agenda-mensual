"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TypingAnimation } from "@/components/ui/typing-animation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ExchangeRatesRoutePageProps,
} from "@/modules/exchange-rates/infrastructure/pages/exchange-rates-server-props";
import { saveGlobalExchangeRateSettingsViaApi } from "@/modules/exchange-rates/infrastructure/api/exchange-rates-settings-api";
import { calculateSolidarityRate } from "@/modules/exchange-rates/application/use-cases/get-monthly-exchange-rate-snapshot";
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
  const isRatesAvailable = !currentResult.loadError;

  useEffect(() => {
    setCurrentResult(result);
    setIibbInputValue(String(result.iibbRateDecimal));
    setFeedbackMessage(result.loadError);
    setFeedbackErrorCode(result.loadErrorCode);
  }, [result]);

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
      const savedSettings = await saveGlobalExchangeRateSettingsViaApi({
        iibbRateDecimal: parsedIibbRateDecimal,
      });

      setCurrentResult((previousResult) => ({
        ...previousResult,
        iibbRateDecimal: savedSettings.iibbRateDecimal,
        solidarityRate: calculateSolidarityRate(
          previousResult.officialRate,
          savedSettings.iibbRateDecimal,
        ),
      }));
      setIibbInputValue(String(savedSettings.iibbRateDecimal));
      toast.success("La configuración global de IIBB se guardó correctamente.");
    } catch (error) {
      const nextFeedbackMessage =
        error instanceof Error
          ? error.message
          : "No pudimos guardar la configuración global de IIBB.";

      setFeedbackMessage(nextFeedbackMessage);
      const technicalErrorCode = getTechnicalErrorCode(error);

      setFeedbackErrorCode(technicalErrorCode);
      toast.error(
        renderErrorWithCode(
          "No pudimos guardar la configuración global de IIBB.",
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

        <Card className={styles.settingsCard}>
          <CardHeader>
            <CardTitle>Mes de consulta</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {feedbackMessage ? (
          <Card>
            <CardContent>
              <p className={`${styles.feedbackText} ${styles.errorText}`} role="alert">
                <span>{feedbackMessage}</span>
                {feedbackErrorCode ? (
                  <span className={styles.feedbackErrorCode}>{`Code: ${feedbackErrorCode}`}</span>
                ) : null}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className={styles.cardsGrid}>
          <Card className={styles.rateCard}>
            <CardHeader>
              <CardTitle>Dólar oficial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={styles.rateValue}>
                {formatCurrency(currentResult.officialRate, isRatesAvailable)}
              </p>
              <p className={styles.rateHint}>Referencia base para el cálculo.</p>
            </CardContent>
          </Card>
          <Card className={styles.rateCard}>
            <CardHeader>
              <CardTitle>Dólar blue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={styles.rateValue}>
                {formatCurrency(currentResult.blueRate, isRatesAvailable)}
              </p>
              <p className={styles.rateHint}>
                Valor obtenido desde la cotización informal.
              </p>
            </CardContent>
          </Card>
          <Card className={styles.rateCard}>
            <CardHeader>
              <CardTitle>Dólar solidario</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={styles.rateValue}>
                {formatCurrency(currentResult.solidarityRate, isRatesAvailable)}
              </p>
              <p className={styles.rateHint}>
                Oficial + IVA ({formatPercentage(0.21)}) + IIBB (
                {formatPercentage(currentResult.iibbRateDecimal)}).
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className={styles.settingsCard}>
          <CardHeader>
            <CardTitle>Configuración global de IIBB</CardTitle>
          </CardHeader>
          <CardContent>
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
                    Usá decimal. Ejemplo: 0.02 equivale a 2%.
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
                  Solo los admins configurados en la allowlist pueden editar este
                  valor global.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
    </section>
  );
}
