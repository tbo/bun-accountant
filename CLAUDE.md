# Workflow

1. **Plan**: Run `task agent-overview` for project context (packages, APIs, routes, schema). Draft a plan. **Stop and wait for user approval before implementing.**
   - Only read files directly relevant to the task — `agent-overview` covers discovery.

2. **Implement**: Execute the approved plan. Adhere to the guidelines below.

3. **Verify**: Run `task agent-check` after each edit cycle. Confirm changes comply with user requirements and this document. For any issues, return to Implement.

4. **Architecture Review**: Reflect on decisions made during implementation (boundaries, dependencies, data flow, error handling, logging, security). Flag mismatches with project goals and suggest concrete next steps.

**CRITICAL**: ALWAYS start by running `task agent-overview` via Bash — this IS the codebase exploration step and covers packages, APIs, routes, and schema. Only spawn an Explore agent if targeted follow-up is needed after reviewing its output. NEVER run `go build`, `goimports`, `go test`, `golangci-lint`, `go doc`, or `go list` directly — use ONLY `task agent-overview` and `task agent-check`.

Do not read files that are unrelated to the current task. Do not re-read files whose contents you already have.

# Development Guidelines

- **Brevity**: Strive for terse code (e.g. `cmp.Or` for defaults, `if init; condition { ... }`); excessive lines are a negative quality. Use modern language features.
- **YAGNI**: Implement only what is explicitly requested. No speculative functionality.
- **NO COMMENTS**: Do not add comments to code.

# Code Style & Conventions

- **Go (Backend)**:
    - **Logging**: Do not log errors — wrap them with context and return them (see Error Handling). Logging belongs at request boundaries (handlers) and top-level operations (init, background tasks), not deep in call stacks. When logging is needed: use `c.Logger` inside handlers (`func(c *app.Context) error`), `env.Logger` for non-request contexts. Pass `*app.Context` (not `c.Request.Context()`) to helpers that need the request logger. Both support standard `slog` methods (`Debug`, `Info`, `Error`, `With`); never import `log/slog` directly.
    - **Validation**: Use struct tags from go-playground/validator/v10, go-playground/mold/v4, go-playground/form.
    - **Database**: PostgreSQL via `DATABASE_URL` (required). Uses sqlc for type-safe queries — schema in `db/schema.sql`, queries in `db/query.sql`, regenerate with `go tool sqlc generate`. Use `db.Query()` to obtain a query handle. Migrations use goose (`db/migrations/`); every migration must include both `-- +goose Up` and `-- +goose Down` sections.
    - **Routing**: Define routes and handlers in `routes.go` in their respective package. Handlers that grow large may be split into domain-specific files.
    - **Error Handling**:
        - Wrap errors to add context using `fmt.Errorf` with the `%w` verb. The goal is to create a human-readable chain of operations that led to the failure.
        - Construct messages with the format: `<package name>: <lowercase description of operation>: %w`. Use format verbs like `%q` for quoted strings or `%d` for numbers to safely embed parameters.
        - Examples of clear, contextual messages:
            - `feed: fetching url "https://example.com/news.rss": %w`
            - `summary: requesting llm completion for article "http://example.com/article123": %w`
        - Prefer wrapping errors and returning them; use `errors.Join` when continuing past multiple errors.
- **Frontend Assets (`assets/`)**:
    - Technologies you may use: Go Templates, HTML, Pico CSS, Hotwire Turbo, Web Components.
    - Technologies you must not use: React, JSX, Vue, TypeScript, JQuery
    - Feature = package/route group that owns a UI area, e.g. `summary`; reuse that name in `web/templates/<feature>/...` and `ui-<feature>-...` IDs.
    - Templates: `web/templates/<feature>/{pages,regions,forms}/`; shared layouts stay in `web/templates/layouts/`.
    - Page = template rendered as the main HTML response from a handler.
    - Region = fragment template whose root element is the Turbo target, e.g. `mut.Replace("#ui-summary-output", "summary/regions/output_ready", ...)` updates region `output`.
    - Region states: `<region>_<state>.html`, e.g. `output_ready.html`, `output_error.html`; state templates for one region must keep the same root ID.
    - UI IDs: `ui-` prefix only; use `ui-<feature>-<region>`, `ui-<feature>-<region>-source`, `ui-<feature>-<name>-form`.
    - Turbo: prefer stable ID targets; use selector `targets` only for intentional multi-element updates.
- **Testing**:
    - Prefer integration tests over unit tests. Use `AssertExpectations` from `assert/expectation.go` and `net/http/httptest` to test through HTTP handlers. Only write isolated unit tests for pure logic with no dependencies.
    - Use assertion helpers under `assert/`. You may use `goquery` to validate HTML and XML responses.
    - Do not mock; if a test needs mocking, write an integration test instead.
- **Packages**: Add to an existing package when it already covers the domain. Create a new package only for a truly new domain. See [PLAN.md](PLAN.md) for the roadmap — keep transitional artifacts and planned structure in mind.
- Containerized via Docker (`Dockerfile`) and Docker Compose (`compose.yaml`). The agent runs **inside** the `dev` service — all development (tasks, tools, database access) is isolated to that container. The working directory is bind-mounted from the host (`${PWD}:${PWD}`).

**KEEP CURRENT**: Any code changes that invalidate these instructions MUST trigger immediate updates to this file.
