import { afterEach, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { requestLogger } from "./log";

const originalWrite = process.stdout.write.bind(process.stdout);
const chunks: string[] = [];

const records = () =>
	chunks
		.join("")
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Record<string, unknown>);

afterEach(() => {
	process.stdout.write = originalWrite;
	chunks.length = 0;
});

const captureLogs = (count: number) => {
	let resolve = () => {};
	const done = new Promise<void>((r) => {
		resolve = r;
	});

	process.stdout.write = ((chunk: string | Uint8Array) => {
		chunks.push(String(chunk));
		if (chunks.length === count) resolve();
		return true;
	}) as typeof process.stdout.write;

	return done;
};

test("request logger logs request json when mounted before a route plugin", async () => {
	const done = captureLogs(1);

	const routes = new Elysia().get("/", () => "ok");
	const app = new Elysia().use(requestLogger).use(routes);
	const response = await app.handle(
		new Request("http://localhost/", { headers: { "x-request-id": "req-1" } }),
	);

	await done;

	expect(response.status).toBe(200);
	expect(response.headers.get("x-request-id")).toBe("req-1");

	const [log] = records();

	expect(records()).toHaveLength(1);

	expect(log.time).toBeTruthy();
	expect(log.level).toBe("info");
	expect(log.event).toBe("request");
	expect(log.requestId).toBe("req-1");
	expect(log.method).toBe("GET");
	expect(log.path).toBe("/");
	expect(log.status).toBe(200);
	expect(typeof log.responseTime).toBe("number");
});

test("request logger logs live server requests", async () => {
	const done = captureLogs(1);
	const app = new Elysia()
		.use(requestLogger)
		.get("/", () => "ok")
		.listen(0);

	try {
		const response = await fetch(`http://127.0.0.1:${app.server?.port}/`);

		await done;

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
		expect(records()).toHaveLength(1);
		expect(records()[0]?.path).toBe("/");
	} finally {
		app.stop();
	}
});

test("request logger logs error and the app keeps handling requests", async () => {
	const done = captureLogs(3);

	const app = new Elysia()
		.use(requestLogger)
		.get("/", () => "ok")
		.get("/boom", () => {
			throw new Error("boom");
		});
	const errorResponse = await app.handle(new Request("http://localhost/boom"));
	const okResponse = await app.handle(new Request("http://localhost/"));

	await done;

	expect(errorResponse.status).toBe(500);
	expect(errorResponse.headers.get("x-request-id")).toBeTruthy();
	expect(okResponse.status).toBe(200);

	const output = records();
	const errorLog = output.find((record) => record.event === "error");
	const requestLogs = output.filter((record) => record.event === "request");
	const failedRequestLog = requestLogs.find((record) => record.status === 500);
	const okRequestLog = requestLogs.find((record) => record.status === 200);

	expect(output).toHaveLength(3);

	expect(errorLog).toBeTruthy();
	expect(failedRequestLog).toBeTruthy();
	expect(okRequestLog).toBeTruthy();
	expect(errorLog?.requestId).toBe(errorResponse.headers.get("x-request-id"));
	expect(failedRequestLog?.requestId).toBe(
		errorResponse.headers.get("x-request-id"),
	);
	expect(errorLog?.level).toBe("error");
	expect(failedRequestLog?.level).toBe("info");
	expect(okRequestLog?.level).toBe("info");
	expect(errorLog?.status).toBeUndefined();
	expect(errorLog?.method).toBeUndefined();
	expect(errorLog?.path).toBeUndefined();
	expect(failedRequestLog?.status).toBe(500);
	expect(okRequestLog?.path).toBe("/");
	expect((errorLog?.error as { message?: string })?.message).toBe("boom");
});
