import type { StoredUserFile } from "../../domain/entities/stored-user-file";

export interface StoredUserFileResult {
  id: string;
  mimeType: string;
  name: string;
  viewUrl: string | null;
}

export function toStoredUserFileResult(
  storedUserFile: StoredUserFile,
): StoredUserFileResult {
  return {
    id: storedUserFile.id,
    mimeType: storedUserFile.mimeType,
    name: storedUserFile.name,
    viewUrl: storedUserFile.viewUrl,
  };
}
