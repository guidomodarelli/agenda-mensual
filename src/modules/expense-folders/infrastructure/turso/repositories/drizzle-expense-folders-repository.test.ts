import { expenseFoldersTable } from "@/modules/shared/infrastructure/database/drizzle/schema";

import { DrizzleExpenseFoldersRepository } from "./drizzle-expense-folders-repository";

describe("DrizzleExpenseFoldersRepository", () => {
  it("returns null when the user has no folders", async () => {
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
    const repository = new DrizzleExpenseFoldersRepository(
      {
        select: selectMock,
      } as never,
      "google-user-123",
    );

    const result = await repository.get();

    expect(result).toBeNull();
    expect(orderByMock).toHaveBeenCalledTimes(1);
  });

  it("maps SQL rows into a validated folders catalog", async () => {
    const orderByMock = jest.fn().mockResolvedValue([
      {
        color: null,
        icon: null,
        id: "folder-1",
        name: "Servicios",
        position: 0,
      },
      {
        color: "blue",
        icon: "home",
        id: "folder-2",
        name: "  Hogar  ",
        position: 1,
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
    const repository = new DrizzleExpenseFoldersRepository(
      {
        select: selectMock,
      } as never,
      "google-user-123",
    );

    const result = await repository.get();

    expect(result).toEqual({
      folders: [
        {
          color: null,
          icon: null,
          id: "folder-1",
          name: "Servicios",
          position: 0,
        },
        {
          color: "blue",
          icon: "home",
          id: "folder-2",
          name: "Hogar",
          position: 1,
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
    const repository = new DrizzleExpenseFoldersRepository(
      {
        transaction: transactionMock,
      } as never,
      "google-user-123",
    );

    const result = await repository.save({
      folders: [
        {
          color: "blue",
          icon: "home",
          id: "folder-1",
          name: "Hogar",
          position: 0,
        },
      ],
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(expenseFoldersTable);
    expect(insertMock).toHaveBeenCalledWith(expenseFoldersTable);
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: "google-user-123:expense-folders-catalog",
      name: "expense-folders-catalog",
    });
  });
});
