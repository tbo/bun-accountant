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
- **Testing**: Bun's built-in test runner (`bun test`). Prefer integration tests.
- Containerized via Docker (`Dockerfile`) and Docker Compose (`compose.yaml`). The agent runs **inside** the `dev` service — all development (tasks, tools, database access) is isolated to that container. The working directory is bind-mounted from the host (`${PWD}:${PWD}`).

**KEEP CURRENT**: Any code changes that invalidate these instructions MUST trigger immediate updates to this file.
