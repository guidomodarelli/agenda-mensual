import {
  createApplicationSettingsDocument,
  type ApplicationSettingsDocument,
} from "../../domain/value-objects/application-settings-document";
import type { ApplicationSettingsRepository } from "../../domain/repositories/application-settings-repository";
import type { SaveApplicationSettingsCommand } from "../commands/save-application-settings-command";
import {
  toStoredApplicationSettingsResult,
  type StoredApplicationSettingsResult,
} from "../results/stored-application-settings-result";

interface SaveApplicationSettingsDependencies {
  command: SaveApplicationSettingsCommand;
  repository: ApplicationSettingsRepository;
}

export async function saveApplicationSettings({
  command,
  repository,
}: SaveApplicationSettingsDependencies): Promise<StoredApplicationSettingsResult> {
  const validatedDocument: ApplicationSettingsDocument =
    createApplicationSettingsDocument(command, "Saving application settings");

  return toStoredApplicationSettingsResult(
    await repository.save(validatedDocument),
  );
}
