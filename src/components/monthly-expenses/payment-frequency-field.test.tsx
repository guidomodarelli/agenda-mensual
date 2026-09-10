import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { PaymentFrequencyField } from "./payment-frequency-field";

function PaymentFrequencyFieldHarness({
  initialOccurrencesPerMonth,
}: {
  initialOccurrencesPerMonth: string;
}) {
  const [occurrencesPerMonth, setOccurrencesPerMonth] = useState(
    initialOccurrencesPerMonth,
  );
  const [occurrencesUnit, setOccurrencesUnit] = useState("");

  return (
    <PaymentFrequencyField
      hasError={false}
      isChanged={false}
      isUnitChanged={false}
      occurrencesPerMonth={occurrencesPerMonth}
      occurrencesUnit={occurrencesUnit}
      onOccurrencesPerMonthChange={setOccurrencesPerMonth}
      onOccurrencesUnitChange={setOccurrencesUnit}
    />
  );
}

describe("PaymentFrequencyField", () => {
  it("switches to multiple by clicking the row description and back to single", async () => {
    const user = userEvent.setup();

    render(<PaymentFrequencyFieldHarness initialOccurrencesPerMonth="1" />);

    await user.click(
      screen.getByText(/clases de ingles, psicologa o empleada domestica/),
    );

    expect(
      screen.getByRole("radio", { name: "Se paga varias veces en el mes" }),
    ).toBeChecked();
    expect(screen.getByLabelText("Veces al mes")).toBeInTheDocument();

    // Vuelta a la primera opción clickeando su descripción.
    await user.click(
      screen.getByText(/alquiler, expensas, agua/),
    );

    expect(
      screen.getByRole("radio", { name: "Un único pago al mes" }),
    ).toBeChecked();
    expect(screen.queryByLabelText("Veces al mes")).not.toBeInTheDocument();
  });

  it("goes back to single while the occurrences input still has focus", async () => {
    const user = userEvent.setup();

    render(<PaymentFrequencyFieldHarness initialOccurrencesPerMonth="8" />);

    const occurrencesInput = screen.getByLabelText("Veces al mes");

    await user.clear(occurrencesInput);
    await user.type(occurrencesInput, "5");

    // Con el foco todavía en el input, click en la primera opción: el blur
    // normaliza el valor y el click debe ganar igual.
    await user.click(screen.getByText(/alquiler, expensas, agua/));

    expect(
      screen.getByRole("radio", { name: "Un único pago al mes" }),
    ).toBeChecked();
    expect(screen.queryByLabelText("Veces al mes")).not.toBeInTheDocument();
  });

  it("goes back to single by clicking the first option's radio", async () => {
    const user = userEvent.setup();

    render(<PaymentFrequencyFieldHarness initialOccurrencesPerMonth="8" />);

    expect(
      screen.getByRole("radio", { name: "Se paga varias veces en el mes" }),
    ).toBeChecked();

    await user.click(
      screen.getByRole("radio", { name: "Un único pago al mes" }),
    );

    expect(
      screen.getByRole("radio", { name: "Un único pago al mes" }),
    ).toBeChecked();
    expect(screen.queryByLabelText("Veces al mes")).not.toBeInTheDocument();
  });
});
