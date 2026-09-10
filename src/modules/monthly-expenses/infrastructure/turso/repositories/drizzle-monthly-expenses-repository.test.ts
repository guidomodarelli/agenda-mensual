import { vi, describe, it, expect } from "vitest";
import {
  createEmptyMonthlyExpensesDocument,
  createMonthlyExpensesDocument,
} from "@/modules/monthly-expenses/domain/value-objects/monthly-expenses-document";
import {
  expenseMonthsTable,
  expensesTable,
  monthlyExpenseMonthsTable,
} from "@/modules/shared/infrastructure/database/drizzle/schema";

import { DrizzleMonthlyExpensesRepository } from "./drizzle-monthly-expenses-repository";

describe("DrizzleMonthlyExpensesRepository", () => {
  it("persists monthly metadata and normalized rows in a single transaction", async () => {
    const selectWhereMock = vi.fn().mockResolvedValue([]);
    const selectFromMock = vi.fn().mockReturnValue({
      where: selectWhereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      from: selectFromMock,
    });
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({
      where: deleteWhereMock,
    });
    const transactionExecutor = {
      delete: deleteMock,
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      select: selectMock,
    };
    const transactionMock = vi
      .fn()
      .mockImplementation(async function (callback: (tx: unknown) => Promise<void>) { return callback(transactionExecutor); },
      );
    const database = {
      transaction: transactionMock,
    };
    const repository = new DrizzleMonthlyExpensesRepository(
      database as never,
      "user-subject",
    );
    const document = createEmptyMonthlyExpensesDocument("2026-04");

    await repository.save(document);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(transactionExecutor.insert).toHaveBeenCalledWith(
      monthlyExpenseMonthsTable,
    );
    expect(transactionExecutor.insert).toHaveBeenCalledTimes(1);
  });

  it("stores incremental createdAt timestamps without overwriting conflicts", async () => {
    const insertedExpenseRows: { createdAtIso: string; expenseId: string }[] = [];
    const updatedExpenseRows: { expenseId: string; updatedFields: string[] }[] = [];
    const selectWhereMock = vi.fn().mockResolvedValue([]);
    const selectFromMock = vi.fn().mockReturnValue({
      where: selectWhereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      from: selectFromMock,
    });
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({
      where: deleteWhereMock,
    });
    const insertMock = vi.fn((table: unknown) => ({
      values: vi.fn((payload: unknown) => {
        const isExpenseInsert =
          table === expensesTable &&
          payload &&
          typeof payload === "object" &&
          "createdAtIso" in payload &&
          "expenseId" in payload;

        if (
          isExpenseInsert
        ) {
          insertedExpenseRows.push(
            payload as { createdAtIso: string; expenseId: string },
          );
        }

        return {
          onConflictDoUpdate: vi.fn((conflictPayload: unknown) => {
            if (
              isExpenseInsert &&
              conflictPayload &&
              typeof conflictPayload === "object" &&
              "set" in conflictPayload &&
              conflictPayload.set &&
              typeof conflictPayload.set === "object"
            ) {
              updatedExpenseRows.push({
                expenseId: String((payload as { expenseId: string }).expenseId),
                updatedFields: Object.keys(
                  conflictPayload.set as Record<string, unknown>,
                ),
              });
            }

            return Promise.resolve(undefined);
          }),
        };
      }),
    }));
    const transactionExecutor = {
      delete: deleteMock,
      insert: insertMock,
      select: selectMock,
    };
    const transactionMock = vi
      .fn()
      .mockImplementation(async function (callback: (tx: unknown) => Promise<void>) { return callback(transactionExecutor); },
      );
    const database = {
      transaction: transactionMock,
    };
    const repository = new DrizzleMonthlyExpensesRepository(
      database as never,
      "user-subject",
    );
    const document = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Expense Z",
            id: "z-id",
            occurrencesPerMonth: 1,
            subtotal: 10,
          },
          {
            currency: "ARS",
            description: "Expense A",
            id: "a-id",
            occurrencesPerMonth: 1,
            subtotal: 20,
          },
        ],
        month: "2026-04",
      },
      "Testing createdAt persistence order",
    );

    await repository.save(document);

    expect(insertedExpenseRows).toHaveLength(2);
    expect(insertedExpenseRows[0].expenseId).toBe("z-id");
    expect(insertedExpenseRows[1].expenseId).toBe("a-id");
    expect(insertedExpenseRows[0].createdAtIso).not.toBe(
      insertedExpenseRows[1].createdAtIso,
    );
    expect(insertedExpenseRows[0].createdAtIso < insertedExpenseRows[1].createdAtIso)
      .toBe(true);
    expect(updatedExpenseRows).toHaveLength(2);
    expect(updatedExpenseRows[0].expenseId).toBe("z-id");
    expect(updatedExpenseRows[1].expenseId).toBe("a-id");
    expect(updatedExpenseRows[0].updatedFields).not.toContain("createdAtIso");
    expect(updatedExpenseRows[1].updatedFields).not.toContain("createdAtIso");
  });

  it("persists recurrence columns on the expense row", async () => {
    const insertedExpenseRows: Record<string, unknown>[] = [];
    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    const insertMock = vi.fn((table: unknown) => ({
      values: vi.fn((payload: unknown) => {
        if (
          table === expensesTable &&
          payload &&
          typeof payload === "object" &&
          "expenseId" in payload
        ) {
          insertedExpenseRows.push(payload as Record<string, unknown>);
        }

        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));
    const transactionExecutor = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: insertMock,
      select: selectMock,
    };
    const database = {
      transaction: vi
        .fn()
        .mockImplementation(async function (callback: (tx: unknown) => Promise<void>) { return callback(transactionExecutor); },
        ),
    };
    const repository = new DrizzleMonthlyExpensesRepository(
      database as never,
      "user-subject",
    );
    const document = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Alquiler",
            id: "rent-id",
            occurrencesPerMonth: 1,
            recurrence: { startMonth: "2026-01", endMonth: "2026-06" },
            subtotal: 350000,
          },
          {
            currency: "ARS",
            description: "Internet",
            id: "internet-id",
            occurrencesPerMonth: 1,
            subtotal: 20000,
          },
        ],
        month: "2026-03",
      },
      "Testing recurrence persistence",
    );

    await repository.save(document);

    const recurringRow = insertedExpenseRows.find(
      (row) => row.expenseId === "rent-id",
    );
    const plainRow = insertedExpenseRows.find(
      (row) => row.expenseId === "internet-id",
    );
    expect(recurringRow?.recurrenceStartMonth).toBe("2026-01");
    expect(recurringRow?.recurrenceEndMonth).toBe("2026-06");
    expect(plainRow?.recurrenceStartMonth).toBeNull();
    expect(plainRow?.recurrenceEndMonth).toBeNull();
  });

  it("persists the usd rate columns on the expense row", async () => {
    const insertedExpenseRows: Record<string, unknown>[] = [];
    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    const insertMock = vi.fn((table: unknown) => ({
      values: vi.fn((payload: unknown) => {
        if (
          table === expensesTable &&
          payload &&
          typeof payload === "object" &&
          "expenseId" in payload
        ) {
          insertedExpenseRows.push(payload as Record<string, unknown>);
        }

        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));
    const transactionExecutor = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: insertMock,
      select: selectMock,
    };
    const database = {
      transaction: vi
        .fn()
        .mockImplementation(async function (callback: (tx: unknown) => Promise<void>) { return callback(transactionExecutor); },
        ),
    };
    const repository = new DrizzleMonthlyExpensesRepository(
      database as never,
      "user-subject",
    );
    const document = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "USD",
            description: "Suscripción custom",
            id: "custom-rate-id",
            occurrencesPerMonth: 1,
            subtotal: 10,
            usdRate: { base: "custom", customRate: 1480.5 },
          },
          {
            currency: "USD",
            description: "Suscripción blue",
            id: "blue-rate-id",
            occurrencesPerMonth: 1,
            subtotal: 15,
            usdRate: { appliesIibb: true, appliesIva: true, base: "blue" },
          },
          {
            currency: "USD",
            description: "Suscripción default",
            id: "default-rate-id",
            occurrencesPerMonth: 1,
            subtotal: 20,
          },
        ],
        month: "2026-03",
      },
      "Testing usd rate persistence",
    );

    await repository.save(document);

    const customRow = insertedExpenseRows.find(
      (row) => row.expenseId === "custom-rate-id",
    );
    const blueRow = insertedExpenseRows.find(
      (row) => row.expenseId === "blue-rate-id",
    );
    const defaultRow = insertedExpenseRows.find(
      (row) => row.expenseId === "default-rate-id",
    );
    expect(customRow?.usdRateBase).toBe("custom");
    expect(customRow?.customUsdRate).toBe(1480.5);
    expect(customRow?.usdRateAppliesIibb).toBe(0);
    expect(customRow?.usdRateAppliesIva).toBe(0);
    expect(blueRow?.usdRateBase).toBe("blue");
    expect(blueRow?.customUsdRate).toBeNull();
    expect(blueRow?.usdRateAppliesIibb).toBe(1);
    expect(blueRow?.usdRateAppliesIva).toBe(1);
    expect(defaultRow?.usdRateBase).toBeNull();
    expect(defaultRow?.customUsdRate).toBeNull();
    expect(defaultRow?.usdRateAppliesIibb).toBeNull();
    expect(defaultRow?.usdRateAppliesIva).toBeNull();
  });

  it("orders normalized reads by created timestamp and expense id", async () => {
    const metadataLimitMock = vi.fn().mockResolvedValue([]);
    const metadataWhereMock = vi.fn().mockReturnValue({
      limit: metadataLimitMock,
    });
    const orderByMock = vi.fn().mockResolvedValue([]);
    const expensesWhereMock = vi.fn().mockReturnValue({
      orderBy: orderByMock,
    });
    const innerJoinMock = vi.fn().mockReturnValue({
      where: expensesWhereMock,
    });
    const excludedLoansWhereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({
        where: metadataWhereMock,
      })
      .mockReturnValueOnce({
        where: excludedLoansWhereMock,
      })
      .mockReturnValueOnce({
        innerJoin: innerJoinMock,
      });
    const selectMock = vi.fn().mockReturnValue({
      from: fromMock,
    });
    const database = {
      select: selectMock,
    };
    const repository = new DrizzleMonthlyExpensesRepository(
      database as never,
      "user-subject",
    );

    await (repository as unknown as {
      getByMonthFromNormalized: (month: string) => Promise<unknown>;
    }).getByMonthFromNormalized("2026-04");

    expect(orderByMock).toHaveBeenCalledTimes(1);
    expect(orderByMock.mock.calls[0]).toHaveLength(2);
  });

  it("returns an empty document when monthly metadata exists without expense rows", async () => {
    const metadataLimitMock = vi.fn().mockResolvedValue([
      {
        exchangeRateBlueRate: 1200,
        exchangeRateMonth: "2026-04",
        exchangeRateOfficialRate: 1000,
        exchangeRateSolidarityRate: 1300,
        month: "2026-04",
      },
    ]);
    const metadataWhereMock = vi.fn().mockReturnValue({
      limit: metadataLimitMock,
    });
    const expensesOrderByMock = vi.fn().mockResolvedValue([]);
    const expensesWhereMock = vi.fn().mockReturnValue({
      orderBy: expensesOrderByMock,
    });
    const innerJoinMock = vi.fn().mockReturnValue({
      where: expensesWhereMock,
    });
    const excludedLoansWhereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({
        where: metadataWhereMock,
      })
      .mockReturnValueOnce({
        where: excludedLoansWhereMock,
      })
      .mockReturnValueOnce({
        innerJoin: innerJoinMock,
      });
    const selectMock = vi.fn().mockReturnValue({
      from: fromMock,
    });
    const repository = new DrizzleMonthlyExpensesRepository(
      {
        select: selectMock,
      } as never,
      "user-subject",
    );

    const result = await (repository as unknown as {
      getByMonthFromNormalized: (
        month: string,
      ) => Promise<ReturnType<typeof createEmptyMonthlyExpensesDocument> | null>;
    }).getByMonthFromNormalized("2026-04");

    expect(result).toEqual(
      createMonthlyExpensesDocument(
        {
          exchangeRateSnapshot: {
            blueRate: 1200,
            month: "2026-04",
            officialRate: 1000,
            solidarityRate: 1300,
          },
          items: [],
          month: "2026-04",
        },
        "Testing empty monthly metadata reads",
      ),
    );
  });

  it("returns a document carrying the month's excluded loan ids when only exclusions exist", async () => {
    const metadataLimitMock = vi.fn().mockResolvedValue([]);
    const metadataWhereMock = vi.fn().mockReturnValue({
      limit: metadataLimitMock,
    });
    const excludedLoansWhereMock = vi
      .fn()
      .mockResolvedValue([{ expenseId: "loan-1" }]);
    const expensesOrderByMock = vi.fn().mockResolvedValue([]);
    const expensesWhereMock = vi.fn().mockReturnValue({
      orderBy: expensesOrderByMock,
    });
    const innerJoinMock = vi.fn().mockReturnValue({
      where: expensesWhereMock,
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({
        where: metadataWhereMock,
      })
      .mockReturnValueOnce({
        where: excludedLoansWhereMock,
      })
      .mockReturnValueOnce({
        innerJoin: innerJoinMock,
      });
    const selectMock = vi.fn().mockReturnValue({
      from: fromMock,
    });
    const repository = new DrizzleMonthlyExpensesRepository(
      {
        select: selectMock,
      } as never,
      "user-subject",
    );

    const result = await (repository as unknown as {
      getByMonthFromNormalized: (
        month: string,
      ) => Promise<ReturnType<typeof createEmptyMonthlyExpensesDocument> | null>;
    }).getByMonthFromNormalized("2026-04");

    expect(result).toEqual(
      createMonthlyExpensesDocument(
        {
          excludedLoanIds: ["loan-1"],
          items: [],
          month: "2026-04",
        },
        "Testing excluded-loan reads",
      ),
    );
  });

  it("rejects duplicated expense ids before starting persistence", async () => {
    const transactionMock = vi.fn();
    const repository = new DrizzleMonthlyExpensesRepository(
      {
        transaction: transactionMock,
      } as never,
      "user-subject",
    );
    const duplicatedIdsDocument = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Expense A",
            id: "duplicated-id",
            occurrencesPerMonth: 1,
            subtotal: 100,
          },
          {
            currency: "ARS",
            description: "Expense B",
            id: "duplicated-id",
            occurrencesPerMonth: 2,
            subtotal: 200,
          },
        ],
        month: "2026-04",
      },
      "Testing duplicated expense ids persistence",
    );

    await expect(repository.save(duplicatedIdsDocument)).rejects.toThrow(
      "Saving monthly expenses requires unique expense ids before persisting SQL rows.",
    );

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns normalized documents without checking the legacy JSON table", async () => {
    const repository = new DrizzleMonthlyExpensesRepository(
      {} as never,
      "user-subject",
    );
    const normalizedDocument = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Single normalized item",
            id: "duplicated-id",
            occurrencesPerMonth: 1,
            subtotal: 100,
          },
        ],
        month: "2026-04",
      },
      "Testing normalized result",
    );
    vi.spyOn(
      repository as unknown as {
        getByMonthFromNormalized: (
          month: string,
        ) => Promise<typeof normalizedDocument>;
      },
      "getByMonthFromNormalized",
    ).mockResolvedValue(normalizedDocument);

    const result = await repository.getByMonth("2026-04");

    expect(result).toEqual(normalizedDocument);
  });

  it("persists the occurrences unit for normalized expense months", async () => {
    const insertedExpenseMonthRows: Array<{
      expenseId: string;
      occurrencesUnit: string | null;
    }> = [];
    const selectWhereMock = vi.fn().mockResolvedValue([]);
    const selectFromMock = vi.fn().mockReturnValue({
      where: selectWhereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      from: selectFromMock,
    });
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({
      where: deleteWhereMock,
    });
    const insertMock = vi.fn((table: unknown) => ({
      values: vi.fn((payload: unknown) => {
        if (
          table === expenseMonthsTable &&
          payload &&
          typeof payload === "object" &&
          "occurrencesUnit" in payload
        ) {
          insertedExpenseMonthRows.push(
            payload as { expenseId: string; occurrencesUnit: string | null },
          );
        }

        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    }));
    const transactionExecutor = {
      delete: deleteMock,
      insert: insertMock,
      select: selectMock,
    };
    const transactionMock = vi
      .fn()
      .mockImplementation(async function (callback: (tx: unknown) => Promise<void>) { return callback(transactionExecutor); },
      );
    const repository = new DrizzleMonthlyExpensesRepository(
      { transaction: transactionMock } as never,
      "user-subject",
    );
    const document = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Clases de ingles",
            id: "with-unit",
            occurrencesPerMonth: 4,
            occurrencesUnit: "semanas",
            subtotal: 5000,
          },
          {
            currency: "ARS",
            description: "Internet",
            id: "without-unit",
            occurrencesPerMonth: 1,
            subtotal: 100,
          },
        ],
        month: "2026-04",
      },
      "Testing occurrences unit persistence",
    );

    await repository.save(document);

    const unitByExpenseId = new Map(
      insertedExpenseMonthRows.map((row) => [row.expenseId, row.occurrencesUnit]),
    );

    expect(unitByExpenseId.get("with-unit")).toBe("semanas");
    expect(unitByExpenseId.get("without-unit")).toBeNull();
  });
});

describe("DrizzleMonthlyExpensesRepository.refreshExchangeRateSolidarityForMonth", () => {
  async function createInMemoryDatabase() {
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    const path = await import("node:path");
    const schema = await import(
      "@/modules/shared/infrastructure/database/drizzle/schema"
    );

    const client = createClient({ url: ":memory:" });
    const database = drizzle(client, { schema });

    await migrate(database, {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });

    return database;
  }

  function buildMonthlyRow(overrides: {
    userSubject: string;
    month: string;
    exchangeRateOfficialRate: number | null;
    exchangeRateSolidarityRate: number | null;
  }) {
    return {
      exchangeRateBlueRate: 1500,
      exchangeRateMonth: overrides.month,
      exchangeRateOfficialRate: overrides.exchangeRateOfficialRate,
      exchangeRateSolidarityRate: overrides.exchangeRateSolidarityRate,
      hasReplicatedFromPreviousMonth: 0,
      month: overrides.month,
      updatedAtIso: "2026-03-01T00:00:00.000Z",
      userSubject: overrides.userSubject,
    };
  }

  it("recomputes the frozen solidario only for the acting user and month", async () => {
    const database = await createInMemoryDatabase();
    const { monthlyExpenseMonthsTable } = await import(
      "@/modules/shared/infrastructure/database/drizzle/schema"
    );

    await database.insert(monthlyExpenseMonthsTable).values([
      buildMonthlyRow({
        userSubject: "user-1",
        month: "2026-03",
        exchangeRateOfficialRate: 1000,
        exchangeRateSolidarityRate: 1210,
      }),
      buildMonthlyRow({
        userSubject: "user-1",
        month: "2026-04",
        exchangeRateOfficialRate: 1000,
        exchangeRateSolidarityRate: 1210,
      }),
      buildMonthlyRow({
        userSubject: "user-2",
        month: "2026-03",
        exchangeRateOfficialRate: 1000,
        exchangeRateSolidarityRate: 1210,
      }),
      buildMonthlyRow({
        userSubject: "user-1",
        month: "2026-05",
        exchangeRateOfficialRate: null,
        exchangeRateSolidarityRate: null,
      }),
    ]);

    const repository = new DrizzleMonthlyExpensesRepository(
      database as never,
      "user-1",
    );

    // Multiplicador = 1 + 0.05 (IIBB) + 0.21 (IVA) = 1.26.
    await repository.refreshExchangeRateSolidarityForMonth({
      month: "2026-03",
      solidarityMultiplier: 1.26,
    });

    const rows = await database.select().from(monthlyExpenseMonthsTable);
    const byKey = new Map(
      rows.map((row) => [`${row.userSubject}:${row.month}`, row]),
    );

    // 1000 × 1.26 = 1260 para el usuario y mes objetivo.
    expect(byKey.get("user-1:2026-03")?.exchangeRateSolidarityRate).toBeCloseTo(
      1260,
    );
    // Otro mes del mismo usuario: intacto.
    expect(byKey.get("user-1:2026-04")?.exchangeRateSolidarityRate).toBe(1210);
    // Otro usuario, mismo mes: intacto.
    expect(byKey.get("user-2:2026-03")?.exchangeRateSolidarityRate).toBe(1210);
    // Fila sin oficial congelado: intacta (null).
    expect(byKey.get("user-1:2026-05")?.exchangeRateSolidarityRate).toBeNull();
  });
});
