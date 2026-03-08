import type { drive_v3 } from "googleapis";

import { mapGoogleDriveStorageError } from "@/modules/storage/infrastructure/google-drive/google-drive-storage-error";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpensesDocument } from "../../../domain/value-objects/monthly-expenses-document";
import {
  createMonthlyExpensesFileName,
  mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument,
  mapMonthlyExpensesDocumentToGoogleDriveFile,
  parseGoogleDriveMonthlyExpensesContent,
} from "../dto/mapper";

const DRIVE_FILE_FIELDS = "id,name,mimeType,webViewLink";
const DRIVE_FILES_CREATE_ENDPOINT = "drive.files.create";
const DRIVE_FILES_GET_ENDPOINT = "drive.files.get";
const DRIVE_FILES_LIST_ENDPOINT = "drive.files.list";
const DRIVE_FILES_UPDATE_ENDPOINT = "drive.files.update";

function escapeGoogleDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export class GoogleDriveMonthlyExpensesRepository
  implements MonthlyExpensesRepository
{
  constructor(private readonly driveClient: drive_v3.Drive) {}

  async getByMonth(month: string): Promise<MonthlyExpensesDocument | null> {
    const file = await this.findFileByMonth(month);

    if (!file?.id) {
      return null;
    }

    try {
      const response = await this.driveClient.files.get({
        alt: "media",
        fileId: file.id,
      });

      return parseGoogleDriveMonthlyExpensesContent(
        response.data,
        "Loading monthly expenses",
      );
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_GET_ENDPOINT,
        operation: "google-drive-monthly-expenses-repository:getByMonth",
      });
    }
  }

  async save(
    document: MonthlyExpensesDocument,
  ): Promise<StoredMonthlyExpensesDocument> {
    const serializedDocument =
      mapMonthlyExpensesDocumentToGoogleDriveFile(document);
    const existingFile = await this.findFileByMonth(document.month);

    try {
      if (existingFile?.id) {
        const response = await this.driveClient.files.update({
          fields: DRIVE_FILE_FIELDS,
          fileId: existingFile.id,
          media: {
            body: serializedDocument.content,
            mimeType: serializedDocument.mimeType,
          },
          requestBody: {
            name: serializedDocument.name,
          },
        });

        return mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument(
          response.data,
          document.month,
        );
      }

      const response = await this.driveClient.files.create({
        fields: DRIVE_FILE_FIELDS,
        media: {
          body: serializedDocument.content,
          mimeType: serializedDocument.mimeType,
        },
        requestBody: {
          name: serializedDocument.name,
        },
      });

      return mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument(
        response.data,
        document.month,
      );
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: existingFile?.id
          ? DRIVE_FILES_UPDATE_ENDPOINT
          : DRIVE_FILES_CREATE_ENDPOINT,
        operation: "google-drive-monthly-expenses-repository:save",
      });
    }
  }

  private async findFileByMonth(month: string) {
    try {
      const response = await this.driveClient.files.list({
        fields: `files(${DRIVE_FILE_FIELDS})`,
        orderBy: "modifiedTime desc",
        pageSize: 1,
        q: `name = '${escapeGoogleDriveQueryValue(createMonthlyExpensesFileName(month))}' and trashed = false`,
      });

      return response.data.files?.[0] ?? null;
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_LIST_ENDPOINT,
        operation: "google-drive-monthly-expenses-repository:findFileByMonth",
      });
    }
  }
}
