import { saveApplicationSettings } from "@/modules/application-settings/application/use-cases/save-application-settings";
import { createApplicationSettingsApiHandler } from "@/modules/application-settings/infrastructure/api/create-application-settings-api-handler";
import { DrizzleApplicationSettingsRepository } from "@/modules/application-settings/infrastructure/turso/repositories/drizzle-application-settings-repository";

export default createApplicationSettingsApiHandler({
  async save({ command, database, userSubject }) {
    return saveApplicationSettings({
      command,
      repository: new DrizzleApplicationSettingsRepository(
        database,
        userSubject,
      ),
    });
  },
});
