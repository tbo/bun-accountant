import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { logError, requestLogger } from "./log";
import { HomePage } from "./page";

export const getApp = () => new Elysia().use(html()).get("/", HomePage);

if (import.meta.main) {
	process.on("uncaughtException", (error) => {
		logError("uncaughtException", error);
	});
	process.on("unhandledRejection", (error) => {
		logError("unhandledRejection", error);
	});

	new Elysia()
		.use(requestLogger)
		.use(staticPlugin({ assets: "public", prefix: "/" }))
		.use(getApp())
		.listen(8080);
}
