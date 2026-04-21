import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { Elysia } from "elysia";

import { db } from "./db";
import { requireEnv } from "./env";

const appUrl = new URL(requireEnv("APP_URL"));
const oidcIssuerUrl = new URL(requireEnv("OIDC_ISSUER_URL"));

type GetSession = (headers: Headers) => Promise<unknown>;
type StartSignIn = (request: Request, callbackURL: string) => Promise<Response>;

const authProviderId = "oidc";
const authApiPath = "/api/auth/*";
const authSignInPath = "/api/auth/sign-in/oauth2";
export const authLoginPath = "/auth/login";

const auth = betterAuth({
	appName: "bun-accountant",
	baseURL: appUrl.origin,
	basePath: "/api/auth",
	secret: requireEnv("COOKIE_SECRET"),
	database: drizzleAdapter(db, { provider: "pg" }),
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: authProviderId,
					clientId: requireEnv("OIDC_CLIENT_ID"),
					clientSecret: requireEnv("OIDC_CLIENT_SECRET"),
					discoveryUrl: new URL(".well-known/openid-configuration", oidcIssuerUrl).toString(),
					issuer: oidcIssuerUrl.toString(),
					scopes: ["openid", "profile", "email"],
					pkce: true,
				},
			],
		}),
	],
});

const getSession: GetSession = headers => auth.api.getSession({ headers });

const sanitizeCallbackUrl = (callbackURL: string | null) =>
	callbackURL?.startsWith("/") && !callbackURL.startsWith("//") ? callbackURL : "/";

const isAuthPath = (pathname: string) => pathname === authLoginPath || pathname.startsWith("/api/auth/");

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

const startSignIn: StartSignIn = async (request, callbackURL) => {
	const response = await auth.handler(signInRequestOf(request, callbackURL));
	if (!response.ok) return response;

	const { url } = (await response.json()) as { url?: string };
	if (!url) throw new Error("Missing auth redirect URL");

	const headers = new Headers({ location: url });
	for (const value of response.headers.getSetCookie()) headers.append("set-cookie", value);
	return new Response(null, { status: 302, headers });
};

const loginResponseOf = async (request: Request, getSession: GetSession, startSignIn: StartSignIn) => {
	const callbackURL = sanitizeCallbackUrl(new URL(request.url).searchParams.get("callbackURL"));
	if (await getSession(request.headers)) {
		return withNoStore(Response.redirect(new URL(callbackURL, request.url).toString(), 302));
	}
	return withNoStore(await startSignIn(request, callbackURL));
};

export const authRoutes = (
	getSessionOverride: GetSession = getSession,
	startSignInOverride: StartSignIn = startSignIn,
) =>
	new Elysia()
		.get(authLoginPath, ({ request }) => loginResponseOf(request, getSessionOverride, startSignInOverride))
		.get(authApiPath, ({ request }) => auth.handler(request))
		.post(authApiPath, ({ request }) => auth.handler(request));

export const authRedirectOf = async (request: Request, getSessionOverride: GetSession = getSession) => {
	if (isAuthPath(new URL(request.url).pathname)) return;
	if (await getSessionOverride(request.headers)) return;
	return Response.redirect(loginUrlOf(request), 302);
};
