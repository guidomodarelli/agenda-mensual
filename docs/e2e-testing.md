# End-to-end tests

Playwright runs the browser suite under `e2e/` with `pnpm run test:e2e`.
`playwright.config.ts` defines the `chromium`, `webkit`, `chromium-mobile` and
`webkit-mobile` projects and boots the production build on port 3112.

## Orphaned WebKit processes on Windows

When a Playwright run that uses WebKit dies abruptly (an agent tool timeout, a
closed terminal session, `TerminateProcess`), Windows does not close the
children of the killed process and `globalTeardown` never runs. `Playwright.exe`
and its helpers (`WebKitNetworkProcess.exe`, `WebKitWebProcess.exe`,
`WebKitGPUProcess.exe`) under `%LOCALAPPDATA%\ms-playwright\webkit-*\` stay
alive without a parent and keep the repository (or worktree) folder locked as
their working directory.

The root cause is outside this repository: the browsers inherit the working
directory of the Playwright worker and Playwright has no option to change it,
and whoever kills the runner with `TerminateProcess` does not kill its process
tree. The cleanup below is a mitigation.

`scripts/playwright/orphan-webkit-processes.mjs` closes the leftovers:

- It is the `globalSetup` and `globalTeardown` of `playwright.config.ts`. The
  setup is the main case: it sweeps leftovers of earlier runs before the suite
  starts. The teardown frees the folder after a normal run, for example before
  removing a worktree.
- `pnpm run e2e:cleanup` runs the same cleanup on demand;
  `pnpm run e2e:cleanup -- --dry-run` only lists the orphans it would close.
- It only acts on `win32`; on other platforms it does nothing. A single
  PowerShell query lists the WebKit processes by name and then only their
  parents.
- It closes only WebKit processes whose executable lives inside an
  `ms-playwright` folder and whose parent process no longer exists. Windows
  reuses process ids, so a parent id now held by a process created after the
  child also counts as a dead parent, and a helper whose parent is an orphaned
  `Playwright.exe` is closed in the same pass. Processes with a live parent
  belong to a running browser and are never touched; when a creation time is
  unknown, the parent counts as alive.
- Right before closing, one batch query checks that each orphan is still the
  same instance as in the snapshot. An instance is the same process id with the
  same creation time. An orphan that already exited, or whose id now belongs to
  another process, is skipped and counts as closed; one whose creation time is
  unknown is not closed and is reported with a warning. If that check fails,
  nothing is closed. This narrows the window in which Windows could reuse an
  id, but cannot remove it: Node has no atomic "terminate only if the creation
  time matches".
- `TerminateProcess` can return before the process is gone, so after closing
  the orphans it waits up to 5 seconds, querying the pending ids in one batch
  every 250 ms, until each instance disappears; a reused id counts as closed.
  Each of those queries is bounded by the time left in the wait (at least
  250 ms), and none starts once the wait has expired. A process still present
  at the timeout is reported as still running: it may keep the folder locked
  until Windows restarts.
- A failed process query, or a process that cannot be closed (for example, one
  stuck while terminating), is logged as an `[e2e:cleanup]` warning and never
  fails the run.

There is no `exit` or `SIGINT` handler: an `exit` handler can only run
synchronous work, a forced termination skips it anyway, and an interrupted run
is cleaned by the next `globalSetup` or by `pnpm run e2e:cleanup`.
