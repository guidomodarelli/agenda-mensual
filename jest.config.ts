import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Los tests de integración del expense sheet (Radix Select + userEvent en
  // jsdom) son pesados y rozan el límite por defecto; un margen mayor evita
  // timeouts intermitentes bajo carga de workers en paralelo.
  testTimeout: 20000,
  testEnvironment: "jsdom",
  testPathIgnorePatterns: [
    "<rootDir>/e2e/",
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
  ],
};

export default createJestConfig(config);
