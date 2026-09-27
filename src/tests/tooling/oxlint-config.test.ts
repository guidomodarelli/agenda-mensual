/** @vitest-environment node */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type OxlintDiagnostic = { code: string; filename: string };
type OxlintOverride = { jsPlugins?: string[] };
type OxlintConfig = {
  overrides?: OxlintOverride[];
  settings: Record<string, unknown>;
};

const REPOSITORY_ROOT = process.cwd();
const OXLINT_CONFIG_FILE_NAME = ".oxlintrc.json";
const IMPORT_RESOLVER_SETTING = "import/resolver";
const TYPESCRIPT_RESOLVER_PACKAGE = "eslint-import-resolver-typescript";
const BOUNDARIES_DEPENDENCIES_CODE = "boundaries(dependencies)";
const BOUNDARIES_UNKNOWN_FILE_CODE = "boundaries(no-unknown-files)";
const SET_STATE_IN_EFFECT_CODE = "react(set-state-in-effect)";
/** Loading the JS plugin and resolving imports through TypeScript can be slow on a cold cache. */
const OXLINT_RUN_TIMEOUT_MS = 120_000;

const requireFromRepository = createRequire(path.join(REPOSITORY_ROOT, "package.json"));

/** Each fixture is written at its repository-relative path so the architecture elements apply. */
const FIXTURES = {
  infrastructureAdapter: {
    filePath: "src/modules/sample/infrastructure/sample-adapter.ts",
    source: "export const sampleAdapter = 1;\n",
  },
  domainValue: {
    filePath: "src/modules/sample/domain/sample-value.ts",
    source: "export const sampleValue = 1;\n",
  },
  domainImportingInfrastructureByAlias: {
    filePath: "src/modules/sample/domain/aliased-entity.ts",
    source: 'import { sampleAdapter } from "@/modules/sample/infrastructure/sample-adapter";\nexport const aliasedEntity = sampleAdapter;\n',
  },
  domainImportingInfrastructureRelatively: {
    filePath: "src/modules/sample/domain/relative-entity.ts",
    source: 'import { sampleAdapter } from "../infrastructure/sample-adapter";\nexport const relativeEntity = sampleAdapter;\n',
  },
  componentImportingDomain: {
    filePath: "src/components/sample-card.tsx",
    source: 'import { sampleValue } from "@/modules/sample/domain/sample-value";\nexport function SampleCard() {\n  return <p>{sampleValue}</p>;\n}\n',
  },
  applicationImportingDomain: {
    filePath: "src/modules/sample/application/sample-use-case.ts",
    source: 'import { sampleValue } from "@/modules/sample/domain/sample-value";\nexport const sampleUseCase = () => sampleValue;\n',
  },
  unclassifiedFile: {
    filePath: "src/unclassified/sample-helper.ts",
    source: "export const sampleHelper = 1;\n",
  },
  componentSettingStateInEffect: {
    filePath: "src/components/sample-toggle.tsx",
    source: [
      'import { useEffect, useState } from "react";',
      "export function SampleToggle() {",
      "  const [isReady, setIsReady] = useState(false);",
      "  useEffect(() => {",
      "    setIsReady(true);",
      "  }, []);",
      "  return <p>{String(isReady)}</p>;",
      "}",
      "",
    ].join("\n"),
  },
} as const;

let fixtureRoot: string;
let diagnosticsByFile: Map<string, string[]>;

/**
 * Copies the repository config next to the fixtures. Only what a temporary directory cannot
 * resolve on its own changes: the JS plugins, the import resolver and the tsconfig become absolute.
 */
function writeFixtureConfig(targetDirectory: string) {
  const config = JSON.parse(
    readFileSync(path.join(REPOSITORY_ROOT, OXLINT_CONFIG_FILE_NAME), "utf8"),
  ) as OxlintConfig;

  for (const override of config.overrides ?? []) {
    override.jsPlugins = override.jsPlugins?.map((pluginSpecifier) =>
      requireFromRepository.resolve(pluginSpecifier),
    );
  }

  const resolverSettings = config.settings[IMPORT_RESOLVER_SETTING] as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (resolverSettings?.typescript) {
    config.settings[IMPORT_RESOLVER_SETTING] = {
      [path.dirname(requireFromRepository.resolve(`${TYPESCRIPT_RESOLVER_PACKAGE}/package.json`))]: {
        ...resolverSettings.typescript,
        project: path.join(targetDirectory, "tsconfig.json"),
      },
    };
  }

  writeFileSync(path.join(targetDirectory, OXLINT_CONFIG_FILE_NAME), JSON.stringify(config));
  writeFileSync(
    path.join(targetDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", moduleResolution: "bundler", paths: { "@/*": ["./src/*"] } },
      include: ["src"],
    }),
  );
}

/** Runs the real oxlint binary once over every fixture and groups rule codes by file. */
function runOxlint(workingDirectory: string) {
  const oxlintBinary = path.join(
    path.dirname(requireFromRepository.resolve("oxlint/package.json")),
    "bin",
    "oxlint",
  );
  const filePaths = Object.values(FIXTURES).map((fixture) => fixture.filePath);
  const result = spawnSync(process.execPath, [oxlintBinary, "--format", "json", ...filePaths], {
    cwd: workingDirectory,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`oxlint-config test: failed to run ${oxlintBinary}`, { cause: result.error });
  }

  const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: OxlintDiagnostic[] };
  const groupedDiagnostics = new Map<string, string[]>();
  for (const diagnostic of diagnostics) {
    const normalizedFilePath = diagnostic.filename.replaceAll("\\", "/");
    groupedDiagnostics.set(normalizedFilePath, [
      ...(groupedDiagnostics.get(normalizedFilePath) ?? []),
      diagnostic.code,
    ]);
  }
  return groupedDiagnostics;
}

/** Returns the rule codes oxlint reported for one fixture. */
function lintCodesFor(fixture: { filePath: string }) {
  return diagnosticsByFile.get(fixture.filePath) ?? [];
}

beforeAll(() => {
  fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "oxlint-config-"));
  for (const fixture of Object.values(FIXTURES)) {
    const absoluteFilePath = path.join(fixtureRoot, fixture.filePath);
    mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    writeFileSync(absoluteFilePath, fixture.source);
  }
  writeFixtureConfig(fixtureRoot);
  diagnosticsByFile = runOxlint(fixtureRoot);
}, OXLINT_RUN_TIMEOUT_MS);

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("oxlint hexagonal boundaries", () => {
  it("rejects domain code importing infrastructure through the path alias", () => {
    expect(lintCodesFor(FIXTURES.domainImportingInfrastructureByAlias)).toContain(
      BOUNDARIES_DEPENDENCIES_CODE,
    );
  });

  it("rejects domain code importing infrastructure through a relative path", () => {
    expect(lintCodesFor(FIXTURES.domainImportingInfrastructureRelatively)).toContain(
      BOUNDARIES_DEPENDENCIES_CODE,
    );
  });

  it("rejects components importing domain code", () => {
    expect(lintCodesFor(FIXTURES.componentImportingDomain)).toContain(
      BOUNDARIES_DEPENDENCIES_CODE,
    );
  });

  it("allows application code to import domain code", () => {
    expect(lintCodesFor(FIXTURES.applicationImportingDomain)).not.toContain(
      BOUNDARIES_DEPENDENCIES_CODE,
    );
  });

  it("rejects files outside every architecture element", () => {
    expect(lintCodesFor(FIXTURES.unclassifiedFile)).toContain(BOUNDARIES_UNKNOWN_FILE_CODE);
  });
});

describe("oxlint React rules", () => {
  it("rejects setting state synchronously inside an effect", () => {
    expect(lintCodesFor(FIXTURES.componentSettingStateInEffect)).toContain(
      SET_STATE_IN_EFFECT_CODE,
    );
  });
});
