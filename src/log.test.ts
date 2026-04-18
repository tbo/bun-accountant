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

test("request logger logs error and request json", async () => {
	const done = captureLogs(2);

	const app = new Elysia().use(requestLogger).get("/boom", () => {
		throw new Error("boom");
	});
	const response = await app.handle(new Request("http://localhost/boom"));

	await done;

	expect(response.status).toBe(500);
	expect(response.headers.get("x-request-id")).toBeTruthy();

	const output = records();
	const errorLog = output.find((record) => record.event === "error");
	const requestLog = output.find((record) => record.event === "request");

	expect(output).toHaveLength(2);

	expect(errorLog).toBeTruthy();
	expect(requestLog).toBeTruthy();
	expect(errorLog?.requestId).toBe(response.headers.get("x-request-id"));
	expect(requestLog?.requestId).toBe(response.headers.get("x-request-id"));
	expect(errorLog?.level).toBe("error");
	expect(requestLog?.level).toBe("info");
	expect(errorLog?.status).toBeUndefined();
	expect(errorLog?.method).toBeUndefined();
	expect(errorLog?.path).toBeUndefined();
	expect(requestLog?.status).toBe(500);
	expect((errorLog?.error as { message?: string })?.message).toBe("boom");
});
