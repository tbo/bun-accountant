import { Elysia } from "elysia";

const errorStatus = {
	INVALID_COOKIE_SIGNATURE: 400,
	NOT_FOUND: 404,
	PARSE: 400,
	VALIDATION: 422,
} satisfies Record<string, number>;

const write = (record: Record<string, unknown>) => {
	process.stdout.write(`${JSON.stringify(record)}\n`);
};

const pathOf = (url: string) => new URL(url).pathname;
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

export const requestLogger = new Elysia({ name: "request-logger" })
	.derive(({ request, set }) => {
		const requestId =
			request.headers.get("x-request-id") ?? crypto.randomUUID();
		set.headers["x-request-id"] = requestId;
		return { requestId, startTime: performance.now() };
	})
	.onError(({ error, requestId }) => {
		write({
			time: new Date().toISOString(),
			level: "error",
			event: "error",
			requestId,
			error: errorOf(error),
		});
	})
	.onAfterResponse(({ request, requestId, set, startTime }) => {
		write({
			time: new Date().toISOString(),
			level: "info",
			event: "request",
			requestId,
			method: request.method,
			url: request.url,
			path: pathOf(request.url),
			status: statusOf(set.status, 200),
			responseTime: Math.round(performance.now() - startTime),
		});
	})
	.as("global");
