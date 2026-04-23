import { asc, eq } from "drizzle-orm";

import {
  lendersCatalogTable,
} from "@/modules/shared/infrastructure/database/drizzle/schema";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import type { StoredLendersCatalog } from "../../../domain/entities/stored-lenders-catalog";
import type { LendersRepository } from "../../../domain/repositories/lenders-repository";
import {
  createLendersCatalogDocument,
  type LenderType,
  type LendersCatalogDocument,
} from "../../../domain/value-objects/lenders-catalog-document";

const LENDERS_CATALOG_DOCUMENT_NAME = "lenders-catalog";

export class DrizzleLendersRepository implements LendersRepository {
  constructor(
    private readonly database: TursoDatabase,
    private readonly userSubject: string,
  ) {}

  async get(): Promise<LendersCatalogDocument | null> {
    const rows = await this.database
      .select({
        id: lendersCatalogTable.lenderId,
        name: lendersCatalogTable.name,
        notes: lendersCatalogTable.notes,
        type: lendersCatalogTable.type,
      })
      .from(lendersCatalogTable)
      .where(eq(lendersCatalogTable.userSubject, this.userSubject))
      .orderBy(asc(lendersCatalogTable.name));

    if (rows.length === 0) {
      return null;
    }

    return createLendersCatalogDocument(
      {
        lenders: rows.map((row) => ({
          ...(row.notes ? { notes: row.notes } : {}),
          id: row.id,
          name: row.name,
          type: row.type as LenderType,
        })),
      },
      "Loading lenders catalog from database",
    );
  }

  async save(document: LendersCatalogDocument): Promise<StoredLendersCatalog> {
    const updatedAtIso = new Date().toISOString();

    await this.database.transaction(async (executor) => {
      await executor
        .delete(lendersCatalogTable)
        .where(eq(lendersCatalogTable.userSubject, this.userSubject));

      if (document.lenders.length === 0) {
        return;
      }

      await executor.insert(lendersCatalogTable).values(
        document.lenders.map((lender) => ({
          ...(lender.notes ? { notes: lender.notes } : {}),
          lenderId: lender.id,
          name: lender.name,
          type: lender.type,
          updatedAtIso,
          userSubject: this.userSubject,
        })),
      );
    });

    return {
      id: `${this.userSubject}:lenders-catalog`,
      name: LENDERS_CATALOG_DOCUMENT_NAME,
    };
  }
}
