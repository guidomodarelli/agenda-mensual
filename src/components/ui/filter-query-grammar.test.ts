import {
  getActiveFilterToken,
  parseFilterQuery,
  parseYearMonthSlug,
  serializeFilterQuery,
  tokenizeFilterQuery,
  type FilterQualifierConfig,
} from "./filter-query-grammar";

const CONFIGS: FilterQualifierConfig[] = [
  { key: "", kind: "text", label: "Descripción" },
  { columnId: "subtotal", key: "subtotal", kind: "numberRange", label: "Subtotal" },
  { columnId: "total", key: "total", kind: "numberRange", label: "Total" },
  {
    columnId: "lenderName",
    key: "direccion",
    kind: "enum",
    label: "Dirección",
    options: [
      { label: "Yo debo", slug: "yo-debo", value: "payable" },
      { label: "Me deben", slug: "me-deben", value: "receivable" },
      { label: "Sin deuda", slug: "sin-deuda", value: "none" },
    ],
  },
  { columnId: "loanProgress", key: "deuda", kind: "presence", label: "Deuda / cuotas" },
  {
    columnId: "loanInstallmentRange",
    key: "vigencia",
    kind: "yearMonthRange",
    label: "Vigencia",
  },
];

describe("tokenizeFilterQuery", () => {
  it("splits plain words preserving indices", () => {
    const tokens = tokenizeFilterQuery("luz agua");

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ raw: "luz", startIndex: 0, endIndex: 3 });
    expect(tokens[1]).toMatchObject({ raw: "agua", startIndex: 4, endIndex: 8 });
  });

  it("keeps quoted values with spaces as a single token", () => {
    const tokens = tokenizeFilterQuery('"super mercado"');

    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe("super mercado");
    expect(tokens[0].hasColon).toBe(false);
  });

  it("parses key:value tokens and negation", () => {
    const tokens = tokenizeFilterQuery("subtotal:>100 -luz");

    expect(tokens[0]).toMatchObject({
      hasColon: true,
      negated: false,
      rawKey: "subtotal",
      value: ">100",
    });
    expect(tokens[1]).toMatchObject({ negated: true, value: "luz", hasColon: false });
  });

  it("treats a value-leading quote as free text, not a qualifier", () => {
    const tokens = tokenizeFilterQuery('"a:b"');

    expect(tokens[0].hasColon).toBe(false);
    expect(tokens[0].value).toBe("a:b");
  });
});

describe("parseFilterQuery", () => {
  it("collects free text into the description filter", () => {
    const parsed = parseFilterQuery("luz agua", CONFIGS);

    expect(parsed.descriptionFilter).toBe("luz agua");
    expect(parsed.excludedDescriptionFilters).toEqual([]);
  });

  it("collects negated text into exclusions", () => {
    const parsed = parseFilterQuery("-luz -\"super mercado\"", CONFIGS);

    expect(parsed.excludedDescriptionFilters).toEqual(["luz", "super mercado"]);
    expect(parsed.descriptionFilter).toBe("");
  });

  it("parses numeric comparators inclusively", () => {
    expect(parseFilterQuery("subtotal:>100", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", min: 100 },
    });
    expect(parseFilterQuery("subtotal:>=100", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", min: 100 },
    });
    expect(parseFilterQuery("subtotal:<=500", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500 },
    });
    expect(parseFilterQuery("subtotal:=100", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 100, min: 100 },
    });
  });

  it("parses numeric ranges", () => {
    expect(parseFilterQuery("subtotal:100..500", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500, min: 100 },
    });
    expect(parseFilterQuery("subtotal:100..", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", min: 100 },
    });
    expect(parseFilterQuery("subtotal:..500", CONFIGS).advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500 },
    });
  });

  it("merges two numeric qualifiers of the same key into a range", () => {
    const parsed = parseFilterQuery("subtotal:>100 subtotal:<500", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({
      subtotal: { kind: "numberRange", max: 500, min: 100 },
    });
  });

  it("parses enum and presence values", () => {
    expect(parseFilterQuery("direccion:me-deben", CONFIGS).advancedFiltersByColumn).toEqual({
      lenderName: { kind: "enum", value: "receivable" },
    });
    expect(parseFilterQuery("deuda:si", CONFIGS).advancedFiltersByColumn).toEqual({
      loanProgress: { kind: "presence", value: "hasValue" },
    });
    expect(parseFilterQuery("deuda:no", CONFIGS).advancedFiltersByColumn).toEqual({
      loanProgress: { kind: "presence", value: "noValue" },
    });
  });

  it("parses year-month ranges and presence slugs", () => {
    expect(parseFilterQuery("vigencia:2026-06..2026-12", CONFIGS).advancedFiltersByColumn).toEqual({
      loanInstallmentRange: { kind: "yearMonthRange", max: 202612, min: 202606, mode: "range" },
    });
    expect(parseFilterQuery("vigencia:sin-fechas", CONFIGS).advancedFiltersByColumn).toEqual({
      loanInstallmentRange: { kind: "yearMonthRange", mode: "noValue" },
    });
    expect(parseFilterQuery("vigencia:2026-06", CONFIGS).advancedFiltersByColumn).toEqual({
      loanInstallmentRange: { kind: "yearMonthRange", max: 202606, min: 202606, mode: "range" },
    });
  });

  it("treats unknown keys as free text and reports them", () => {
    const parsed = parseFilterQuery("foo:bar", CONFIGS);

    expect(parsed.descriptionFilter).toBe("foo:bar");
    expect(parsed.invalidTokens).toEqual([{ raw: "foo:bar", reason: "unknownKey" }]);
  });

  it("ignores invalid values but reports them", () => {
    const parsed = parseFilterQuery("subtotal:abc vigencia:2026-13", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.invalidTokens).toEqual([
      { raw: "subtotal:abc", reason: "invalidValue" },
      { raw: "vigencia:2026-13", reason: "invalidValue" },
    ]);
  });

  it("does not apply negated qualifiers (unsupported in v1)", () => {
    const parsed = parseFilterQuery("-direccion:yo-debo", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.excludedDescriptionFilters).toEqual([]);
  });

  it("ignores incomplete qualifiers while typing", () => {
    const parsed = parseFilterQuery("subtotal: direccion:", CONFIGS);

    expect(parsed.advancedFiltersByColumn).toEqual({});
    expect(parsed.invalidTokens).toEqual([]);
  });
});

describe("serializeFilterQuery", () => {
  it("round-trips a mixed query into a canonical form", () => {
    const query = "luz subtotal:100..500 direccion:me-deben deuda:si vigencia:sin-fechas -agua";
    const parsed = parseFilterQuery(query, CONFIGS);

    expect(serializeFilterQuery(parsed, CONFIGS)).toBe(
      "luz subtotal:100..500 direccion:me-deben deuda:si vigencia:sin-fechas -agua",
    );
  });

  it("serializes single-bound numeric ranges and equality", () => {
    expect(
      serializeFilterQuery(parseFilterQuery("subtotal:>100", CONFIGS), CONFIGS),
    ).toBe("subtotal:>=100");
    expect(
      serializeFilterQuery(parseFilterQuery("subtotal:=100", CONFIGS), CONFIGS),
    ).toBe("subtotal:=100");
  });

  it("quotes excluded values that contain spaces", () => {
    const parsed = parseFilterQuery('-"super mercado"', CONFIGS);

    expect(serializeFilterQuery(parsed, CONFIGS)).toBe('-"super mercado"');
  });
});

describe("parseYearMonthSlug", () => {
  it("accepts valid year-month and rejects invalid months", () => {
    expect(parseYearMonthSlug("2026-06")).toBe(202606);
    expect(parseYearMonthSlug("2026-13")).toBeNull();
    expect(parseYearMonthSlug("nope")).toBeNull();
  });
});

describe("getActiveFilterToken", () => {
  it("returns key mode while typing a bare word", () => {
    const active = getActiveFilterToken("sub", 3);

    expect(active.mode).toBe("key");
    expect(active.keyPart).toBe("sub");
    expect(active).toMatchObject({ replaceStart: 0, replaceEnd: 3 });
  });

  it("returns value mode after a colon and replaces only the value", () => {
    const query = "subtotal:>1";
    const active = getActiveFilterToken(query, query.length);

    expect(active.mode).toBe("value");
    expect(active.resolvedKey).toBe("subtotal");
    expect(active.valuePart).toBe(">1");
    expect(query.slice(active.replaceStart, active.replaceEnd)).toBe(">1");
  });

  it("returns key mode at a caret sitting on whitespace", () => {
    const active = getActiveFilterToken("luz ", 4);

    expect(active.mode).toBe("key");
    expect(active.keyPart).toBe("");
  });

  it("tracks negation for the active token", () => {
    const active = getActiveFilterToken("-vigencia:", 10);

    expect(active.negated).toBe(true);
    expect(active.resolvedKey).toBe("vigencia");
  });
});
