import { html } from "@elysiajs/html"
import { Elysia } from "elysia"

import { HomePage } from "./page"

export const app = new Elysia()
  .use(html())
  .get("/", HomePage)

if (import.meta.main) app.listen(8080)
