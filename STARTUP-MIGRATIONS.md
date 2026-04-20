# Startup migrations plan

## Goal

Support safe startup-time PostgreSQL migrations for multi-instance deployments.

The intended behavior is:

- every app instance may attempt startup migrations
- exactly one instance acquires a database-level lock
- that instance applies pending Drizzle migrations
- the other instances wait for the lock or fail after a timeout
- no instance starts serving traffic before startup migration is complete

This is explicitly about a non-naive approach. The design must be safe in multi-instance deployments.

## Current repository state

As of 2026-04-19:

- Runtime DB access uses Drizzle with Bun SQL in `src/db.ts` via `drizzle-orm/bun-sql`
- App schema lives in `src/schema.ts`
- Migration config lives in `drizzle.config.ts`
- Migration scripts exist in `package.json`
  - `bun run db:generate`
  - `bun run db:migrate`
- `drizzle-kit migrate` currently requires the `postgres` package, which is installed as a dev dependency for CLI migration use
- The first migration already exists in `drizzle/0000_nappy_reavers.sql`
- The app currently does not run migrations on startup
- `src/index.ts` starts the server directly
- The Docker image currently does not copy the `drizzle/` directory into the production image, which would have to change for runtime migrations

## Why this approach

A separate deployment migration step is still valid, but the preferred future design is startup migration with database coordination because it provides Goose-like behavior while keeping schema management inside the app.

The key requirement is that PostgreSQL advisory locks are session-scoped. The same database session must:

- acquire the lock
- run the migrations
- release the lock

Because of that, the implementation must use a reserved Bun SQL connection and must run the migration logic on a Drizzle instance bound to that exact connection.

## Chosen design

### Migration source of truth

Keep the current Drizzle workflow:

1. update `src/schema.ts`
2. run `bun run db:generate`
3. commit the generated SQL in `drizzle/`

Startup migration should apply already-generated SQL. It should not generate migrations.

### Runtime mechanism

Use Drizzle's runtime migrator, not the CLI.

Use:

- `drizzle-orm/bun-sql`
- `drizzle-orm/bun-sql/migrator`

Do not shell out to `drizzle-kit migrate` from app startup.

Reasons:

- startup migration should stay in-process
- runtime should use Bun SQL directly
- lock coordination is easier and safer inside one process
- `drizzle-kit migrate` is better kept as an operational fallback or local/dev tool

### Locking strategy

Use a PostgreSQL advisory lock.

Recommended shape:

- session-scoped advisory lock
- acquired with `pg_try_advisory_lock(...)`
- retried in a loop with sleep and timeout
- explicitly released with `pg_advisory_unlock(...)`

Do not rely on a transaction-scoped advisory lock for this feature.

Reason:

- migrations may include statements that should not be wrapped in one large transaction
- the lock should protect the whole migration session, not a single transaction boundary

### Connection handling

Use Bun SQL's reserved connection support.

Flow:

1. create a Bun SQL client from `DATABASE_URL`
2. call `reserve()` to get a dedicated connection
3. build a Drizzle instance on top of the reserved connection
4. acquire the advisory lock on that connection
5. run `migrate(db, { migrationsFolder: "./drizzle" })`
6. release the advisory lock
7. release the reserved connection
8. close the root client

This is the core correctness requirement. The lock and the migration runner must use the same reserved connection.

### Startup timing

Run startup migration before `listen(8080)` in `src/index.ts`.

Desired order:

1. process starts
2. startup migration runs if enabled
3. only after success does the HTTP server start listening

Do not serve requests before startup migration completes.

### Failure behavior

If migration fails:

- log a structured startup migration error
- exit non-zero
- do not start the server

If the lock cannot be acquired before timeout:

- log timeout details
- exit non-zero
- do not start the server

### Configuration

Add explicit environment-driven control.

Proposed variables:

- `MIGRATE_ON_START=true|false`
- `MIGRATION_LOCK_TIMEOUT_MS`, default around `300000`
- optionally `MIGRATION_LOCK_RETRY_MS`, default around `1000`

Recommended default behavior:

- local dev: can be enabled or disabled depending on convenience
- production: explicit opt-in via env so rollout behavior is deliberate

### Logging

Use the existing `log` helper in `src/log.ts`.

Suggested events:

- `migration.waiting_for_lock`
- `migration.started`
- `migration.finished`
- `migration.failed`
- `migration.lock_timeout`

### Packaging requirement

Runtime migration reads SQL files from disk.

That means the production image must include:

- `drizzle/`

The current `Dockerfile` does not yet copy that folder into the final image. Future implementation must fix that.

## Important caveats

### Connection topology

This approach assumes session semantics are preserved.

It is appropriate for:

- direct PostgreSQL connections
- session-pooled connections

It is not appropriate for:

- PgBouncer transaction pooling
- any connection layer that breaks session affinity

If the app is ever deployed behind a transaction pooler, startup migration must use a direct or session-pooled connection URL.

### Coordination vs compatibility

The advisory lock only solves coordination.

It does not solve schema rollout compatibility. Future migrations still need to be rollout-safe:

- additive changes first
- backfills separately when needed
- destructive cleanup only after all running app versions are compatible

This is true even with perfect locking.

## Proposed implementation plan

1. Add `src/startup-migrations.ts`
   - expose `runStartupMigrations()`
   - create a dedicated Bun SQL client
   - reserve one connection
   - create a Drizzle DB from that reserved connection
   - acquire and release the advisory lock
   - run Drizzle runtime migrations from `./drizzle`

2. Wire startup migration into `src/index.ts`
   - run it before `listen(8080)`
   - skip it when `MIGRATE_ON_START` is not enabled

3. Keep current CLI migration scripts
   - keep `db:generate` for generating SQL
   - keep `db:migrate` as a manual fallback path

4. Update production packaging
   - ensure the final image includes `drizzle/`

5. Add focused tests
   - unit-test lock acquisition / timeout behavior where practical
   - unit-test the enable/disable path
   - keep the implementation structured so DB-free orchestration tests are possible

6. Run `bun run verify`

## Suggested implementation sketch

This is not final code, only a reference for future implementation:

```ts
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { log } from "./log";
import * as schema from "./schema";

const lockKey = [18451234, 1] as const;

export const runStartupMigrations = async () => {
	if (process.env.MIGRATE_ON_START !== "true") return;

	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is required");

	const timeoutMs = Number(process.env.MIGRATION_LOCK_TIMEOUT_MS ?? 300_000);
	const retryMs = Number(process.env.MIGRATION_LOCK_RETRY_MS ?? 1_000);
	const deadline = Date.now() + timeoutMs;

	const root = new SQL(url);
	const reserved = await root.reserve();

	try {
		const db = drizzle({ client: reserved, schema });

		for (;;) {
			const [{ locked }] = await reserved`
				select pg_try_advisory_lock(${lockKey[0]}, ${lockKey[1]}) as locked
			`;

			if (locked) break;
			if (Date.now() >= deadline) throw new Error("Timed out waiting for migration lock");

			log.info({ event: "migration.waiting_for_lock" });
			await Bun.sleep(retryMs);
		}

		try {
			log.info({ event: "migration.started" });
			await migrate(db, { migrationsFolder: "./drizzle" });
			log.info({ event: "migration.finished" });
		} finally {
			await reserved`select pg_advisory_unlock(${lockKey[0]}, ${lockKey[1]})`;
		}
	} finally {
		await reserved.release();
		await root.close();
	}
};
```

## Decisions to preserve

When implementing this later, do not lose these decisions:

- use Drizzle-generated SQL migrations as the source of truth
- do not generate migrations on app startup
- do not shell out to `drizzle-kit migrate` from the app
- do use `drizzle-orm/bun-sql/migrator`
- do use a reserved Bun SQL connection
- do acquire the advisory lock on the same session that runs migrations
- do run startup migration before the HTTP server starts listening
- do fail fast if migration fails or lock acquisition times out
- do package `drizzle/` into the runtime image
- do treat connection pooling mode as part of the correctness model

## Open questions for future implementation

- whether `MIGRATE_ON_START` should default to `false` everywhere or default to `true` in some environments
- whether waiting instances should log every retry or at a lower frequency
- whether to factor the advisory lock key into env/config or keep it hard-coded in code
- whether startup readiness/healthcheck behavior needs explicit changes once migration-on-start exists
