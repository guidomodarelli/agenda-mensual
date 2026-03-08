import type { StoredApplicationSettings } from "../../domain/entities/stored-application-settings";

export interface StoredApplicationSettingsResult {
  id: string;
  mimeType: string;
  name: string;
}

export function toStoredApplicationSettingsResult(
  storedApplicationSettings: StoredApplicationSettings,
): StoredApplicationSettingsResult {
  return {
    id: storedApplicationSettings.id,
    mimeType: storedApplicationSettings.mimeType,
    name: storedApplicationSettings.name,
  };
}
