import type { drive_v3 } from "googleapis";

import { mapGoogleDriveStorageError } from "@/modules/storage/infrastructure/google-drive/google-drive-storage-error";
import {
  findVisibleDriveFolder,
  getOrCreateVisibleDriveFolder,
} from "@/modules/storage/infrastructure/google-drive/visible-drive-folder";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpensesDocument } from "../../../domain/value-objects/monthly-expenses-document";
import {
  createMonthlyExpensesFileName,
  mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument,
  mapMonthlyExpensesDocumentToGoogleDriveFile,
  parseGoogleDriveMonthlyExpensesContent,
} from "../dto/mapper";

const CURRENT_MONTHLY_EXPENSES_FILE_PREFIX = "gastos-mensuales-";
const DRIVE_FILE_FIELDS = "id,name,mimeType,parents,webViewLink";
const DRIVE_FILES_CREATE_ENDPOINT = "drive.files.create";
const DRIVE_FILES_GET_ENDPOINT = "drive.files.get";
const DRIVE_FILES_LIST_ENDPOINT = "drive.files.list";
const DRIVE_FILES_UPDATE_ENDPOINT = "drive.files.update";
const LEGACY_MONTHLY_EXPENSES_FILE_PREFIX = "monthly-expenses-";

function escapeGoogleDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export class GoogleDriveMonthlyExpensesRepository
  implements MonthlyExpensesRepository
{
  constructor(private readonly driveClient: drive_v3.Drive) {}

  async getByMonth(month: string): Promise<MonthlyExpensesDocument | null> {
    const monthlyExpensesFolder = await findVisibleDriveFolder({
      driveClient: this.driveClient,
      operation:
        "google-drive-monthly-expenses-repository:getByMonth:findFolder",
    });
    const file =
      (await this.findFileByMonth(month, monthlyExpensesFolder?.id)) ??
      (await this.findLegacyFileByMonth(month));

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
    const monthlyExpensesFolder = await getOrCreateVisibleDriveFolder({
      driveClient: this.driveClient,
      operation: "google-drive-monthly-expenses-repository:save:getFolder",
    });
    const monthlyExpensesFolderId = monthlyExpensesFolder.id;

    if (!monthlyExpensesFolderId) {
      throw new Error(
        "google-drive-monthly-expenses-repository:save could not resolve a folder id for monthly expenses storage.",
      );
    }

    const existingFile = await this.findFileByMonth(
      document.month,
      monthlyExpensesFolderId,
    );
    const legacyFile = existingFile
      ? null
      : await this.findLegacyFileByMonth(document.month);
    const fileToUpdate = existingFile ?? legacyFile;

    try {
      if (fileToUpdate?.id) {
        const response = await this.driveClient.files.update({
          ...this.createUpdateRequest({
            file: fileToUpdate as drive_v3.Schema$File & { id: string },
            folderId: monthlyExpensesFolderId,
            serializedDocument,
          }),
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
          parents: [monthlyExpensesFolderId],
        },
      });

      return mapGoogleDriveMonthlyExpensesFileDtoToStoredDocument(
        response.data,
        document.month,
      );
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: fileToUpdate?.id
          ? DRIVE_FILES_UPDATE_ENDPOINT
          : DRIVE_FILES_CREATE_ENDPOINT,
        operation: "google-drive-monthly-expenses-repository:save",
      });
    }
  }

  async listAll(): Promise<MonthlyExpensesDocument[]> {
    const monthlyExpensesFolder = await findVisibleDriveFolder({
      driveClient: this.driveClient,
      operation: "google-drive-monthly-expenses-repository:listAll:findFolder",
    });
    const currentFiles = monthlyExpensesFolder?.id
      ? await this.listMonthlyExpenseFilesInFolder(monthlyExpensesFolder.id)
      : [];
    const legacyFiles = await this.listLegacyMonthlyExpenseFiles();
    const files = this.deduplicateFilesById([...currentFiles, ...legacyFiles]);

    return Promise.all(
      files
        .filter((file): file is NonNullable<typeof file> & { id: string } =>
          Boolean(file?.id),
        )
        .map(async (file) => {
          try {
            const response = await this.driveClient.files.get({
              alt: "media",
              fileId: file.id,
            });

            return parseGoogleDriveMonthlyExpensesContent(
              response.data,
              "Loading monthly expenses report",
            );
          } catch (error) {
            throw mapGoogleDriveStorageError(error, {
              endpoint: DRIVE_FILES_GET_ENDPOINT,
              operation: "google-drive-monthly-expenses-repository:listAll",
            });
          }
        }),
    );
  }

  private createUpdateRequest({
    file,
    folderId,
    serializedDocument,
  }: {
    file: drive_v3.Schema$File & { id: string };
    folderId: string;
    serializedDocument: ReturnType<typeof mapMonthlyExpensesDocumentToGoogleDriveFile>;
  }) {
    const currentParents = file.parents?.filter(Boolean) ?? [];
    const shouldAddFolderParent = !currentParents.includes(folderId);
    const removableParents = currentParents.filter(
      (parentId) => parentId !== folderId,
    );

    return {
      ...(shouldAddFolderParent ? { addParents: folderId } : {}),
      fields: DRIVE_FILE_FIELDS,
      fileId: file.id,
      media: {
        body: serializedDocument.content,
        mimeType: serializedDocument.mimeType,
      },
      ...(removableParents.length > 0
        ? { removeParents: removableParents.join(",") }
        : {}),
      requestBody: {
        name: serializedDocument.name,
      },
    };
  }

  private deduplicateFilesById(files: drive_v3.Schema$File[]) {
    return Array.from(
      new Map(
        files
          .filter((file): file is drive_v3.Schema$File & { id: string } =>
            Boolean(file.id),
          )
          .map((file) => [file.id, file]),
      ).values(),
    );
  }

  private async findFileByMonth(month: string, folderId?: string | null) {
    if (!folderId) {
      return null;
    }

    try {
      const response = await this.driveClient.files.list({
        fields: `files(${DRIVE_FILE_FIELDS})`,
        orderBy: "modifiedTime desc",
        pageSize: 1,
        q: `name = '${escapeGoogleDriveQueryValue(createMonthlyExpensesFileName(month))}' and '${escapeGoogleDriveQueryValue(folderId)}' in parents and trashed = false`,
      });

      return response.data.files?.[0] ?? null;
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_LIST_ENDPOINT,
        operation: "google-drive-monthly-expenses-repository:findFileByMonth",
      });
    }
  }

  private async findLegacyFileByMonth(month: string) {
    try {
      const response = await this.driveClient.files.list({
        fields: `files(${DRIVE_FILE_FIELDS})`,
        orderBy: "modifiedTime desc",
        pageSize: 1,
        q: `name = '${escapeGoogleDriveQueryValue(`${LEGACY_MONTHLY_EXPENSES_FILE_PREFIX}${month}.json`)}' and trashed = false`,
      });

      return response.data.files?.[0] ?? null;
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_LIST_ENDPOINT,
        operation:
          "google-drive-monthly-expenses-repository:findLegacyFileByMonth",
      });
    }
  }

  private async listMonthlyExpenseFilesInFolder(folderId: string) {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const response = await this.driveClient.files.list({
          fields: `files(${DRIVE_FILE_FIELDS}),nextPageToken`,
          orderBy: "name asc",
          pageSize: 100,
          pageToken,
          q: `name contains '${escapeGoogleDriveQueryValue(CURRENT_MONTHLY_EXPENSES_FILE_PREFIX)}' and '${escapeGoogleDriveQueryValue(folderId)}' in parents and trashed = false`,
        });

        files.push(...(response.data.files ?? []));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      return files;
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_LIST_ENDPOINT,
        operation:
          "google-drive-monthly-expenses-repository:listMonthlyExpenseFilesInFolder",
      });
    }
  }

  private async listLegacyMonthlyExpenseFiles() {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const response = await this.driveClient.files.list({
          fields: `files(${DRIVE_FILE_FIELDS}),nextPageToken`,
          orderBy: "name asc",
          pageSize: 100,
          pageToken,
          q: `name contains '${escapeGoogleDriveQueryValue(LEGACY_MONTHLY_EXPENSES_FILE_PREFIX)}' and trashed = false`,
        });

        files.push(...(response.data.files ?? []));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      return files;
    } catch (error) {
      throw mapGoogleDriveStorageError(error, {
        endpoint: DRIVE_FILES_LIST_ENDPOINT,
        operation:
          "google-drive-monthly-expenses-repository:listLegacyMonthlyExpenseFiles",
      });
    }
  }
}
