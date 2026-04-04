import { and, asc, eq, sql } from "drizzle-orm";

import {
  monthlyExpensesDocumentsTable,
} from "@/modules/shared/infrastructure/database/drizzle/schema";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpensesDocument } from "../../../domain/value-objects/monthly-expenses-document";
import {
  createMonthlyExpensesFileName,
  mapMonthlyExpensesDocumentToGoogleDriveFile,
  parseGoogleDriveMonthlyExpensesContent,
} from "../../google-drive/dto/mapper";

export class DrizzleMonthlyExpensesRepository
  implements MonthlyExpensesRepository
{
  constructor(
    private readonly database: TursoDatabase,
    private readonly userSubject: string,
  ) {}

  async getByMonth(month: string): Promise<MonthlyExpensesDocument | null> {
    const rows = await this.database
      .select({
        payloadJson: monthlyExpensesDocumentsTable.payloadJson,
      })
      .from(monthlyExpensesDocumentsTable)
      .where(
        and(
          eq(monthlyExpensesDocumentsTable.userSubject, this.userSubject),
          eq(monthlyExpensesDocumentsTable.month, month),
        ),
      )
      .limit(1);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return parseGoogleDriveMonthlyExpensesContent(
      row.payloadJson,
      "Loading monthly expenses from database",
    );
  }

  async getOldestStoredMonth(): Promise<string | null> {
    const rows = await this.database
      .select({
        month: monthlyExpensesDocumentsTable.month,
      })
      .from(monthlyExpensesDocumentsTable)
      .where(eq(monthlyExpensesDocumentsTable.userSubject, this.userSubject))
      .orderBy(asc(monthlyExpensesDocumentsTable.month))
      .limit(1);

    return rows[0]?.month ?? null;
  }

  async save(
    document: MonthlyExpensesDocument,
  ): Promise<StoredMonthlyExpensesDocument> {
    const serializedDocument = mapMonthlyExpensesDocumentToGoogleDriveFile(document);

    await this.database
      .insert(monthlyExpensesDocumentsTable)
      .values({
        month: document.month,
        payloadJson: serializedDocument.content,
        updatedAtIso: new Date().toISOString(),
        userSubject: this.userSubject,
      })
      .onConflictDoUpdate({
        set: {
          payloadJson: serializedDocument.content,
          updatedAtIso: new Date().toISOString(),
        },
        target: [
          monthlyExpensesDocumentsTable.userSubject,
          monthlyExpensesDocumentsTable.month,
        ],
      });

    return {
      id: `${this.userSubject}:${document.month}`,
      month: document.month,
      name: serializedDocument.name,
      viewUrl: null,
    };
  }

  async listAll(): Promise<MonthlyExpensesDocument[]> {
    const rows = await this.database
      .select({
        payloadJson: monthlyExpensesDocumentsTable.payloadJson,
      })
      .from(monthlyExpensesDocumentsTable)
      .where(eq(monthlyExpensesDocumentsTable.userSubject, this.userSubject));

    return rows.map((row) =>
      parseGoogleDriveMonthlyExpensesContent(
        row.payloadJson,
        "Loading monthly expenses report from database",
      ),
    );
  }

  async listMonthsWithExpenses(): Promise<string[]> {
    const rows = await this.database
      .select({
        month: monthlyExpensesDocumentsTable.month,
      })
      .from(monthlyExpensesDocumentsTable)
      .where(
        and(
          eq(monthlyExpensesDocumentsTable.userSubject, this.userSubject),
          sql`json_array_length(json_extract(${monthlyExpensesDocumentsTable.payloadJson}, '$.items')) > 0`,
        ),
      );

    return rows.map((row) => row.month);
  }

  createFileName(month: string): string {
    return createMonthlyExpensesFileName(month);
  }
}
