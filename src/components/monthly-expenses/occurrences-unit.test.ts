import {
  composeOccurrencesUnit,
  formatOccurrenceDuration,
  formatOccurrencesMultiplierLabel,
  parseOccurrenceDuration,
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
    expect(resolveOccurrencesUnitLabel("veces de 4h 30")).toBe("veces de 4h 30");
  });

  it("builds the quantity multiplier label with a duration suffixed by minutes", () => {
    expect(formatOccurrencesMultiplierLabel(2, "veces de 4h 30")).toBe(
      "× 2 veces de 4h 30m",
    );
    expect(formatOccurrencesMultiplierLabel(2, "veces de 30'")).toBe(
      "× 2 veces de 30m",
    );
    expect(formatOccurrencesMultiplierLabel(3, "veces de 2h")).toBe(
      "× 3 veces de 2h",
    );
  });

  it("pluralizes the default unit by count and keeps custom units as stored", () => {
    expect(formatOccurrencesMultiplierLabel(1, "veces de 4h 30")).toBe(
      "× 1 vez de 4h 30m",
    );
    expect(formatOccurrencesMultiplierLabel(1, "")).toBe("× 1 vez");
    expect(formatOccurrencesMultiplierLabel(4, "")).toBe("× 4 veces");
    expect(formatOccurrencesMultiplierLabel(9, "sesiones")).toBe(
      "× 9 sesiones",
    );
  });

  it("formats an hours/minutes pair into a canonical duration label", () => {
    expect(formatOccurrenceDuration(4, 30)).toBe("4h 30");
    expect(formatOccurrenceDuration(4, 0)).toBe("4h");
    expect(formatOccurrenceDuration(0, 30)).toBe("30 min");
    expect(formatOccurrenceDuration(0, 0)).toBe("");
  });

  it("carries extra minutes over into hours", () => {
    expect(formatOccurrenceDuration(4, 90)).toBe("5h 30");
  });

  it("parses canonical and legacy duration labels back into hours/minutes", () => {
    expect(parseOccurrenceDuration("4h 30")).toEqual({ hours: 4, minutes: 30 });
    expect(parseOccurrenceDuration("4h")).toEqual({ hours: 4, minutes: 0 });
    expect(parseOccurrenceDuration("30 min")).toEqual({ hours: 0, minutes: 30 });
    expect(parseOccurrenceDuration("30'")).toEqual({ hours: 0, minutes: 30 });
    expect(parseOccurrenceDuration("")).toEqual({ hours: 0, minutes: 0 });
  });

  it("round-trips a duration through format and parse inside the unit", () => {
    const duration = formatOccurrenceDuration(4, 30);
    const unit = composeOccurrencesUnit("veces", duration);

    expect(unit).toBe("veces de 4h 30");
    expect(parseOccurrenceDuration(splitOccurrencesUnit(unit).duration)).toEqual({
      hours: 4,
      minutes: 30,
    });
  });
});
