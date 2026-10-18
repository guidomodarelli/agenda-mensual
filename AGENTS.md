# AGENTS

## 1. Security & Environment

### Security baseline

- Never hardcode secrets, OAuth credentials, refresh tokens, API keys, or user tokens in source code, tests, fixtures, screenshots, or documentation.
- Keep sensitive credentials only in environment variables and server-side secret storage.
- Treat Google access tokens and refresh tokens as server-only data. They must never be exposed to the browser, serialized in page props, or logged.
- Validate and sanitize all external input before it crosses into `application` or `domain`.
- Avoid leaking internal errors, stack traces, provider payloads, file identifiers, or token data in UI messages.

**rule file**: `.agentic-rules/nodejs/nodejs-security-patterns-rules_v1.md`

### OAuth and Google API security

- Configure OAuth scopes in both the Google Cloud consent screen and the application code.
- Use least privilege by default:
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/drive.file`
- Do not request `https://www.googleapis.com/auth/drive` unless there is an explicit product requirement for full My Drive access.
- Request offline access only from the server-side OAuth flow and persist refresh tokens securely.
- Use the Google callback path for App Router: `/api/auth/callback/google`.

## 2. Core Architecture

### Mandatory architecture

- Use `~/hexagonal-architecture` as the implementation reference when there is any doubt about structure, boundaries, ports, adapters, DTO placement, or testing strategy.

### Target structure

```text
src/
  app/
    api/
  modules/
    <feature>/
      domain/
        entities/
        value-objects/
        repositories/
      application/
        commands/
        queries/
        results/
        use-cases/
      infrastructure/
        api/
          dto/
          mapper.ts
        google-drive/
        next-auth/
        oauth/
        auth/
        repositories/
    shared/
      domain/
      application/
      infrastructure/
  components/
  lib/
  styles/
```

### Layer responsibilities

- `src/app/*`: route entrypoints and framework composition roots.
- `src/components/*`: presentational components by default.
- `infrastructure` hosts the Google APIs, authentication, storage, and HTTP adapters.

## 3. Bootstrap Standards

### Framework baseline

- The project must be built with Next.js using App Router.
- Use the official CLI to initialize the repository.
- Preferred bootstrap command:

```bash
npx create-next-app@latest . --ts --eslint --tailwind --src-dir --import-alias "@/*" --disable-git
```

- When prompted by the CLI, choose `Yes` for App Router.
- If the current directory is not compatible with direct initialization, scaffold into a temporary directory with the official CLI and then move the generated files into this repository without touching the existing `.git`.

### UI baseline

- Use the published `beez-ui` package for shared UI components; group named imports from `beez-ui`.
- Configure the Next.js adapter through `BeezUIProvider` from `beez-ui/next` in the application providers.
- Import `beez-ui/styles.css` once from the global stylesheet and use the library's default theme, including fonts and color tokens.
- Preserve the existing `theme` localStorage key and the sidebar preference contract through the application adapter.
- Add or customize shared shadcn/ui primitives in the sibling `beez-ui` repository using the official CLI there. Do not reintroduce local `components/ui` copies or `components.json`.
- Keep product-specific composition, upload workflows and SCSS in this application. See `docs/shared-ui.md` for integration boundaries.

### Receipt upload baseline

- Every new or updated **receipt upload flow** must use the `FileUpload`, `FileUploadDropZone`, `FileUploadList` and `FileUploadItem` components from `beez-ui` (or the project wrapper `ReceiptFileUploader` built on top of them) as the upload interaction baseline.
- Receipt uploads must support drag and drop plus click-to-select.
- When the upload implementation exposes progress, the UI must render it with the `FileUploadItem` progress UI instead of custom ad-hoc indicators.

### Toast notifications baseline

- Use `toast` and `ThemedToaster` from `beez-ui` as the standard notification system for user-facing events.
- Mount a global toaster once through `src/app/layout.tsx` providers and trigger notifications from page/container handlers.
- Select toast type by event intent:
  - `default`: neutral messages that acknowledge a relevant user action.
  - `success`: completed operations with expected result.
  - `info`: contextual updates that are not success/error states.
  - `warning`: validation issues or conditions requiring user attention.
  - `error`: failed operations and recoverable faults.
  - `promise`: async flows (`async/await`) to show loading, success, and failure lifecycle.
- Prefer `toast.promise` for write operations to keep async feedback consistent.
- Keep toast copy concise, clear, and safe: never expose secrets, raw provider payloads, tokens, or stack traces.
- Toasts complement existing UI feedback and must not break accessibility semantics (`aria-live`, alert roles, and form errors).

### Styling baseline

- `SCSS` is the styling solution for product code.
- Install Sass officially for Next.js support.
- Use:
  - `*.module.scss` for component-scoped styles
  - `src/styles/*` for global styles, tokens, mixins, and layout primitives
- Avoid inline styles except for rare runtime-only values.
- Tailwind remains available for existing product utilities. Shared beez-ui styles are precompiled; do not scan its source or node_modules. Product styling should default to `SCSS`.

## 4. SSR-First Data Flow

### Middleend rule

- Never pass Google API DTOs directly to page components.
- Never import bootstrap builders, OAuth config, Drive clients, or API error mappers from a generic `src/server` path.

## 5. Google OAuth and Drive Integration

### Authentication setup

- Prepare Google OAuth for user account connection through App Router.
- The default authentication adapter for this project is `next-auth` v4 with `GoogleProvider`, wired through App Router route handlers.
- Keep the NextAuth handler in `src/app/api/auth/[...nextauth]/route.ts`.
- Keep `authOptions`, OAuth config, token refresh logic, and Google client factories inside `src/modules/auth/infrastructure/*`.
- Wrap the application session boundary through providers mounted by `src/app/layout.tsx`.

### OAuth behavior

- The authorization flow must support offline access when long-lived Drive access is needed.
- Prefer server-managed OAuth code exchange and secure token persistence.
- Use custom sign-in and error pages when product UX requires it, but keep sensitive failure details out of the UI.

### Google Drive rules

- Store internal application data in the database (Turso), not in Drive app data storage.
- Use `drive.file` for user-visible files in My Drive.
- Keep Google SDK calls isolated in infrastructure adapters.
- Keep Google Drive error mapping and Drive client factories inside module infrastructure folders such as `src/modules/storage/infrastructure/*` and `src/modules/auth/infrastructure/*`.

### Technical error traceability (mandatory)

- Technical error codes use the format `E####` and live in the shared catalog under `src/modules/shared/infrastructure/errors/*`.
- API technical error envelopes return both `error` and `errorCode`.

## 6. Development Workflow

### Testing rules

- Tests for App Router pages, layouts, loading states, route handlers, and related helpers live under `src/tests/app/`. `src/tests/tooling/app-route-test-placement.test.ts` enforces it.

### Lint gate (mandatory)

- Every work item must run `pnpm run lint` before completion.
- A change is blocked from completion if `pnpm run lint` exits with a non-zero status.
- If lint fails, fix the reported issues in the same work item and rerun lint until it passes.
- Do not bypass lint failures with pending TODOs or deferred follow-ups.

### Quality gates (mandatory)

- Every work item must run the applicable checks before completion:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - The relevant targeted test command for the changed files
- Run `pnpm run test` instead of a targeted command when the changed files affect shared behavior, cross-module contracts, test setup, global configuration, or when no reliable targeted test command exists.
- Never remove `.next/dev/types/**/*.ts` from `tsconfig.json` includes. If stale generated dev types reference removed routes, regenerate or clean the generated Next.js artifacts instead of changing this include.
- A task is blocked from completion if any of these commands exits with a non-zero status code.
- If any check fails, fix the issues in the same work item and rerun the failed command(s) until all applicable checks are green.
- Do not defer these checks to follow-up tasks.

### SQL migrations push command (mandatory)

- Use `pnpm run push-migrations` as the single entrypoint to push SQL migrations.
- Do not run provider-specific migration push commands directly when this script exists.
- Keep provider selection inside `scripts/push-migrations.mjs` so the workflow stays consistent across providers.

### Release command

- Release with `pnpm create-version` (alias `pnpm cv`; `--bump patch|minor|major`, `--set-version X.Y.Z`, `--dry-run`). The command comes from the shared `beez-rp` package (`beez-rp create-version`); do not reintroduce a local release script.
- Keep what is specific to this project in `beez-rp.config.mjs`: banner name, CHANGELOG audience, release type descriptions, the Vercel deploy summary line and the migrations adapter.
- The migrations adapter lives in `scripts/release/pending-migrations.mjs`: it compares the Drizzle journal of `HEAD` and `origin/main` with the Turso/libSQL database that `pnpm run push-migrations` would change, and applies them through that same script.
- The configuration must not import `beez-rp` at runtime; type it with `@type {import("beez-rp/create-version").CreateVersionConfig}`.

## 7. Automation: Codex auto-fix loop

- **Before creating, relaunching, or modifying any Codex auto-fix loop, invoke the `codex-autofix-loop` skill first**. That skill is the source of truth for the local loop prompt, closeout behavior, runtime state, and CI parity with [`.github/workflows/codex-autofix.yml`](.github/workflows/codex-autofix.yml).

## 8. Implementation Checklist

- Is App Router still the routing mechanism?
- Are shared primitives imported from `beez-ui`, with no local shadcn/ui copies?
- Are product styles implemented with `SCSS`?
- Are Google tokens and secrets kept server-side only?
- Does `pnpm run lint` pass with exit code `0`?

### Test tooling

- Use pnpm 12.3.4 and the committed pnpm-lock.yaml. Install with `pnpm install --frozen-lockfile`.
- Use Vitest 5 for unit and integration tests; `pnpm test` runs once and `pnpm test:watch` watches.
- Run `pnpm typecheck:tests` against `tsconfig.test.json`; keep Vitest and Testing Library globals out of the application tsconfig.

## Runtime and compiler

- Use Node.js 24.21.0 from `.nvmrc` locally and in CI; `engines.node` permits only Node 24.
- TypeScript 7 is the project compiler for application tests and Next builds. Keep the separate `tsconfig.test.json` and run `pnpm typecheck:tests`.
- `.pnpmfile.cjs` supplies the official TypeScript 6 compatibility API privately to the typescript-eslint packages that `eslint-plugin-boundaries` and `eslint-import-resolver-typescript` still pull in for import resolution. Keep the root `typescript` dependency on version 7 and do not disable Next build type checking. Review the hook when those packages support the new compiler API.
- Lint runs with oxlint (`.oxlintrc.json`). `eslint-plugin-boundaries` runs as an oxlint JS plugin; its `boundaries/elements` and the TypeScript `import/resolver` must stay in the root `settings`, because oxlint ignores settings inside `overrides` and, without the resolver, boundaries silently allows every import. `src/tests/tooling/oxlint-config.test.ts` runs the real oxlint over fixtures and fails if boundaries stops reporting.
- CI reads `.nvmrc` and installs pnpm 12.3.4 explicitly. Update runtime pins, Node types and lockfiles together.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
