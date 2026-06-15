import {
  composeOccurrencesUnit,
  resolveOccurrencesUnitLabel,
  splitOccurrencesUnit,
} from "./occurrences-unit";

describe("occurrences unit helpers", () => {
  it("composes a periodicity with an optional per-occurrence duration", () => {
    expect(composeOccurrencesUnit("veces", "30'")).toBe("veces de 30'");
    expect(composeOccurrencesUnit("semanas", "")).toBe("semanas");
  });

  it("assumes the default periodicity when only a duration is provided", () => {
    expect(composeOccurrencesUnit("", "30'")).toBe("veces de 30'");
  });

  it("returns an empty string when there is nothing to label", () => {
    expect(composeOccurrencesUnit("", "")).toBe("");
    expect(composeOccurrencesUnit("   ", "  ")).toBe("");
  });

  it("splits a stored unit into periodicity and duration", () => {
    expect(splitOccurrencesUnit("veces de 30'")).toEqual({
      duration: "30'",
      periodicity: "veces",
    });
    expect(splitOccurrencesUnit("semanas")).toEqual({
      duration: "",
      periodicity: "semanas",
    });
  });

  it("round-trips compose and split", () => {
    const composed = composeOccurrencesUnit("sesiones", "1h 30");

    expect(composed).toBe("sesiones de 1h 30");
    expect(splitOccurrencesUnit(composed)).toEqual({
      duration: "1h 30",
      periodicity: "sesiones",
    });
  });

  it("falls back to the default label when no unit is stored", () => {
    expect(resolveOccurrencesUnitLabel("")).toBe("veces");
    expect(resolveOccurrencesUnitLabel("veces de 30'")).toBe("veces de 30'");
  });
});
