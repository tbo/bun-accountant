import { expect, test } from "bun:test"

import { app } from "./index"

test("GET / renders hello world", async () => {
  const response = await app.handle(new Request("http://localhost/"))

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/html")
  expect(await response.text()).toContain("<h1>Hello, world!</h1>")
})
