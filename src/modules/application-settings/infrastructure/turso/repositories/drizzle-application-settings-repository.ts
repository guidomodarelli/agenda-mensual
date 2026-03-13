import { and, eq } from "drizzle-orm";

import {
  applicationSettingsDocumentsTable,
} from "@/modules/shared/infrastructure/database/drizzle/schema";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import type { StoredApplicationSettings } from "../../../domain/entities/stored-application-settings";
import type { ApplicationSettingsRepository } from "../../../domain/repositories/application-settings-repository";
import type { ApplicationSettingsDocument } from "../../../domain/value-objects/application-settings-document";

export class DrizzleApplicationSettingsRepository
  implements ApplicationSettingsRepository
{
  constructor(
    private readonly database: TursoDatabase,
    private readonly userSubject: string,
  ) {}

  async save(
    document: ApplicationSettingsDocument,
  ): Promise<StoredApplicationSettings> {
    await this.database
      .insert(applicationSettingsDocumentsTable)
      .values({
        content: document.content,
        mimeType: document.mimeType,
        name: document.name,
        updatedAtIso: new Date().toISOString(),
        userSubject: this.userSubject,
      })
      .onConflictDoUpdate({
        set: {
          content: document.content,
          mimeType: document.mimeType,
          updatedAtIso: new Date().toISOString(),
        },
        target: [
          applicationSettingsDocumentsTable.userSubject,
          applicationSettingsDocumentsTable.name,
        ],
        where: and(
          eq(applicationSettingsDocumentsTable.userSubject, this.userSubject),
          eq(applicationSettingsDocumentsTable.name, document.name),
        ),
      });

    return {
      id: `${this.userSubject}:${document.name}`,
      mimeType: document.mimeType,
      name: document.name,
    };
  }
}
