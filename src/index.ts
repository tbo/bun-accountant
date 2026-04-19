import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

import { requestLogger } from "./log";
import { HomePage } from "./page";

export const getApp = () => new Elysia().use(html()).get("/", HomePage);

if (import.meta.main)
	new Elysia()
		.use(requestLogger)
		.use(staticPlugin({ assets: "public", prefix: "/" }))
		.use(getApp())
		.listen(8080);
