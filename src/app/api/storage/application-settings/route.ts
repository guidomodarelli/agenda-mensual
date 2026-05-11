import { saveApplicationSettings } from "@/modules/application-settings/application/use-cases/save-application-settings";
import { createApplicationSettingsApiHandler } from "@/modules/application-settings/infrastructure/api/create-application-settings-api-handler";
import { DrizzleApplicationSettingsRepository } from "@/modules/application-settings/infrastructure/turso/repositories/drizzle-application-settings-repository";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createApplicationSettingsApiHandler({
  async save({ command, database, userSubject }) {
    return saveApplicationSettings({
      command,
      repository: new DrizzleApplicationSettingsRepository(
        database,
        userSubject,
      ),
    });
  },
}));

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
