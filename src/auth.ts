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

const authBasePath = "/api/auth";
const authProviderId = "oidc";
export const authLoginPath = "/auth/login";

const auth = betterAuth({
	appName: "bun-accountant",
	baseURL: appUrl.origin,
	basePath: authBasePath,
	secret: requireEnv("COOKIE_SECRET"),
	database: drizzleAdapter(db, { provider: "pg" }),
	account: { storeStateStrategy: "cookie", encryptOAuthTokens: true },
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: authProviderId,
					clientId: requireEnv("OIDC_CLIENT_ID"),
					clientSecret: requireEnv("OIDC_CLIENT_SECRET"),
					discoveryUrl: new URL(".well-known/openid-configuration", oidcIssuerUrl).toString(),
					requireIssuerValidation: true,
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

const isAuthPath = (pathname: string) =>
	pathname === authLoginPath || pathname === authBasePath || pathname.startsWith(`${authBasePath}/`);

const loginUrlOf = (request: Request) => {
	const { pathname, search } = new URL(request.url);
	return new URL(`${authLoginPath}?callbackURL=${encodeURIComponent(`${pathname}${search}`)}`, request.url).toString();
};

const withNoStore = (response: Response) => {
	const headers = new Headers(response.headers);
	headers.set("cache-control", "no-store");
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const redirectResponseOf = (location: string, sourceHeaders: Headers) => {
	const headers = new Headers({ location });
	for (const value of sourceHeaders.getSetCookie()) headers.append("set-cookie", value);
	return new Response(null, { status: 302, headers });
};

const startSignIn: StartSignIn = async (request, callbackURL) => {
	const { headers, response } = await auth.api.signInWithOAuth2({
		headers: request.headers,
		returnHeaders: true,
		body: { providerId: authProviderId, callbackURL },
	});

	return redirectResponseOf(response.url, headers);
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
		.mount(auth.handler)
		.get(authLoginPath, ({ request }) => loginResponseOf(request, getSessionOverride, startSignInOverride));

export const authRedirectOf = async (request: Request, getSessionOverride: GetSession = getSession) => {
	if (isAuthPath(new URL(request.url).pathname)) return;
	if (await getSessionOverride(request.headers)) return;
	return withNoStore(Response.redirect(loginUrlOf(request), 302));
};
