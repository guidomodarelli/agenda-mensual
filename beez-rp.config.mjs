/**
 * Configuration of `pnpm create-version` (`beez-rp create-version`): what is
 * specific to Control Mensual on top of the release process shared through
 * `beez-rp`. Releases ship from `main`; the version change makes Vercel build
 * and deploy production (`scripts/ignore-build.sh`).
 *
 * Pending migrations are checked against the Turso/libSQL database that
 * `pnpm run push-migrations` would change, reading the Drizzle journal of the
 * current branch and of `origin/main`.
 *
 * Only types come from `beez-rp`; every helper arrives through the hook context.
 *
 * @module beez-rp.config
 */

import { checkPendingMigrations, readMigrationJournalAt } from "./scripts/release/pending-migrations.mjs";

/** Revisions whose migration journals are merged: the branch and the one about to be released. */
const MIGRATION_JOURNAL_REVISIONS = ["HEAD", "origin/main"];

/** Lint, typecheck (source and tests), tests and build shared with CI; a failure stops the release before the bump. */
const RELEASE_CHECKS_COMMAND = "pnpm run ci";

/**
 * Migration command shared with `pnpm run push-migrations`, run with the same
 * Node.js binary as the release command.
 */
const PUSH_MIGRATIONS_COMMAND = `"${process.execPath}" scripts/push-migrations.mjs`;

/** @type {import("beez-rp/create-version").CreateVersionConfig} */
const createVersionConfig = {
  projectName: "Control Mensual",
  changelog: { audience: "quien usa Control Mensual para administrar sus gastos", language: "es" },
  releaseTypeDescriptions: {
    patch: "Solo arreglos o cambios internos; nada nuevo para quien usa la app.",
    minor: "Funcionalidades o mejoras nuevas; lo existente sigue funcionando igual.",
    major: "Cambio grande o incompatible: flujos, datos o comportamiento que cambian para los usuarios.",
  },
  publishedLabel: "en producción",
  checks: [RELEASE_CHECKS_COMMAND],
  migrations: {
    targetHint: "TURSO_DATABASE_URL del .env",
    async check({ repositoryRoot, git }) {
      const journalEntries = await readMigrationJournalAt(git, MIGRATION_JOURNAL_REVISIONS);
      return checkPendingMigrations({ repositoryRoot, journalEntries });
    },
    async apply({ run, fail }) {
      const exitCode = await run(PUSH_MIGRATIONS_COMMAND);

      if (exitCode !== 0) {
        fail(`drizzle-kit migrate falló con código ${exitCode}.`, "Revisá el error de arriba; no se subió ninguna versión.");
      }
    },
  },
  summary: ["Deploy: Vercel detecta el cambio de versión y buildea producción."],
};

export default createVersionConfig;
