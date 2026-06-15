import { spawnSync } from "node:child_process";

/**
 * @typedef {{
 *   command: string;
 *   args: string[];
 *   description: string;
 *   usesShell: boolean;
 * }} MigrationPushCommand
 */

/**
 * Resolves the migration push command for the configured database provider.
 *
 * @param {string} provider
 * @returns {MigrationPushCommand}
 */
function resolvePushCommand(provider) {
  /** @type {Record<string, MigrationPushCommand>} */
  const providerCommands = {
    turso: {
      args: ["drizzle-kit", "migrate"],
      command: "npx",
      description: "Push SQL migrations using drizzle-kit against Turso/libSQL.",
      usesShell: false,
    },
  };

  const configuredCommand = process.env.DB_PUSH_MIGRATIONS_COMMAND;
  if (configuredCommand && configuredCommand.trim().length > 0) {
    return {
      args: [configuredCommand],
      command: process.platform === "win32" ? "cmd" : "sh",
      description: "Push SQL migrations using DB_PUSH_MIGRATIONS_COMMAND.",
      usesShell: true,
    };
  }

  const normalizedProvider = provider.trim().toLowerCase();
  const selectedCommand = providerCommands[normalizedProvider];

  if (selectedCommand) {
    return selectedCommand;
  }

  const availableProviders = Object.keys(providerCommands).join(", ");
  throw new Error(
    `Unsupported DB provider "${provider}". Available providers: ${availableProviders}. ` +
      "You can also set DB_PUSH_MIGRATIONS_COMMAND to define a custom command.",
  );
}

/**
 * Executes the push migrations command and forwards its output to the current process.
 *
 * @param {MigrationPushCommand} commandConfig
 * @returns {number}
 */
function executePushCommand(commandConfig) {
  const isWindows = process.platform === "win32";
  const args =
    commandConfig.usesShell
      ? isWindows
        ? ["/d", "/s", "/c", commandConfig.args[0]]
        : ["-lc", commandConfig.args[0]]
      : commandConfig.args;

  // On Windows, executables resolved via PATHEXT (e.g. `npx.cmd`) are only
  // found by spawnSync when it goes through the shell. The custom-command path
  // already builds an explicit `cmd`/`sh` invocation, so it must not double-wrap.
  const useShell = !commandConfig.usesShell && isWindows;

  // With `shell: true`, passing args separately triggers DEP0190; join them into
  // the command string instead. Args here are static, not external input.
  const spawnCommand = useShell
    ? [commandConfig.command, ...args].join(" ")
    : commandConfig.command;
  const spawnArgs = useShell ? [] : args;

  const executionResult = spawnSync(spawnCommand, spawnArgs, {
    env: process.env,
    shell: useShell,
    stdio: "inherit",
  });

  if (executionResult.error) {
    throw executionResult.error;
  }

  return executionResult.status ?? 1;
}

const databaseProvider = process.env.DB_PROVIDER ?? process.env.DATABASE_PROVIDER ?? "turso";
const migrationCommand = resolvePushCommand(databaseProvider);

console.log(`[push-migrations] Provider: ${databaseProvider}`);
console.log(`[push-migrations] Strategy: ${migrationCommand.description}`);

const exitCode = executePushCommand(migrationCommand);
if (exitCode !== 0) {
  console.error(`[push-migrations] Migration push failed with exit code ${exitCode}.`);
  process.exit(exitCode);
}

console.log("[push-migrations] Migration push completed successfully.");
