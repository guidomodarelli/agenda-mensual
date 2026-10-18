/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  cleanupOrphanWebKitProcesses,
  parseProcessSnapshot,
  selectOrphanPlaywrightProcessIds,
} from "../../../scripts/playwright/orphan-webkit-processes.mjs";

/** Executable of a Playwright-managed WebKit build. */
const PLAYWRIGHT_NETWORK_PROCESS_PATH =
  "C:\\Users\\dev\\AppData\\Local\\ms-playwright\\webkit-2248\\Playwright\\WebKitNetworkProcess.exe";

/** GPU helper of a Playwright-managed WebKit build. */
const PLAYWRIGHT_GPU_PROCESS_PATH =
  "C:\\Users\\dev\\AppData\\Local\\ms-playwright\\webkit-2248\\WebKitGPUProcess.exe";

/** Main process of a Playwright-managed WebKit build. */
const PLAYWRIGHT_BROWSER_PROCESS_PATH =
  "C:\\Users\\dev\\AppData\\Local\\ms-playwright\\webkit-2248\\Playwright.exe";

/** Executable of a WebKit build not managed by Playwright. */
const FOREIGN_NETWORK_PROCESS_PATH = "C:\\Program Files\\Other\\WebKitNetworkProcess.exe";

/** Creation time of the WebKit helpers in the fixtures. */
const CHILD_CREATION_TIME_MS = 1_000_000;

/** Builds live processes created before the fixture WebKit helpers. */
function liveProcesses(...processIds: number[]) {
  return processIds.map((processId) => ({ processId, creationTimeMs: CHILD_CREATION_TIME_MS - 1 }));
}

/** Logger that records every warning and info message. */
function createRecordingLogger() {
  return { info: vi.fn(), warn: vi.fn() };
}

/** Clock whose `sleep` advances the time instantly instead of waiting. */
function createFakeClock() {
  let currentTimeMs = 0;

  return {
    now: () => currentTimeMs,
    sleep: vi.fn(async (durationMs: number) => {
      currentTimeMs += durationMs;
    }),
  };
}

/** Orphan WebKit helper with a dead parent, as returned by the snapshot query. */
function orphanSnapshot(processId: number) {
  return async () => ({
    processes: [
      { processId, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
    ],
    liveProcesses: liveProcesses(processId),
  });
}

describe("selectOrphanPlaywrightProcessIds", () => {
  it("selects a Playwright WebKit process whose parent no longer exists", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4100, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: liveProcesses(4, 4100),
    });

    expect(orphanProcessIds).toEqual([4100]);
  });

  it("keeps a Playwright WebKit process whose parent is still alive", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4100, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: liveProcesses(900, 4100),
    });

    expect(orphanProcessIds).toEqual([]);
  });

  it("selects a Playwright WebKit process whose parent id was reused by a newer process", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4100, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: [{ processId: 900, creationTimeMs: CHILD_CREATION_TIME_MS + 1 }],
    });

    expect(orphanProcessIds).toEqual([4100]);
  });

  it("keeps an orphan WebKit process outside the ms-playwright folder", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4200, parentProcessId: 901, executablePath: FOREIGN_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: liveProcesses(4200),
    });

    expect(orphanProcessIds).toEqual([]);
  });

  it("keeps processes with an unknown executable or parent", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4300, parentProcessId: 902, executablePath: null, creationTimeMs: CHILD_CREATION_TIME_MS },
        { processId: 4400, parentProcessId: null, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: liveProcesses(4300, 4400),
    });

    expect(orphanProcessIds).toEqual([]);
  });

  it("selects orphaned WebKit GPU and browser processes inside ms-playwright", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4700, parentProcessId: 903, executablePath: PLAYWRIGHT_GPU_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
        { processId: 4800, parentProcessId: 904, executablePath: PLAYWRIGHT_BROWSER_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: liveProcesses(4700, 4800),
    });

    expect(orphanProcessIds).toEqual([4700, 4800]);
  });

  it("selects helpers whose parent is an orphaned Playwright browser process", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4100, parentProcessId: 4800, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
        { processId: 4800, parentProcessId: 904, executablePath: PLAYWRIGHT_BROWSER_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS - 1 },
      ],
      liveProcesses: [{ processId: 4800, creationTimeMs: CHILD_CREATION_TIME_MS - 1 }],
    });

    expect(orphanProcessIds).toEqual([4100, 4800]);
  });

  it("keeps a process whose live parent has an unknown creation time", () => {
    const orphanProcessIds = selectOrphanPlaywrightProcessIds({
      processes: [
        { processId: 4100, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: [{ processId: 900, creationTimeMs: null }],
    });

    expect(orphanProcessIds).toEqual([]);
  });

  it("returns no process when the list is empty", () => {
    expect(selectOrphanPlaywrightProcessIds({ processes: [], liveProcesses: liveProcesses(4) })).toEqual([]);
  });
});

describe("parseProcessSnapshot", () => {
  it("normalizes the PowerShell snapshot, including single objects and missing lists", () => {
    const snapshot = parseProcessSnapshot(
      JSON.stringify({
        processes: {
          ProcessId: 4100,
          ParentProcessId: 900,
          ExecutablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH,
          CreationTimeMs: CHILD_CREATION_TIME_MS,
        },
        liveProcesses: [
          { ProcessId: 4, CreationTimeMs: null },
          { ProcessId: 4100, CreationTimeMs: CHILD_CREATION_TIME_MS },
        ],
      }),
    );

    expect(snapshot).toEqual({
      processes: [
        { processId: 4100, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
      liveProcesses: [
        { processId: 4, creationTimeMs: null },
        { processId: 4100, creationTimeMs: CHILD_CREATION_TIME_MS },
      ],
    });
    expect(
      parseProcessSnapshot(
        JSON.stringify({ processes: null, liveProcesses: { ProcessId: 4, CreationTimeMs: null } }),
      ),
    ).toEqual({ processes: [], liveProcesses: [{ processId: 4, creationTimeMs: null }] });
  });
});

describe("cleanupOrphanWebKitProcesses", () => {
  it("does nothing outside Windows", async () => {
    const queryProcessSnapshot = vi.fn();
    const terminateProcess = vi.fn();

    const result = await cleanupOrphanWebKitProcesses({
      platform: "linux",
      queryProcessSnapshot,
      terminateProcess,
      logger: createRecordingLogger(),
    });

    expect(result).toEqual({
      orphanProcessIds: [],
      terminatedProcessIds: [],
      stillRunningProcessIds: [],
      failedProcessIds: [],
    });
    expect(queryProcessSnapshot).not.toHaveBeenCalled();
    expect(terminateProcess).not.toHaveBeenCalled();
  });

  it("terminates only orphans and tolerates processes that cannot be closed", async () => {
    const terminateProcess = vi.fn((processId: number) => {
      if (processId === 4500) {
        throw Object.assign(new Error("access denied"), { code: "EPERM" });
      }
    });
    const logger = createRecordingLogger();

    const result = await cleanupOrphanWebKitProcesses({
      platform: "win32",
      queryProcessSnapshot: async () => ({
        processes: [
          { processId: 4100, parentProcessId: 900, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
          { processId: 4500, parentProcessId: 901, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
          { processId: 4600, parentProcessId: 77, executablePath: PLAYWRIGHT_NETWORK_PROCESS_PATH, creationTimeMs: CHILD_CREATION_TIME_MS },
        ],
        liveProcesses: liveProcesses(77, 4100, 4500, 4600),
      }),
      terminateProcess,
      queryProcessesById: async () => [],
      ...createFakeClock(),
      logger,
    });

    expect(result).toEqual({
      orphanProcessIds: [4100, 4500],
      terminatedProcessIds: [4100],
      stillRunningProcessIds: [],
      failedProcessIds: [4500],
    });
    expect(terminateProcess).not.toHaveBeenCalledWith(4600);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("4500"));
  });

  it("warns and resolves when the process query fails", async () => {
    const logger = createRecordingLogger();
    const terminateProcess = vi.fn();

    const result = await cleanupOrphanWebKitProcesses({
      platform: "win32",
      queryProcessSnapshot: async () => {
        throw new Error("powershell not found");
      },
      terminateProcess,
      logger,
    });

    expect(result).toEqual({
      orphanProcessIds: [],
      terminatedProcessIds: [],
      stillRunningProcessIds: [],
      failedProcessIds: [],
    });
    expect(terminateProcess).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("powershell not found"));
  });

  it("reports the orphans without closing them or waiting in a dry run", async () => {
    const logger = createRecordingLogger();
    const terminateProcess = vi.fn();
    const queryProcessesById = vi.fn();
    const clock = createFakeClock();

    const result = await cleanupOrphanWebKitProcesses({
      platform: "win32",
      dryRun: true,
      queryProcessSnapshot: orphanSnapshot(4100),
      terminateProcess,
      queryProcessesById,
      ...clock,
      logger,
    });

    expect(result).toEqual({
      orphanProcessIds: [4100],
      terminatedProcessIds: [],
      stillRunningProcessIds: [],
      failedProcessIds: [],
    });
    expect(terminateProcess).not.toHaveBeenCalled();
    expect(queryProcessesById).not.toHaveBeenCalled();
    expect(clock.sleep).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("4100"));
  });

  it("reports a process as closed once it disappears after being terminated", async () => {
    const logger = createRecordingLogger();
    const queryProcessesById = vi
      .fn()
      .mockResolvedValueOnce([{ processId: 4100, creationTimeMs: CHILD_CREATION_TIME_MS }])
      .mockResolvedValueOnce([]);

    const result = await cleanupOrphanWebKitProcesses({
      platform: "win32",
      queryProcessSnapshot: orphanSnapshot(4100),
      terminateProcess: vi.fn(),
      queryProcessesById,
      ...createFakeClock(),
      logger,
    });

    expect(result).toEqual({
      orphanProcessIds: [4100],
      terminatedProcessIds: [4100],
      stillRunningProcessIds: [],
      failedProcessIds: [],
    });
    expect(queryProcessesById).toHaveBeenCalledWith([4100]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns without failing when a terminated process is still present at the timeout", async () => {
    const logger = createRecordingLogger();
    const clock = createFakeClock();
    const queryProcessesById = vi.fn(async () => [
      { processId: 4100, creationTimeMs: CHILD_CREATION_TIME_MS },
    ]);

    const result = await cleanupOrphanWebKitProcesses({
      platform: "win32",
      queryProcessSnapshot: orphanSnapshot(4100),
      terminateProcess: vi.fn(),
      queryProcessesById,
      ...clock,
      logger,
    });

    expect(result).toEqual({
      orphanProcessIds: [4100],
      terminatedProcessIds: [],
      stillRunningProcessIds: [4100],
      failedProcessIds: [],
    });
    expect(clock.now()).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("4100"));
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("cerrados"));
  });

  it("counts a process as closed when its id now belongs to a different instance", async () => {
    const logger = createRecordingLogger();

    const result = await cleanupOrphanWebKitProcesses({
      platform: "win32",
      queryProcessSnapshot: orphanSnapshot(4100),
      terminateProcess: vi.fn(),
      queryProcessesById: async () => [{ processId: 4100, creationTimeMs: CHILD_CREATION_TIME_MS + 1 }],
      ...createFakeClock(),
      logger,
    });

    expect(result).toEqual({
      orphanProcessIds: [4100],
      terminatedProcessIds: [4100],
      stillRunningProcessIds: [],
      failedProcessIds: [],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
