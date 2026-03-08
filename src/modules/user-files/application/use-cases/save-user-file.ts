import {
  createUserFileUpload,
  type UserFileUpload,
} from "../../domain/value-objects/user-file-upload";
import type { UserFilesRepository } from "../../domain/repositories/user-files-repository";
import type { SaveUserFileCommand } from "../commands/save-user-file-command";
import {
  toStoredUserFileResult,
  type StoredUserFileResult,
} from "../results/stored-user-file-result";

interface SaveUserFileDependencies {
  command: SaveUserFileCommand;
  repository: UserFilesRepository;
}

export async function saveUserFile({
  command,
  repository,
}: SaveUserFileDependencies): Promise<StoredUserFileResult> {
  const validatedFile: UserFileUpload = createUserFileUpload(
    command,
    "Saving a user file",
  );

  return toStoredUserFileResult(await repository.save(validatedFile));
}
