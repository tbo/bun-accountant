import { describe, expect, it } from "bun:test";

import { authLoginPath, signInRequestOf } from "./auth";
import { getApp } from "./index";

describe("auth", () => {
	it("sets origin on the internal auth start request when cookies are present", () => {
		const request = signInRequestOf(
			new Request(`http://localhost${authLoginPath}?callbackURL=%2F`, { headers: { cookie: "session=abc" } }),
			"/",
		);

		expect(request.headers.get("cookie")).toBe("session=abc");
		expect(request.headers.get("origin")).toBe("http://localhost");
		expect(request.headers.get("content-type")).toBe("application/json");
	});

	it("starts sign-in on the server and sanitizes the callback URL", async () => {
		let callbackURL = "";
		const response = await getApp({
			getSession: async () => null,
			startSignIn: async (_request, nextCallbackURL) => {
				callbackURL = nextCallbackURL;
				return Response.redirect("https://example.com/authorize", 302);
			},
		}).handle(new Request(`http://localhost${authLoginPath}?callbackURL=https://evil.example`));

		expect(callbackURL).toBe("/");
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://example.com/authorize");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("redirects authenticated login requests back to the callback URL", async () => {
		const response = await getApp({
			getSession: async () => ({ user: { id: "user-1" } }),
			startSignIn: async () => {
				throw new Error("should not start sign-in");
			},
		}).handle(new Request(`http://localhost${authLoginPath}?callbackURL=%2Freports`));

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("http://localhost/reports");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});

describe("/", () => {
	it("redirects unauthenticated requests to sign in", async () => {
		const response = await getApp({ getSession: async () => null }).handle(new Request("http://localhost/"));

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(`http://localhost${authLoginPath}?callbackURL=%2F`);
	});

	it("shows an empty state for authenticated requests when there are no bookings", async () => {
		const response = await getApp({
			getSession: async () => ({ user: { id: "user-1" } }),
			listBookings: async () => [],
		}).handle(new Request("http://localhost/"));
		const text = await response.text();

		expect(response.status).toBe(200);
		expect(text).toContain("<h1>Bookings</h1>");
		expect(text).toContain("<table>");
		expect(text).toContain("No bookings yet.");
	});

	it("renders bookings in the table for authenticated requests", async () => {
		const response = await getApp({
			getSession: async () => ({ user: { id: "user-1" } }),
			listBookings: async () => [
				{ id: 1, bookedOn: "2026-04-02", description: "OPENAI", amountCents: -1747, status: "draft" },
			],
		}).handle(new Request("http://localhost/"));
		const text = await response.text();

		expect(text).toContain("2026-04-02");
		expect(text).toContain("OPENAI");
		expect(text).toContain("Draft");
	});
});
