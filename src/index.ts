import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { desc } from "drizzle-orm";
import { Elysia } from "elysia";

import { db } from "./db";
import { log, requestLogger } from "./log";
import { HomePage } from "./page";
import type { BookingListItem } from "./schema";
import { bookings } from "./schema";

type Dependencies = { listBookings?: () => Promise<BookingListItem[]> };

export const getApp = ({ listBookings }: Dependencies = {}) =>
	new Elysia().use(html()).get("/", async () => {
		const rows = await (listBookings
			? listBookings()
			: db
					.select({
						id: bookings.id,
						bookedOn: bookings.bookedOn,
						description: bookings.description,
						amountCents: bookings.amountCents,
						status: bookings.status,
					})
					.from(bookings)
					.orderBy(desc(bookings.bookedOn), desc(bookings.id)));

		return HomePage({ bookings: rows });
	});

if (import.meta.main) {
	process.on("uncaughtException", error => log.error({ event: "uncaughtException", error }));
	process.on("unhandledRejection", error => log.error({ event: "unhandledRejection", error }));

	new Elysia()
		.use(requestLogger)
		.use(staticPlugin({ assets: "public", prefix: "/" }))
		.use(getApp())
		.listen(8080);
}
