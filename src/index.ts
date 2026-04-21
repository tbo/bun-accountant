import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { desc } from "drizzle-orm";
import { Elysia } from "elysia";

import { auth, authLoginPath, authProviderId, authSignInPath } from "./auth";
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

const sessionOf = (headers: Headers, getSession?: Dependencies["getSession"]) =>
	getSession ? getSession(headers) : auth.api.getSession({ headers });

const sanitizeCallbackUrl = (callbackURL: string | null) =>
	callbackURL?.startsWith("/") && !callbackURL.startsWith("//") ? callbackURL : "/";

const loginUrlOf = (request: Request) => {
	const { pathname, search } = new URL(request.url);
	return new URL(`${authLoginPath}?callbackURL=${encodeURIComponent(`${pathname}${search}`)}`, request.url).toString();
};

const withNoStore = (response: Response) => {
	const headers = new Headers(response.headers);
	headers.set("cache-control", "no-store");
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export const signInRequestOf = (request: Request, callbackURL: string) => {
	const headers = new Headers(request.headers);
	headers.set("accept", "application/json");
	headers.set("content-type", "application/json");
	headers.set("origin", new URL(request.url).origin);

	return new Request(new URL(authSignInPath, request.url), {
		method: "POST",
		headers,
		body: JSON.stringify({ providerId: authProviderId, callbackURL }),
	});
};

const startSignIn = async (request: Request, callbackURL: string) => {
	const response = await auth.handler(signInRequestOf(request, callbackURL));
	if (!response.ok) return response;

	const { url } = (await response.json()) as { url?: string };
	if (!url) throw new Error("Missing auth redirect URL");

	const headers = new Headers({ location: url });
	for (const value of response.headers.getSetCookie()) headers.append("set-cookie", value);
	return new Response(null, { status: 302, headers });
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

const protectedApp = ({ listBookings, getSession }: Dependencies) =>
	new Elysia()
		.use(html())
		.onBeforeHandle(async ({ request }) => {
			if (await sessionOf(request.headers, getSession)) return;
			return Response.redirect(loginUrlOf(request), 302);
		})
		.get("/", async () => HomePage({ bookings: await listBookingsOf(listBookings) }));

const authApi = () =>
	new Elysia()
		.get("/api/auth/*", ({ request }) => auth.handler(request))
		.post("/api/auth/*", ({ request }) => auth.handler(request));

export const getApp = (dependencies: Dependencies = {}) =>
	new Elysia()
		.get(authLoginPath, async ({ request }) => {
			const callbackURL = sanitizeCallbackUrl(new URL(request.url).searchParams.get("callbackURL"));
			if (await sessionOf(request.headers, dependencies.getSession)) {
				return withNoStore(Response.redirect(new URL(callbackURL, request.url).toString(), 302));
			}
			return withNoStore(await (dependencies.startSignIn ?? startSignIn)(request, callbackURL));
		})
		.use(protectedApp(dependencies));

if (import.meta.main) {
	process.on("uncaughtException", error => log.error({ event: "uncaughtException", error }));
	process.on("unhandledRejection", error => log.error({ event: "unhandledRejection", error }));

	new Elysia()
		.use(requestLogger)
		.use(staticPlugin({ assets: "public", prefix: "/" }))
		.use(authApi())
		.use(getApp())
		.listen(8080);
}
