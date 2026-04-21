import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { desc } from "drizzle-orm";
import { Elysia } from "elysia";

import { authRedirectOf, authRoutes } from "./auth";
import { db } from "./db";
import { log, requestLogger } from "./log";
import { HomePage } from "./page";
import type { BookingListItem } from "./schema";
import { bookings } from "./schema";

type Dependencies = {
	listBookings?: () => Promise<BookingListItem[]>;
	getSession?: (headers: Headers) => Promise<unknown>;
	startSignIn?: (request: Request, callbackURL: string) => Promise<Response>;
};

const listBookingsOf = (listBookings?: Dependencies["listBookings"]) =>
	listBookings
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
				.orderBy(desc(bookings.bookedOn), desc(bookings.id));

export const getApp = (dependencies: Dependencies = {}) =>
	new Elysia()
		.use(authRoutes(dependencies.getSession, dependencies.startSignIn))
		.use(html())
		.onBeforeHandle(({ request }) => authRedirectOf(request, dependencies.getSession))
		.get("/", async () => HomePage({ bookings: await listBookingsOf(dependencies.listBookings) }));

if (import.meta.main) {
	process.on("uncaughtException", error => log.error({ event: "uncaughtException", error }));
	process.on("unhandledRejection", error => log.error({ event: "unhandledRejection", error }));

	new Elysia()
		.use(requestLogger)
		.use(staticPlugin({ assets: "public", prefix: "/" }))
		.use(getApp())
		.listen(8080);
}
