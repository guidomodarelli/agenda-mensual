import { saveGlobalExchangeRateSettings } from "@/modules/exchange-rates/application/use-cases/save-global-exchange-rate-settings";
import { createGlobalExchangeRateSettingsApiHandler } from "@/modules/exchange-rates/infrastructure/api/create-global-exchange-rate-settings-api-handler";
import { DrizzleGlobalExchangeRateSettingsRepository } from "@/modules/exchange-rates/infrastructure/turso/repositories/drizzle-global-exchange-rate-settings-repository";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createGlobalExchangeRateSettingsApiHandler({
  save: async ({ command, database }) => {
    const repository = new DrizzleGlobalExchangeRateSettingsRepository(database);

    return saveGlobalExchangeRateSettings({
      command,
      repository,
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
