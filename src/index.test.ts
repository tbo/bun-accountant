import { describe, expect, it } from "bun:test";

import { getApp } from "./index";

describe("/", () => {
	it("shows an empty state when there are no bookings", async () => {
		const response = await getApp({ listBookings: async () => [] }).handle(new Request("http://localhost/"));
		const text = await response.text();

		expect(response.status).toBe(200);
		expect(text).toContain("<h1>Bookings</h1>");
		expect(text).toContain("<table>");
		expect(text).toContain("No bookings yet.");
	});

	it("renders bookings in the table", async () => {
		const response = await getApp({
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
