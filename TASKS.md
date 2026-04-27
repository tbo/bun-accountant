# Tasks

## Scope decisions

- [ ] Use SvelteKit as the app framework and remove Elysia from runtime code.
- [ ] Keep the app running under Bun in dev, test, and production.
- [ ] Use `svelte-adapter-bun` for the production SvelteKit adapter unless implementation validation proves it is incompatible.
- [ ] Use idiomatic SvelteKit structure: `src/routes`, `src/lib`, `src/hooks.server.ts`, server `load` functions, form actions, and endpoint handlers.
- [ ] Create draft bookings directly from imported CSV rows in `bookings`; do not introduce separate import or transaction tables.
- [ ] Store uploaded receipts/invoices in PostgreSQL, including binary content and metadata.
- [ ] Keep LLM-assisted finalization and ELSTER/Vorsteueranmeldung reporting out of this implementation.

## SvelteKit migration

- [ ] Declare SvelteKit, Vite, Svelte, `svelte-check`, and `svelte-adapter-bun` dependencies in `package.json`.
- [ ] Add `svelte.config.js`, `vite.config.ts`, and SvelteKit app type definitions.
- [ ] Update `tsconfig.json` to extend the generated SvelteKit config.
- [ ] Replace Elysia entrypoints with SvelteKit routes and hooks.
- [ ] Remove Elysia-specific dependencies, JSX page rendering, and static plugin usage.
- [ ] Update scripts so `dev`, `build`, `start`, `typecheck`, `test`, and `verify` are SvelteKit/Bun appropriate.
- [ ] Update `Dockerfile` to build and run the SvelteKit Bun adapter output.
- [ ] Keep port `8080` for Docker Compose/local app access.

## Auth and request handling

- [ ] Move Better Auth setup into server-only SvelteKit modules under `src/lib/server`.
- [ ] Expose Better Auth through `/api/auth/[...all]`.
- [ ] Implement `/auth/login` with callback URL sanitization.
- [ ] Add `src/hooks.server.ts` to load the session into `event.locals`.
- [ ] Protect all app pages except auth endpoints and static/build assets.
- [ ] Preserve provider-agnostic OIDC configuration.
- [ ] Port JSON request/error logging from Elysia middleware to SvelteKit hooks.
- [ ] Add or update tests for auth redirect sanitization and request logging.

## Database schema

- [ ] Keep Better Auth tables in Drizzle schema.
- [ ] Replace the current minimal booking schema with one table that covers imported bank rows, draft booking data, finalization data, and receipt storage.
- [ ] Add import-source fields on `bookings`: source filename, source row number, imported timestamp, raw row JSON, and stable import dedupe key.
- [ ] Add bank transaction fields on `bookings`: booking date, value date, partner name, partner IBAN, transaction type, payment reference, account name, amount cents, original amount, original currency, and exchange rate.
- [ ] Add booking workflow fields: status, booking text, accounting number, category, VAT treatment, gross/net/VAT amount cents, notes, AFA required flag, AFA reference, finalized timestamp, and finalized user.
- [ ] Add receipt fields directly on `bookings`: filename, MIME type, size, binary content, uploaded timestamp, receipt date, vendor, invoice number, and extracted/prefilled metadata.
- [ ] Add a unique index/constraint on the stable import dedupe key for idempotent overlapping CSV imports.
- [ ] Generate and commit a Drizzle migration for the new schema.

## CSV import directly to draft bookings

- [ ] Implement a server-only CSV parser for the existing bank statement format from `transactions-demo.csv`.
- [ ] Validate required headers and return clear row/header errors.
- [ ] Parse German/business-safe money values into integer cents.
- [ ] Normalize optional original amount/currency/exchange rate fields.
- [ ] Compute a stable dedupe key from normalized bank row data, not from upload filename.
- [ ] Insert valid, non-duplicate rows directly as `draft` bookings.
- [ ] Skip duplicates using the unique dedupe key so overlapping statements are safe to re-import.
- [ ] Add `/bookings/import` page with upload form and import summary.
- [ ] Show inserted count, duplicate count, and validation errors after import.
- [ ] Add tests for CSV quoting, required headers, amount parsing, dedupe key stability, and overlapping imports.

## Booking workflow UI

- [ ] Add an authenticated app layout with navigation for booking list and CSV import.
- [ ] Add `/bookings` list page with draft/finalized filters and status badges.
- [ ] Show source bank data, amount, draft/finalized status, receipt status, accounting number, and AFA status in the list.
- [ ] Add `/bookings/[id]` detail page.
- [ ] On draft bookings, show editable finalization form and receipt upload control.
- [ ] On finalized bookings, show a read-oriented summary of final booking data and stored receipt metadata.
- [ ] Implement receipt download/view endpoint that reads receipt binary content from PostgreSQL and requires authentication.
- [ ] Add accessible form validation errors and success messages using SvelteKit form actions.

## Receipt and metadata handling

- [ ] Upload receipt/invoice files through a booking form action.
- [ ] Store receipt binary data in PostgreSQL with filename, MIME type, and size.
- [ ] Enforce a pragmatic max file size in server validation.
- [ ] Prefill receipt metadata from booking/source data and uploaded file metadata where deterministic.
- [ ] Keep all metadata editable by the user before finalization.
- [ ] Do not add OCR, LLM extraction, or background jobs in this implementation.
- [ ] Add DB-backed receipt persistence/download tests once PostgreSQL and SvelteKit dependencies are available; receipt upload validation and metadata prefill are covered by unit tests.

## Finalization rules

- [ ] Implement finalization as a SvelteKit form action on `/bookings/[id]`.
- [ ] Require receipt content before finalizing.
- [ ] Require receipt date, vendor, gross amount, booking text/category, accounting number, VAT treatment, and VAT/net/gross fields before finalizing.
- [ ] Require AFA reference when `afaRequired` is true.
- [ ] Set status to `finalized`, store finalized timestamp, and store finalized user when validation passes.
- [ ] Keep finalized bookings visible and auditable.
- [ ] Add tests for successful finalization and each important validation branch, including AFA-required behavior.

## Styling and UX

- [ ] Replace Pico CSS if app-specific CSS gives a better SvelteKit UX.
- [ ] Add a compact global stylesheet for layout, forms, tables, alerts, and badges.
- [ ] Keep the UI usable without client-side JavaScript beyond SvelteKit defaults.
- [ ] Avoid adopting a large component/CSS framework unless it materially improves the implementation.

## Tests and verification

- [ ] Keep using Bun's test runner.
- [ ] Prefer pure module tests for parsing, dedupe, validation, and formatting.
- [ ] Add database-backed integration tests once PostgreSQL is reachable from the test process; current coverage uses pure and fake-DB tests.
- [ ] Update or remove obsolete Elysia tests.
- [ ] Run `bun run verify` successfully after dependencies are installed; current run is blocked because `svelte-kit` is not installed in this network-restricted environment.
- [ ] Fix any SvelteKit typecheck/build failures after `bun install` can fetch the new dependencies.

## Documentation and project instructions

- [ ] Update `AGENTS.md` to reflect SvelteKit instead of Elysia and the chosen styling approach.
- [ ] Update any runtime/start instructions affected by the Bun adapter output.
- [ ] Re-check this task list before final response and mark completed implementation tasks.

## Architecture review checklist

- [ ] Confirm direct-to-bookings import still satisfies deduplication and auditability without import/transaction tables.
- [ ] Confirm storing receipt binaries in PostgreSQL is acceptable for expected file sizes and backup strategy.
- [ ] Confirm SvelteKit server boundaries keep auth, DB access, and receipt binary data server-only.
- [ ] Confirm validation lives close to server actions and is covered by tests.
- [ ] Flag any remaining tradeoffs or follow-up work in the final response.

## Verification notes

- [ ] `bun run format` passes.
- [ ] `bun test` passes with 17 tests.
- [ ] Server-only TypeScript modules pass a direct `tsc --ignoreConfig` check.
- [ ] `bun install` could not fetch new SvelteKit packages because registry access fails in this environment.
- [ ] `bun run verify` currently stops at `svelte-kit: command not found` until dependencies are installed and `bun.lock` is regenerated.
