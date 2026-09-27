/**
 * Real Git fixtures shared by the release tooling tests: a bare `origin`, a
 * working clone and a second clone that pushes a migration the working clone
 * has not merged yet.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Real Git fixtures with a bare remote can exceed the default timeout on Windows. */
export const GIT_FIXTURE_TEST_TIMEOUT_MS = 60_000;

/** Git variables exported by hooks that would redirect fixture commands. */
const GIT_HOOK_ENVIRONMENT_VARIABLES = ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_PREFIX"];

/** Drizzle journal location inside a fixture repository. */
const JOURNAL_DIRECTORY_SEGMENTS = ["drizzle", "meta"];

type JournalEntry = { tag: string; when: number };

function createFixtureEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, HUSKY: "0" };

  for (const variableName of GIT_HOOK_ENVIRONMENT_VARIABLES) {
    delete environment[variableName];
  }

  return environment;
}

function spawnGit(gitArguments: string[], workingDirectory: string) {
  return spawnSync("git", gitArguments, { cwd: workingDirectory, encoding: "utf8", env: createFixtureEnvironment() });
}

function runGit(gitArguments: string[], workingDirectory: string): string {
  const result = spawnGit(gitArguments, workingDirectory);

  if (result.status !== 0) {
    throw new Error(`release-git-fixture: git ${gitArguments.join(" ")} failed in ${workingDirectory}: ${result.stderr}`);
  }

  return result.stdout.trim();
}

function writeJournal(repositoryRoot: string, entries: JournalEntry[]): void {
  const journalDirectory = path.join(repositoryRoot, ...JOURNAL_DIRECTORY_SEGMENTS);
  mkdirSync(journalDirectory, { recursive: true });
  writeFileSync(path.join(journalDirectory, "_journal.json"), JSON.stringify({ entries }));
}

function commitAll(repositoryRoot: string, message: string): void {
  runGit(["add", "-A"], repositoryRoot);
  runGit(["commit", "--quiet", "-m", message], repositoryRoot);
}

function cloneWithIdentity(remoteRoot: string, cloneRoot: string): void {
  runGit(["clone", "--quiet", remoteRoot, cloneRoot], path.dirname(remoteRoot));
  runGit(["config", "user.email", "release@example.test"], cloneRoot);
  runGit(["config", "user.name", "Release Fixture"], cloneRoot);
}

/**
 * Git reader with the `beez-rp create-version` hook contract, bound to a fixture.
 *
 * @param repositoryRoot - Fixture repository.
 * @returns Reader whose `tryGit` resolves `null` when Git fails.
 */
export function createFixtureGitReader(repositoryRoot: string) {
  return {
    git: async (gitArguments: string[]) => runGit(gitArguments, repositoryRoot),
    tryGit: async (gitArguments: string[]) => {
      const result = spawnGit(gitArguments, repositoryRoot);
      return result.status === 0 ? result.stdout.trimEnd() : null;
    },
  };
}

/**
 * Creates a clone whose `HEAD` has the baseline migration while `origin/main`
 * already received `0001_add_waitlist` from another clone.
 *
 * @returns Fixture root (to remove) and the working clone.
 */
export function createRepositoryWithIncomingMigration(): { fixtureRoot: string; repositoryRoot: string } {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "release-git-"));
  const remoteRoot = path.join(fixtureRoot, "origin.git");
  const repositoryRoot = path.join(fixtureRoot, "work");
  const otherClone = path.join(fixtureRoot, "other");

  runGit(["init", "--quiet", "--bare", "--initial-branch=main", remoteRoot], fixtureRoot);
  cloneWithIdentity(remoteRoot, repositoryRoot);
  runGit(["symbolic-ref", "HEAD", "refs/heads/main"], repositoryRoot);
  writeJournal(repositoryRoot, [{ tag: "0000_baseline", when: 1 }]);
  commitAll(repositoryRoot, "feat: add baseline schema");
  runGit(["push", "--quiet", "origin", "main"], repositoryRoot);

  cloneWithIdentity(remoteRoot, otherClone);
  writeJournal(otherClone, [
    { tag: "0000_baseline", when: 1 },
    { tag: "0001_add_waitlist", when: 2 },
  ]);
  commitAll(otherClone, "feat: add waitlist table");
  runGit(["push", "--quiet", "origin", "main"], otherClone);

  runGit(["fetch", "--quiet", "origin"], repositoryRoot);

  return { fixtureRoot, repositoryRoot };
}
