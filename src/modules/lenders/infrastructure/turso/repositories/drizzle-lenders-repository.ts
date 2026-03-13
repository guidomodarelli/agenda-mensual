import { eq } from "drizzle-orm";

import {
  lendersCatalogDocumentsTable,
} from "@/modules/shared/infrastructure/database/drizzle/schema";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import type { StoredLendersCatalog } from "../../../domain/entities/stored-lenders-catalog";
import type { LendersRepository } from "../../../domain/repositories/lenders-repository";
import type { LendersCatalogDocument } from "../../../domain/value-objects/lenders-catalog-document";
import {
  mapLendersCatalogToGoogleDriveFile,
  parseGoogleDriveLendersCatalogContent,
} from "../../google-drive/dto/mapper";

const LENDERS_CATALOG_DOCUMENT_NAME = "lenders-catalog.json";

export class DrizzleLendersRepository implements LendersRepository {
  constructor(
    private readonly database: TursoDatabase,
    private readonly userSubject: string,
  ) {}

  async get(): Promise<LendersCatalogDocument | null> {
    const rows = await this.database
      .select({
        payloadJson: lendersCatalogDocumentsTable.payloadJson,
      })
      .from(lendersCatalogDocumentsTable)
      .where(eq(lendersCatalogDocumentsTable.userSubject, this.userSubject))
      .limit(1);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return parseGoogleDriveLendersCatalogContent(
      row.payloadJson,
      "Loading lenders catalog from database",
    );
  }

  async save(document: LendersCatalogDocument): Promise<StoredLendersCatalog> {
    const serializedDocument = mapLendersCatalogToGoogleDriveFile(document);

    await this.database
      .insert(lendersCatalogDocumentsTable)
      .values({
        payloadJson: serializedDocument.content,
        updatedAtIso: new Date().toISOString(),
        userSubject: this.userSubject,
      })
      .onConflictDoUpdate({
        set: {
          payloadJson: serializedDocument.content,
          updatedAtIso: new Date().toISOString(),
        },
        target: lendersCatalogDocumentsTable.userSubject,
      });

    return {
      id: `${this.userSubject}:lenders-catalog`,
      name: LENDERS_CATALOG_DOCUMENT_NAME,
    };
  }
}
