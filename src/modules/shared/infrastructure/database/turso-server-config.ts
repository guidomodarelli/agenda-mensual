import { z } from "zod";

const tursoServerEnvironmentSchema = z.object({
  TURSO_AUTH_TOKEN: z.string().trim().min(1),
  TURSO_DATABASE_URL: z.string().trim().min(1),
});

export interface TursoServerConfig {
  authToken: string;
  url: string;
}

export class TursoConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TursoConfigurationError";
  }
}

export function getTursoServerConfig(): TursoServerConfig | null {
  const parsedEnvironment = tursoServerEnvironmentSchema.safeParse({
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  });

  if (!parsedEnvironment.success) {
    return null;
  }

  return {
    authToken: parsedEnvironment.data.TURSO_AUTH_TOKEN,
    url: parsedEnvironment.data.TURSO_DATABASE_URL,
  };
}

export function requireTursoServerConfig(): TursoServerConfig {
  const config = getTursoServerConfig();

  if (!config) {
    throw new TursoConfigurationError(
      "turso-server-config:missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN server configuration.",
    );
  }

  return config;
}
