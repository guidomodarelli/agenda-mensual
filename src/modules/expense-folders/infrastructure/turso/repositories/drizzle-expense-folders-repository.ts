import { asc, eq } from "drizzle-orm";

import { expenseFoldersTable } from "@/modules/shared/infrastructure/database/drizzle/schema";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import type { StoredExpenseFoldersCatalog } from "../../../domain/entities/stored-expense-folders-catalog";
import type { ExpenseFoldersRepository } from "../../../domain/repositories/expense-folders-repository";
import {
  createExpenseFoldersCatalogDocument,
  type ExpenseFolderColor,
  type ExpenseFolderIcon,
  type ExpenseFoldersCatalogDocument,
} from "../../../domain/value-objects/expense-folders-catalog-document";

const EXPENSE_FOLDERS_CATALOG_DOCUMENT_NAME = "expense-folders-catalog";

export class DrizzleExpenseFoldersRepository
  implements ExpenseFoldersRepository
{
  constructor(
    private readonly database: TursoDatabase,
    private readonly userSubject: string,
  ) {}

  async get(): Promise<ExpenseFoldersCatalogDocument | null> {
    const rows = await this.database
      .select({
        color: expenseFoldersTable.color,
        icon: expenseFoldersTable.icon,
        id: expenseFoldersTable.expenseFolderId,
        name: expenseFoldersTable.name,
        position: expenseFoldersTable.position,
      })
      .from(expenseFoldersTable)
      .where(eq(expenseFoldersTable.userSubject, this.userSubject))
      .orderBy(
        asc(expenseFoldersTable.position),
        asc(expenseFoldersTable.name),
      );

    if (rows.length === 0) {
      return null;
    }

    return createExpenseFoldersCatalogDocument(
      {
        folders: rows.map((row) => ({
          color: (row.color as ExpenseFolderColor | null) ?? null,
          icon: (row.icon as ExpenseFolderIcon | null) ?? null,
          id: row.id,
          name: row.name,
          position: row.position,
        })),
      },
      "Loading expense folders catalog from database",
    );
  }

  async save(
    document: ExpenseFoldersCatalogDocument,
  ): Promise<StoredExpenseFoldersCatalog> {
    const updatedAtIso = new Date().toISOString();

    await this.database.transaction(async (executor) => {
      await executor
        .delete(expenseFoldersTable)
        .where(eq(expenseFoldersTable.userSubject, this.userSubject));

      if (document.folders.length === 0) {
        return;
      }

      await executor.insert(expenseFoldersTable).values(
        document.folders.map((folder, index) => ({
          color: folder.color ?? null,
          createdAtIso: updatedAtIso,
          expenseFolderId: folder.id,
          icon: folder.icon ?? null,
          name: folder.name,
          position: folder.position ?? index,
          updatedAtIso,
          userSubject: this.userSubject,
        })),
      );
    });

    return {
      id: `${this.userSubject}:${EXPENSE_FOLDERS_CATALOG_DOCUMENT_NAME}`,
      name: EXPENSE_FOLDERS_CATALOG_DOCUMENT_NAME,
    };
  }
}
