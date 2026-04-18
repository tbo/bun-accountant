import { html } from "@elysiajs/html"
import { Elysia } from "elysia"

import { requestLogger } from "./log"
import { HomePage } from "./page"

export const createApp = (options?: Parameters<typeof requestLogger>[0]) =>
  new Elysia().use(requestLogger(options)).use(html()).get("/", HomePage)

export const app = createApp()

if (import.meta.main) app.listen(8080)
