import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

import { db } from "./db";
import { requireEnv } from "./env";

const appUrl = new URL(requireEnv("APP_URL"));
const oidcIssuerUrl = new URL(requireEnv("OIDC_ISSUER_URL"));

export const authProviderId = "oidc";
export const authLoginPath = "/auth/login";
export const authSignInPath = "/api/auth/sign-in/oauth2";
export const authCallbackPath = `/api/auth/oauth2/callback/${authProviderId}`;

export const auth = betterAuth({
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
