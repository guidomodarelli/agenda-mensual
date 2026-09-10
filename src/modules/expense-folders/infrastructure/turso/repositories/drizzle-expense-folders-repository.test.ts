import { vi, describe, it, expect } from "vitest";
import { expenseFoldersTable } from "@/modules/shared/infrastructure/database/drizzle/schema";

import { DrizzleExpenseFoldersRepository } from "./drizzle-expense-folders-repository";

describe("DrizzleExpenseFoldersRepository", () => {
  it("returns null when the user has no folders", async () => {
    const orderByMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({
      orderBy: orderByMock,
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
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
    const orderByMock = vi.fn().mockResolvedValue([
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
    const whereMock = vi.fn().mockReturnValue({
      orderBy: orderByMock,
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
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
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn().mockReturnValue({
      values: insertValuesMock,
    });
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockReturnValue({
      where: deleteWhereMock,
    });
    const transactionExecutor = {
      delete: deleteMock,
      insert: insertMock,
    };
    const transactionMock = vi
      .fn()
      .mockImplementation(async function (callback: (tx: unknown) => Promise<void>) { return callback(transactionExecutor); },
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
