import type { StoredUserFile } from "../entities/stored-user-file";
import type { UserFileUpload } from "../value-objects/user-file-upload";

export interface UserFilesRepository {
  save(file: UserFileUpload): Promise<StoredUserFile>;
}
