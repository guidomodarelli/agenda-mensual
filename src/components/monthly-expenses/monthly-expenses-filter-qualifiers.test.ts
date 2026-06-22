import type { ExpenseFolderOption } from "./expense-folder-picker";
import { buildMonthlyExpensesFilterQualifiers } from "./monthly-expenses-filter-qualifiers";

const EXPENSE_FOLDERS: ExpenseFolderOption[] = [
  { color: "blue", icon: "home", id: "folder-1", name: "Hogar" },
  { color: "violet", icon: "card", id: "folder-2", name: "Tarjeta" },
];

function buildQualifiers() {
  return buildMonthlyExpensesFilterQualifiers({ expenseFolders: EXPENSE_FOLDERS });
}

describe("buildMonthlyExpensesFilterQualifiers", () => {
  it("prepends the free-text description qualifier", () => {
    const [first] = buildQualifiers();

    expect(first).toEqual({ key: "", kind: "text", label: "Descripción" });
  });

  it("exposes the full catalog including column-less qualifiers", () => {
    const keys = buildQualifiers().map((qualifier) => qualifier.key);

    for (const key of [
      "subtotal",
      "total",
      "usd",
      "pagos",
      "registros",
      "enviados",
      "enviado",
      "cuotas-pagadas",
      "cuotas-restantes",
      "cuotas-total",
      "link",
      "prestamista",
      "direccion",
      "deuda",
      "inicio",
      "fin",
      "vigencia",
      "carpeta",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("uses the right kinds for the new text and folder qualifiers", () => {
    const byKey = new Map(
      buildQualifiers().map((qualifier) => [qualifier.key, qualifier]),
    );

    expect(byKey.get("link")?.kind).toBe("textMatch");
    expect(byKey.get("prestamista")?.kind).toBe("textMatch");
    expect(byKey.get("carpeta")?.kind).toBe("folder");
    expect(byKey.get("subtotal")?.kind).toBe("numberRange");
    expect(byKey.get("subtotal")?.columnId).toBeUndefined();
  });

  it("builds folder options from existing folders plus an unassigned slug", () => {
    const carpeta = buildQualifiers().find(
      (qualifier) => qualifier.key === "carpeta",
    );

    expect(carpeta?.options).toEqual([
      { label: "Sin carpeta", slug: "sin-carpeta", value: "__unassigned__" },
      { label: "Hogar", slug: "hogar", value: "folder-1" },
      { label: "Tarjeta", slug: "tarjeta", value: "folder-2" },
    ]);
  });

  it("derives direction enum options with typeable slugs", () => {
    const direction = buildQualifiers().find(
      (qualifier) => qualifier.key === "direccion",
    );

    expect(direction?.options).toEqual([
      { label: "Yo debo", slug: "yo-debo", value: "payable" },
      { label: "Me deben", slug: "me-deben", value: "receivable" },
      { label: "Sin deuda/préstamo", slug: "sin-deuda", value: "none" },
    ]);
  });
});
