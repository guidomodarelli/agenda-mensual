import styles from "./payment-progress-ring.module.scss";

const PAYMENT_PROGRESS_RING_RADIUS = 7;
const PAYMENT_PROGRESS_RING_CIRCUMFERENCE =
  2 * Math.PI * PAYMENT_PROGRESS_RING_RADIUS;

export interface PaymentProgressRingProps {
  /** Completion ratio in the `[0, 1]` range; values outside are clamped. */
  fraction: number;
}

/**
 * Compact circular progress indicator for the payments column. The arc inherits
 * the surrounding text color (green when complete, yellow when pending) through
 * `currentColor`, so it stays in sync with the numeric label without extra props.
 *
 * @param props - Component props.
 * @param props.fraction - Completion ratio in the `[0, 1]` range.
 * @returns A decorative SVG ring; rendered `aria-hidden` since the adjacent
 *   `covered / required` label already conveys the value to assistive tech.
 */
export function PaymentProgressRing({ fraction }: PaymentProgressRingProps) {
  const clampedFraction = Math.min(Math.max(fraction, 0), 1);
  const dashOffset = PAYMENT_PROGRESS_RING_CIRCUMFERENCE * (1 - clampedFraction);

  return (
    <svg
      aria-hidden="true"
      className={styles.paymentProgressRing}
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <circle
        className={styles.paymentProgressRingTrack}
        cx="9"
        cy="9"
        fill="none"
        r={PAYMENT_PROGRESS_RING_RADIUS}
        strokeWidth="2.5"
      />
      {clampedFraction > 0 ? (
        <circle
          cx="9"
          cy="9"
          fill="none"
          r={PAYMENT_PROGRESS_RING_RADIUS}
          stroke="currentColor"
          strokeDasharray={PAYMENT_PROGRESS_RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      ) : null}
    </svg>
  );
}
