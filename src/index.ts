import { Elysia } from "elysia"

new Elysia()
  .get("/", () => "ok")
  .listen(8080)
