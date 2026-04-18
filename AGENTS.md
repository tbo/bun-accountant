# Workflow

1. **Plan**: Draft a plan. **Stop and wait for user approval before implementing.**

2. **Implement**: Execute the approved plan. Adhere to the guidelines below.

3. **Verify**: Run tests after each edit cycle. Confirm changes comply with user requirements and this document. For any issues, return to Implement.

4. **Architecture Review**: Reflect on decisions made during implementation (boundaries, dependencies, data flow, error handling, logging, security). Flag mismatches with project goals and suggest concrete next steps.

Do not read files that are unrelated to the current task. Do not re-read files whose contents you already have.

# Development Guidelines

- **Brevity**: Strive for terse code; excessive lines are a negative quality. Use modern language features.
- **YAGNI**: Implement only what is explicitly requested. No speculative functionality.
- **NO COMMENTS**: Do not add comments to code.

# Code Style & Conventions

- **Runtime**: Bun with ElysiaJS. TypeScript in strict mode.
- **Database**: PostgreSQL via `DATABASE_URL` (required).
- **DB access**: Use Drizzle with Drizzle Kit migrations. Keep queries explicit and SQL-like.
- **Auth**: Use Better Auth for provider-agnostic OAuth/OIDC. Auth0 is the current provider; keep Auth0-specific assumptions out of app code. Use Better Auth's Drizzle adapter for auth/session tables; use Drizzle directly for app domain data.
- **Logging**: A local logging middleware is integrated. It logs HTTP requests and errors as JSON to stdout.
- **Testing**: Bun's built-in test runner (`bun test`). Prefer integration tests.
- **Frontend**: Hypermedia layer is still undecided; keep both HTMX and Hotwire Turbo viable.
- **Styling**: Styling system is still undecided; keep both Pico CSS and daisyUI viable.
- **SQLite**: Optional only; keep PostgreSQL as the primary database.
- Containerized via Docker (`Dockerfile`) and Docker Compose (`compose.yaml`). The agent runs **inside** the `dev` service — all development (tasks, tools, database access) is isolated to that container. The working directory is bind-mounted from the host (`${PWD}:${PWD}`).

**KEEP CURRENT**: Any code changes that invalidate these instructions MUST trigger immediate updates to this file.
