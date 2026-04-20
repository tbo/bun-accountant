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

const sessionOf = (headers: Headers, resolveSession?: Dependencies["getSession"]) =>
	resolveSession ? resolveSession(headers) : auth.api.getSession({ headers });

const callbackPathOf = (request: Request) => {
	const url = new URL(request.url);
	return `${url.pathname}${url.search}`;
};

const loginUrlOf = (request: Request) =>
	new URL(`${authLoginPath}?callbackURL=${encodeURIComponent(callbackPathOf(request))}`, request.url).toString();

const sanitizeCallbackUrl = (callbackURL: string | null) =>
	callbackURL?.startsWith("/") && !callbackURL.startsWith("//") ? callbackURL : "/";

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
	const authResponse = await auth.handler(signInRequestOf(request, callbackURL));

	if (!authResponse.ok) return authResponse;

	const body = (await authResponse.json()) as { url?: string };
	if (typeof body.url !== "string") throw new Error("Missing auth redirect URL");

	const redirectHeaders = new Headers({ location: body.url });
	for (const value of authResponse.headers.getSetCookie()) redirectHeaders.append("set-cookie", value);
	return new Response(null, { status: 302, headers: redirectHeaders });
};

const getPublicApp = ({ getSession: resolveSession, startSignIn: start }: Dependencies) =>
	new Elysia().use(html()).get(authLoginPath, async ({ request }) => {
		const callbackURL = sanitizeCallbackUrl(new URL(request.url).searchParams.get("callbackURL"));
		const session = await sessionOf(request.headers, resolveSession);
		if (session) return withNoStore(Response.redirect(new URL(callbackURL, request.url).toString(), 302));
		return withNoStore(await (start ?? startSignIn)(request, callbackURL));
	});

const getSecureApp = ({ listBookings, getSession }: Dependencies) =>
	new Elysia()
		.use(html())
		.onBeforeHandle(async ({ request }) => {
			const session = await sessionOf(request.headers, getSession);
			if (!session) return Response.redirect(loginUrlOf(request), 302);
		})
		.get("/", async () => {
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

const getAuthApi = () =>
	new Elysia()
		.get("/api/auth/*", ({ request }) => auth.handler(request))
		.post("/api/auth/*", ({ request }) => auth.handler(request));

export const getApp = (dependencies: Dependencies = {}) =>
	new Elysia().use(getPublicApp(dependencies)).use(getSecureApp(dependencies));

if (import.meta.main) {
	process.on("uncaughtException", error => log.error({ event: "uncaughtException", error }));
	process.on("unhandledRejection", error => log.error({ event: "unhandledRejection", error }));

	new Elysia()
		.use(requestLogger)
		.use(staticPlugin({ assets: "public", prefix: "/" }))
		.use(getAuthApi())
		.use(getApp())
		.listen(8080);
}
