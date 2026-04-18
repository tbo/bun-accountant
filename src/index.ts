import { html } from "@elysiajs/html"
import { Elysia } from "elysia"

import { requestLogger } from "./log"
import { HomePage } from "./page"

export const app = new Elysia().use(html()).get("/", HomePage)

if (import.meta.main) app.use(requestLogger).listen(8080)
