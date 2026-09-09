# Shared UI

Control Mensual consumes the published `beez-ui` package. Shared components and
filter contracts use grouped named imports from `beez-ui`. The package owns the
former `src/components/ui` implementations; their existing behavioral tests now
exercise the package from `src/tests/shared-ui`.

`AppProviders` composes NextAuth's session provider with `BeezUIProvider` from
`beez-ui/next`. The theme uses the library's default colors, radii and self-hosted
fonts. The existing `theme` preference key, system default and light/dark choices
remain intact. `ThemedToaster` shares that theme context. Next.js transpiles the
published package, including for the real-component Jest integration tests.
Application navigation uses the shared `Link` and its Next adapter, with prefetch
disabled by default. The month query remains part of the expenses link.

`globals.css` imports the library's browser-ready stylesheet once. Tailwind stays
for existing product utilities and Untitled UI upload components; it does not scan
beez-ui source. Product SCSS remains local. Do not copy library tokens back into
this application: theme updates must come from the package.

`FinanceSidebarProvider` preserves the `control-mensual.sidebar.open` storage and
SSR cookie contract, its thirty-day lifetime and the four-rem collapsed rail.
The shared provider also maintains its own `sidebar_state` cookie. The application
continues reading its own cookie on the server; initial hydration remains stable.
Storage restrictions must not prevent toggling the sidebar in memory.

The receipt uploader retains Untitled UI's file selection, drag and drop and
progress behavior. Its specialized Tailwind class merger and product-specific
tooltip composition remain local. NextAuth, application use cases, database
adapters and Google Drive flows are unaffected by this package boundary.

Declare packages imported by application code as direct dependencies, even when
beez-ui also installs them. In particular, the local uploader still imports
`motion/react`, so `motion` remains direct. By project decision, the Google Drive
error adapter uses `GaxiosError` from the `gaxios` dependency supplied by
`googleapis`; `gaxios` is intentionally not declared directly.

Before updating the package, run `npm run lint`, `npm run typecheck`,
`npm test -- --runInBand`, `npm run build` and `npm run test:e2e`. Browser coverage
must exercise theme persistence, navigation and interactive controls in Chromium
and WebKit at desktop and mobile widths.

Behavioral tests use reduced motion in jsdom. Browser tests verify theme
persistence, navigation and controls without asserting CSS values or dimensions.
