/**
 * Closes WebKit processes left behind by Playwright runs that died abruptly
 * (tool timeout, closed session, `TerminateProcess`). On Windows, killing a
 * process does not kill its children and `globalTeardown` does not run when
 * the runner is terminated, so `Playwright.exe` and its `WebKit*Process.exe`
 * helpers survive without a parent and keep the repository folder locked as
 * their working directory.
 *
 * Only processes whose executable lives inside an `ms-playwright` folder and
 * whose parent process no longer exists are closed. Windows reuses process
 * ids, so a parent id now held by a process created after the child also
 * counts as a dead parent, and a helper whose parent is an orphan closed in
 * the same pass is an orphan too. A process with a live parent belongs to a
 * running browser and is never touched; when a creation time is unknown the
 * parent counts as alive. Right before closing, one batch query checks that
 * each orphan is still the same instance (same id and creation time) as in
 * the snapshot; an orphan that exited or whose id was reused is skipped and
 * counts as closed. On Windows `TerminateProcess` can return before the
 * process is gone, so a process only counts as closed once that same instance
 * disappears; one still present after a bounded wait is reported as still
 * running. Each liveness query during that wait is bounded by the time left.
 * On other platforms the cleanup is a no-op. Failures are logged as warnings and never break the Playwright run.
 *
 * The default export plugs into `globalSetup` and `globalTeardown` in
 * `playwright.config.ts`; `pnpm run e2e:cleanup` runs it on demand and
 * `pnpm run e2e:cleanup -- --dry-run` only lists the orphans it would close.
 *
 * @module orphan-webkit-processes
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** Platform where orphaned WebKit processes survive their runner. */
const WINDOWS_PLATFORM = "win32";

/** Folder where Playwright installs its browser builds. */
const PLAYWRIGHT_BROWSERS_FOLDER_NAME = "ms-playwright";

/** Executables of Playwright's WebKit build: the browser and its helpers. */
const WEBKIT_EXECUTABLE_NAMES = Object.freeze([
  "Playwright.exe",
  "WebKitNetworkProcess.exe",
  "WebKitWebProcess.exe",
  "WebKitGPUProcess.exe",
]);

/** {@link WEBKIT_EXECUTABLE_NAMES} lowercased for case-insensitive matching. */
const WEBKIT_EXECUTABLE_NAMES_LOWERCASE = new Set(
  WEBKIT_EXECUTABLE_NAMES.map((executableName) => executableName.toLowerCase()),
);

/** Maximum time for the PowerShell process query. */
const PROCESS_QUERY_TIMEOUT_MS = 30_000;

/** Maximum time to wait for terminated processes to disappear. */
const TERMINATION_WAIT_TIMEOUT_MS = 5_000;

/**
 * Shortest timeout given to a liveness query during the termination wait, so
 * a query started just before the deadline still has time to answer.
 */
const LIVENESS_QUERY_MIN_TIMEOUT_MS = 250;

/** Pause between two checks for terminated processes that are still present. */
const TERMINATION_POLL_INTERVAL_MS = 250;

/** Command-line flag that lists the orphans without closing them. */
const DRY_RUN_FLAG = "--dry-run";

/** Prefix that identifies this cleanup in the Playwright output. */
const LOG_PREFIX = "[e2e:cleanup]";

/** WQL filter that selects the WebKit processes by executable name. */
const WEBKIT_PROCESS_FILTER = WEBKIT_EXECUTABLE_NAMES.map(
  (executableName) => `Name=''${executableName}''`,
).join(" OR ");

/**
 * PowerShell script that prints, as JSON, the WebKit processes and only their
 * live parents, each with its creation time in Unix milliseconds. It skips the
 * parent query when there is no WebKit process.
 */
const PROCESS_SNAPSHOT_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$creationTimeMs = @{ Name = 'CreationTimeMs'; Expression = { if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { $null } } }",
  `$webKitProcesses = @(Get-CimInstance Win32_Process -Filter '${WEBKIT_PROCESS_FILTER}' -Property ProcessId,ParentProcessId,ExecutablePath,CreationDate | Select-Object ProcessId,ParentProcessId,ExecutablePath,$creationTimeMs)`,
  "$parentFilter = @($webKitProcesses | ForEach-Object { 'ProcessId=' + $_.ParentProcessId } | Sort-Object -Unique) -join ' OR '",
  "$liveProcesses = if ($parentFilter) { @(Get-CimInstance Win32_Process -Filter $parentFilter -Property ProcessId,CreationDate | Select-Object ProcessId,$creationTimeMs) } else { @() }",
  "ConvertTo-Json -Compress -Depth 3 -InputObject @{ processes = $webKitProcesses; liveProcesses = $liveProcesses }",
].join("; ");

/**
 * Builds the PowerShell script that prints, as JSON in the same shape as
 * {@link PROCESS_SNAPSHOT_SCRIPT}, the processes still alive among the given
 * ids with their creation time. One query covers the whole batch.
 *
 * @param {number[]} processIds - Integer process ids to look up.
 * @returns {string} PowerShell script.
 */
function buildProcessesByIdScript(processIds) {
  const processIdFilter = processIds.map((processId) => `ProcessId=${processId}`).join(" OR ");

  return [
    "$ErrorActionPreference = 'Stop'",
    "$creationTimeMs = @{ Name = 'CreationTimeMs'; Expression = { if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { $null } } }",
    `$liveProcesses = @(Get-CimInstance Win32_Process -Filter '${processIdFilter}' -Property ProcessId,CreationDate | Select-Object ProcessId,$creationTimeMs)`,
    "ConvertTo-Json -Compress -Depth 3 -InputObject @{ processes = @(); liveProcesses = $liveProcesses }",
  ].join("; ");
}

const execFileAsync = promisify(execFile);

/**
 * @typedef {object} WebKitProcess
 * @property {number | null} processId - Id of the WebKit process, or `null` when unknown.
 * @property {number | null} parentProcessId - Id of its parent, or `null` when unknown.
 * @property {string | null} executablePath - Absolute executable path, or `null` when unreadable.
 * @property {number | null} creationTimeMs - Creation time in Unix milliseconds, or `null` when unknown.
 */

/**
 * @typedef {WebKitProcess & { processId: number, parentProcessId: number }} IdentifiedWebKitProcess
 */

/**
 * @typedef {object} LiveProcess
 * @property {number} processId - Id of a process alive at query time.
 * @property {number | null} creationTimeMs - Creation time in Unix milliseconds, or `null` when unknown.
 */

/**
 * @typedef {object} ProcessSnapshot
 * @property {WebKitProcess[]} processes - WebKit processes found.
 * @property {LiveProcess[]} liveProcesses - Live processes among their parents.
 */

/**
 * @typedef {object} CleanupOutcome
 * @property {number[]} orphanProcessIds - Orphans found.
 * @property {number[]} terminatedProcessIds - Orphans confirmed closed.
 * @property {number[]} stillRunningProcessIds - Orphans terminated but still
 *   present when the wait timed out; they may keep the folder locked.
 * @property {number[]} failedProcessIds - Orphans that could not be closed.
 */

/**
 * Wraps a value that PowerShell may emit as a single object, a list or null.
 *
 * @param {unknown} value - Value read from the PowerShell JSON.
 * @returns {any[]} The value as a list.
 */
function toList(value) {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

/**
 * Reads an integer field (process id or creation time), keeping unknown
 * values as `null`.
 *
 * @param {unknown} value - Raw field value.
 * @returns {number | null} The integer, or `null` when it is not one.
 */
function toInteger(value) {
  return Number.isInteger(value) ? Number(value) : null;
}

/**
 * Parses the JSON printed by the PowerShell process query.
 *
 * @param {string} snapshotJson - Output of {@link PROCESS_SNAPSHOT_SCRIPT}.
 * @returns {ProcessSnapshot} Normalized snapshot.
 */
export function parseProcessSnapshot(snapshotJson) {
  const rawSnapshot = JSON.parse(snapshotJson);

  return {
    processes: toList(rawSnapshot?.processes).map((rawProcess) => ({
      processId: toInteger(rawProcess?.ProcessId),
      parentProcessId: toInteger(rawProcess?.ParentProcessId),
      executablePath:
        typeof rawProcess?.ExecutablePath === "string" ? rawProcess.ExecutablePath : null,
      creationTimeMs: toInteger(rawProcess?.CreationTimeMs),
    })),
    liveProcesses: toList(rawSnapshot?.liveProcesses)
      .map((rawProcess) => ({
        processId: toInteger(rawProcess?.ProcessId),
        creationTimeMs: toInteger(rawProcess?.CreationTimeMs),
      }))
      .filter((liveProcess) => liveProcess.processId !== null),
  };
}

/**
 * Tells whether a process is a WebKit executable installed by Playwright with
 * known process and parent ids.
 *
 * @param {WebKitProcess} webKitProcess - Process from the snapshot.
 * @returns {webKitProcess is IdentifiedWebKitProcess} `true` for an identified
 *   WebKit process inside an `ms-playwright` folder.
 */
function isIdentifiedPlaywrightWebKitProcess(webKitProcess) {
  if (
    webKitProcess.processId === null ||
    webKitProcess.parentProcessId === null ||
    !webKitProcess.executablePath
  ) {
    return false;
  }

  const pathSegments = webKitProcess.executablePath.toLowerCase().split(/[\\/]+/);

  return (
    pathSegments.includes(PLAYWRIGHT_BROWSERS_FOLDER_NAME) &&
    WEBKIT_EXECUTABLE_NAMES_LOWERCASE.has(pathSegments.at(-1) ?? "")
  );
}

/**
 * Tells whether the parent of a WebKit process may still be running. A live
 * process created after the child only reuses the dead parent's id; when
 * either creation time is unknown, a live process with that id counts as the
 * parent.
 *
 * @param {IdentifiedWebKitProcess} webKitProcess - WebKit process.
 * @param {Map<number, number | null>} liveCreationTimesById - Live parents by id.
 * @returns {boolean} `true` when the parent is alive or cannot be ruled out.
 */
function hasLiveParent(webKitProcess, liveCreationTimesById) {
  const parentCreationTimeMs = liveCreationTimesById.get(webKitProcess.parentProcessId);

  if (parentCreationTimeMs === undefined) {
    return false;
  }

  if (parentCreationTimeMs === null || webKitProcess.creationTimeMs === null) {
    return true;
  }

  return parentCreationTimeMs <= webKitProcess.creationTimeMs;
}

/**
 * Decides which processes are orphaned Playwright WebKit processes. Pure: it
 * only reads the snapshot. A process with an unknown id, parent or executable
 * is kept, so the decision errs on the side of not closing anything.
 *
 * @param {ProcessSnapshot} snapshot - WebKit processes and their live parents.
 * @returns {number[]} Ids of the processes to close, in snapshot order.
 */
export function selectOrphanPlaywrightProcessIds({ processes, liveProcesses }) {
  const liveCreationTimesById = new Map(
    liveProcesses.map((liveProcess) => [liveProcess.processId, liveProcess.creationTimeMs]),
  );
  const candidates = processes.filter(isIdentifiedPlaywrightWebKitProcess);
  const orphanProcessIds = new Set(
    candidates
      .filter((candidate) => !hasLiveParent(candidate, liveCreationTimesById))
      .map((candidate) => candidate.processId),
  );

  // A helper whose parent is an orphan closed in this pass is orphaned too.
  let previousOrphanCount = -1;
  while (orphanProcessIds.size !== previousOrphanCount) {
    previousOrphanCount = orphanProcessIds.size;
    for (const candidate of candidates) {
      if (orphanProcessIds.has(candidate.parentProcessId)) {
        orphanProcessIds.add(candidate.processId);
      }
    }
  }

  return candidates
    .map((candidate) => candidate.processId)
    .filter((processId) => orphanProcessIds.has(processId));
}

/**
 * Queries the WebKit processes and their live parents on Windows.
 *
 * @returns {Promise<ProcessSnapshot>} Current snapshot.
 */
async function queryWindowsProcessSnapshot() {
  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", PROCESS_SNAPSHOT_SCRIPT],
    { timeout: PROCESS_QUERY_TIMEOUT_MS, windowsHide: true },
  );

  return parseProcessSnapshot(stdout);
}

/**
 * @typedef {object} ProcessQueryOptions
 * @property {number} timeoutMs - Maximum time for the query.
 */

/**
 * Looks up which of the given processes are still alive on Windows.
 *
 * @param {number[]} processIds - Process ids to look up.
 * @param {ProcessQueryOptions} options - Query bounds.
 * @returns {Promise<LiveProcess[]>} The ones still alive.
 */
async function queryWindowsProcessesById(processIds, { timeoutMs }) {
  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", buildProcessesByIdScript(processIds)],
    { timeout: timeoutMs, windowsHide: true },
  );

  return parseProcessSnapshot(stdout).liveProcesses;
}

/**
 * Waits for the given duration.
 *
 * @param {number} durationMs - Time to wait.
 * @returns {Promise<void>}
 */
function sleepFor(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

/**
 * Tells whether a terminated process is still running as the same instance.
 * A live process with that id but another creation time reused the id; when
 * either creation time is unknown, the id alone counts.
 *
 * @param {LiveProcess} terminatedProcess - Process that was terminated.
 * @param {Map<number, number | null>} liveCreationTimesById - Live processes by id.
 * @returns {boolean} `true` while that instance is still present.
 */
function isSameInstanceAlive(terminatedProcess, liveCreationTimesById) {
  const liveCreationTimeMs = liveCreationTimesById.get(terminatedProcess.processId);

  if (liveCreationTimeMs === undefined) {
    return false;
  }

  if (liveCreationTimeMs === null || terminatedProcess.creationTimeMs === null) {
    return true;
  }

  return liveCreationTimeMs === terminatedProcess.creationTimeMs;
}

/**
 * Tells whether a live process is confirmed to be the same instance as the
 * snapshot process: same id and the same known creation time. Unlike
 * {@link isSameInstanceAlive}, an unknown creation time does not confirm it,
 * because this check decides whether to close the process.
 *
 * @param {LiveProcess} snapshotProcess - Process as seen in the snapshot.
 * @param {Map<number, number | null>} liveCreationTimesById - Live processes by id.
 * @returns {boolean} `true` only when the identity matches.
 */
function isConfirmedSameInstance(snapshotProcess, liveCreationTimesById) {
  const liveCreationTimeMs = liveCreationTimesById.get(snapshotProcess.processId);

  return (
    liveCreationTimeMs !== undefined &&
    liveCreationTimeMs !== null &&
    liveCreationTimeMs === snapshotProcess.creationTimeMs
  );
}

/**
 * Waits, up to a bounded timeout, for terminated processes to disappear,
 * querying the whole pending batch on each check. Each query is bounded by
 * the time left, never below {@link LIVENESS_QUERY_MIN_TIMEOUT_MS}, and no
 * query starts once the deadline has passed.
 *
 * @param {LiveProcess[]} terminatedProcesses - Processes terminated, with
 *   their creation time from the snapshot.
 * @param {object} dependencies - Process query and clock.
 * @param {(processIds: number[], options: ProcessQueryOptions) => Promise<LiveProcess[]>} dependencies.queryProcessesById - Batch lookup.
 * @param {(durationMs: number) => Promise<void>} dependencies.sleep - Pause between checks.
 * @param {() => number} dependencies.now - Current time in milliseconds.
 * @returns {Promise<number[]>} Ids of the processes still present at the timeout.
 */
async function waitForTermination(terminatedProcesses, { queryProcessesById, sleep, now }) {
  const deadlineMs = now() + TERMINATION_WAIT_TIMEOUT_MS;
  let pendingProcesses = terminatedProcesses;

  while (pendingProcesses.length > 0) {
    const remainingWaitMs = deadlineMs - now();

    if (remainingWaitMs <= 0) {
      break;
    }

    const liveProcesses = await queryProcessesById(
      pendingProcesses.map((pendingProcess) => pendingProcess.processId),
      {
        timeoutMs: Math.max(
          Math.min(PROCESS_QUERY_TIMEOUT_MS, remainingWaitMs),
          LIVENESS_QUERY_MIN_TIMEOUT_MS,
        ),
      },
    );
    const liveCreationTimesById = new Map(
      liveProcesses.map((liveProcess) => [liveProcess.processId, liveProcess.creationTimeMs]),
    );
    pendingProcesses = pendingProcesses.filter((pendingProcess) =>
      isSameInstanceAlive(pendingProcess, liveCreationTimesById),
    );

    if (pendingProcesses.length === 0 || now() >= deadlineMs) {
      break;
    }

    await sleep(TERMINATION_POLL_INTERVAL_MS);
  }

  return pendingProcesses.map((pendingProcess) => pendingProcess.processId);
}

/**
 * Describes an error for a log line without its stack.
 *
 * @param {unknown} error - Caught error.
 * @returns {string} Error code and message.
 */
function describeError(error) {
  const errorCode = error instanceof Error && "code" in error ? error.code : undefined;
  const errorMessage = error instanceof Error ? error.message : String(error);

  return errorCode ? `${errorCode}: ${errorMessage}` : errorMessage;
}

/**
 * Closes orphaned Playwright WebKit processes. Never throws: a failed query
 * or a process that cannot be closed (for example, one stuck while
 * terminating) is logged as a warning and the run continues.
 *
 * @param {object} [options] - Dependencies, replaceable in tests.
 * @param {string} [options.platform] - Platform to clean up; only `win32` acts.
 * @param {() => Promise<ProcessSnapshot>} [options.queryProcessSnapshot] - Process query.
 * @param {(processId: number) => void} [options.terminateProcess] - Closes one
 *   process; on Windows `process.kill` calls `TerminateProcess`.
 * @param {(processIds: number[], options: ProcessQueryOptions) => Promise<LiveProcess[]>} [options.queryProcessesById] -
 *   Batch lookup of the processes still alive, used right before closing the
 *   orphans and while waiting for them to disappear.
 * @param {(durationMs: number) => Promise<void>} [options.sleep] - Pause
 *   between termination checks.
 * @param {() => number} [options.now] - Current time in milliseconds.
 * @param {boolean} [options.dryRun] - Report the orphans without closing them.
 * @param {boolean} [options.reportClean] - Also log when no orphan is found,
 *   for manual runs.
 * @param {Pick<Console, "info" | "warn">} [options.logger] - Log sink.
 * @returns {Promise<CleanupOutcome>} Outcome.
 */
export async function cleanupOrphanWebKitProcesses({
  platform = process.platform,
  queryProcessSnapshot = queryWindowsProcessSnapshot,
  terminateProcess = (processId) => process.kill(processId),
  queryProcessesById = queryWindowsProcessesById,
  sleep = sleepFor,
  now = () => performance.now(),
  dryRun = false,
  reportClean = false,
  logger = console,
} = {}) {
  /** @type {CleanupOutcome} */
  const outcome = {
    orphanProcessIds: [],
    terminatedProcessIds: [],
    stillRunningProcessIds: [],
    failedProcessIds: [],
  };

  if (platform !== WINDOWS_PLATFORM) {
    return outcome;
  }

  let snapshot;

  try {
    snapshot = await queryProcessSnapshot();
  } catch (error) {
    logger.warn(
      `${LOG_PREFIX} no se pudieron listar los procesos de WebKit (${describeError(error)}); se omite la limpieza.`,
    );
    return outcome;
  }

  outcome.orphanProcessIds = selectOrphanPlaywrightProcessIds(snapshot);

  if (outcome.orphanProcessIds.length === 0) {
    if (reportClean) {
      logger.info(`${LOG_PREFIX} no hay procesos huérfanos de WebKit de Playwright.`);
    }
    return outcome;
  }

  if (dryRun) {
    logger.info(
      `${LOG_PREFIX} procesos huérfanos de WebKit de Playwright que se cerrarían: ${outcome.orphanProcessIds.join(", ")}.`,
    );
    return outcome;
  }

  const creationTimesById = new Map(
    snapshot.processes.map((webKitProcess) => [webKitProcess.processId, webKitProcess.creationTimeMs]),
  );
  /** @type {LiveProcess[]} */
  const orphanProcesses = outcome.orphanProcessIds.map((processId) => ({
    processId,
    creationTimeMs: creationTimesById.get(processId) ?? null,
  }));

  // Windows may reuse the id of an orphan that exited after the snapshot, so
  // each orphan is checked again right before closing it. This narrows the
  // race window but cannot remove it: Node has no atomic "terminate only if
  // the creation time still matches" without opening a process handle.
  /** @type {Map<number, number | null>} */
  let liveOrphanCreationTimesById;

  try {
    const liveOrphans = await queryProcessesById(outcome.orphanProcessIds, {
      timeoutMs: PROCESS_QUERY_TIMEOUT_MS,
    });
    liveOrphanCreationTimesById = new Map(
      liveOrphans.map((liveOrphan) => [liveOrphan.processId, liveOrphan.creationTimeMs]),
    );
  } catch (error) {
    outcome.failedProcessIds = [...outcome.orphanProcessIds];
    logger.warn(
      `${LOG_PREFIX} cleanupOrphanWebKitProcesses: no se pudo revalidar la identidad de los procesos huérfanos de WebKit ${outcome.orphanProcessIds.join(", ")} antes de cerrarlos (${describeError(error)}); no se cierra ninguno.`,
    );
    return outcome;
  }

  /** @type {LiveProcess[]} */
  const signaledProcesses = [];
  /** @type {number[]} */
  const alreadyGoneProcessIds = [];

  for (const orphanProcess of orphanProcesses) {
    const { processId } = orphanProcess;
    const liveCreationTimeMs = liveOrphanCreationTimesById.get(processId);

    if (liveCreationTimeMs === undefined) {
      alreadyGoneProcessIds.push(processId);
      continue;
    }

    if (liveCreationTimeMs === null || orphanProcess.creationTimeMs === null) {
      outcome.failedProcessIds.push(processId);
      logger.warn(
        `${LOG_PREFIX} cleanupOrphanWebKitProcesses: no se pudo confirmar la identidad del proceso huérfano de WebKit ${processId} (hora de inicio desconocida); no se cierra.`,
      );
      continue;
    }

    if (!isConfirmedSameInstance(orphanProcess, liveOrphanCreationTimesById)) {
      alreadyGoneProcessIds.push(processId);
      continue;
    }

    try {
      terminateProcess(processId);
      signaledProcesses.push(orphanProcess);
    } catch (error) {
      outcome.failedProcessIds.push(processId);
      logger.warn(
        `${LOG_PREFIX} no se pudo cerrar el proceso huérfano de WebKit ${processId} (${describeError(error)}).`,
      );
    }
  }

  if (signaledProcesses.length > 0) {
    try {
      outcome.stillRunningProcessIds = await waitForTermination(signaledProcesses, {
        queryProcessesById,
        sleep,
        now,
      });
    } catch (error) {
      outcome.stillRunningProcessIds = signaledProcesses.map(
        (signaledProcess) => signaledProcess.processId,
      );
      logger.warn(
        `${LOG_PREFIX} no se pudo confirmar el cierre de los procesos huérfanos de WebKit (${describeError(error)}).`,
      );
    }

  }

  const stillRunningProcessIds = new Set(outcome.stillRunningProcessIds);
  const closedProcessIds = new Set([
    ...alreadyGoneProcessIds,
    ...signaledProcesses.map((signaledProcess) => signaledProcess.processId),
  ]);
  outcome.terminatedProcessIds = outcome.orphanProcessIds.filter(
    (processId) => closedProcessIds.has(processId) && !stillRunningProcessIds.has(processId),
  );

  for (const processId of outcome.stillRunningProcessIds) {
    logger.warn(
      `${LOG_PREFIX} cleanupOrphanWebKitProcesses: el proceso huérfano de WebKit ${processId} sigue presente ${TERMINATION_WAIT_TIMEOUT_MS} ms después de cerrarlo; puede seguir bloqueando la carpeta hasta reiniciar Windows.`,
    );
  }

  if (outcome.terminatedProcessIds.length > 0) {
    logger.info(
      `${LOG_PREFIX} procesos huérfanos de WebKit de Playwright cerrados: ${outcome.terminatedProcessIds.join(", ")}.`,
    );
  }

  return outcome;
}

/**
 * Entry point for Playwright `globalSetup` and `globalTeardown`.
 *
 * @returns {Promise<void>}
 */
export default async function cleanupOrphanWebKitProcessesHook() {
  await cleanupOrphanWebKitProcesses();
}

/**
 * Tells whether this module is the script Node was started with. Compares
 * paths instead of using `import.meta.main`, which only exists from Node 24.2
 * while `engines.node` allows any Node 24.
 *
 * @returns {boolean} `true` when run as `node .../orphan-webkit-processes.mjs`.
 */
function isRunAsScript() {
  const scriptPath = process.argv[1];

  if (!scriptPath) {
    return false;
  }

  return (
    path.resolve(scriptPath).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
  );
}

if (isRunAsScript()) {
  if (process.platform !== WINDOWS_PLATFORM) {
    console.info(`${LOG_PREFIX} la limpieza solo aplica en Windows; no hay nada que hacer.`);
  }
  await cleanupOrphanWebKitProcesses({
    dryRun: process.argv.slice(2).includes(DRY_RUN_FLAG),
    reportClean: true,
  });
}
