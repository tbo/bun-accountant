import { expect, test } from "bun:test";

import { getApp } from "./index";

test("GET / renders hello world", async () => {
	const response = await getApp().handle(new Request("http://localhost/"));
	const body = await response.text();

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toContain("text/html");
	expect(body).toContain('href="/assets/styles.css"');
	expect(body).toContain("<h1>Hello, world!</h1>");
});
