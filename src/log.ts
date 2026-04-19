import { Elysia } from "elysia";

const errorStatus = {
	INVALID_COOKIE_SIGNATURE: 400,
	NOT_FOUND: 404,
	PARSE: 400,
	VALIDATION: 422,
} satisfies Record<string, number>;

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type LogRecord = Record<string, unknown> & {
	error?: unknown;
	level?: unknown;
	time?: unknown;
};

const write = (record: Record<string, unknown>) => {
	process.stdout.write(`${JSON.stringify(record)}\n`);
};

const statusOf = (status: unknown, fallback: number) =>
	typeof status === "number"
		? status
		: typeof status === "string"
			? (errorStatus[status as keyof typeof errorStatus] ?? fallback)
			: fallback;
const errorOf = (error: unknown) =>
	error instanceof Error
		? { name: error.name, message: error.message, stack: error.stack }
		: { message: String(error) };
const recordOf = ({ error, level: _, time: __, ...record }: LogRecord) =>
	error === undefined ? record : { ...record, error: errorOf(error) };
const at = (level: LogLevel) => (record: LogRecord) =>
	write({ time: new Date().toISOString(), level, ...recordOf(record) });

export const log = {
	trace: at("trace"),
	debug: at("debug"),
	info: at("info"),
	warn: at("warn"),
	error: at("error"),
	fatal: at("fatal"),
};

export const requestLogger = new Elysia({ name: "request-logger" })
	.derive(({ request, set }) => {
		const requestId =
			request.headers.get("x-request-id") ?? crypto.randomUUID();
		set.headers["x-request-id"] = requestId;
		return { requestId, startTime: performance.now() };
	})
	.onError(({ error, requestId }) => {
		log.error({ event: "error", requestId, error });
	})
	.onAfterResponse(({ path, request, requestId, set, startTime }) => {
		log.info({
			event: "request",
			requestId,
			method: request.method,
			url: request.url,
			path,
			status: statusOf(set.status, 200),
			responseTime: Math.round(performance.now() - startTime),
		});
	})
	.as("global");
