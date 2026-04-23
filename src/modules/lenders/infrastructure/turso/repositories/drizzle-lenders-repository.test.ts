import { lendersCatalogTable } from "@/modules/shared/infrastructure/database/drizzle/schema";

import { DrizzleLendersRepository } from "./drizzle-lenders-repository";

describe("DrizzleLendersRepository", () => {
  it("returns null when the user has no lenders", async () => {
    const orderByMock = jest.fn().mockResolvedValue([]);
    const whereMock = jest.fn().mockReturnValue({
      orderBy: orderByMock,
    });
    const fromMock = jest.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = jest.fn().mockReturnValue({
      from: fromMock,
    });
    const repository = new DrizzleLendersRepository(
      {
        select: selectMock,
      } as never,
      "google-user-123",
    );

    const result = await repository.get();

    expect(result).toBeNull();
    expect(orderByMock).toHaveBeenCalledTimes(1);
  });

  it("maps SQL rows into a validated lenders catalog", async () => {
    const orderByMock = jest.fn().mockResolvedValue([
      {
        id: "lender-2",
        name: "  Papa  ",
        notes: "  Tarjeta  ",
        type: "family",
      },
      {
        id: "lender-1",
        name: "Banco",
        notes: null,
        type: "bank",
      },
    ]);
    const whereMock = jest.fn().mockReturnValue({
      orderBy: orderByMock,
    });
    const fromMock = jest.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = jest.fn().mockReturnValue({
      from: fromMock,
    });
    const repository = new DrizzleLendersRepository(
      {
        select: selectMock,
      } as never,
      "google-user-123",
    );

    const result = await repository.get();

    expect(result).toEqual({
      lenders: [
        {
          id: "lender-1",
          name: "Banco",
          type: "bank",
        },
        {
          id: "lender-2",
          name: "Papa",
          notes: "Tarjeta",
          type: "family",
        },
      ],
    });
  });

  it("replaces the user catalog in a single transaction", async () => {
    const insertValuesMock = jest.fn().mockResolvedValue(undefined);
    const insertMock = jest.fn().mockReturnValue({
      values: insertValuesMock,
    });
    const deleteWhereMock = jest.fn().mockResolvedValue(undefined);
    const deleteMock = jest.fn().mockReturnValue({
      where: deleteWhereMock,
    });
    const transactionExecutor = {
      delete: deleteMock,
      insert: insertMock,
    };
    const transactionMock = jest
      .fn()
      .mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
        callback(transactionExecutor),
      );
    const repository = new DrizzleLendersRepository(
      {
        transaction: transactionMock,
      } as never,
      "google-user-123",
    );

    const result = await repository.save({
      lenders: [
        {
          id: "lender-1",
          name: "Banco",
          type: "bank",
        },
      ],
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(lendersCatalogTable);
    expect(insertMock).toHaveBeenCalledWith(lendersCatalogTable);
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: "google-user-123:lenders-catalog",
      name: "lenders-catalog",
    });
  });
});
