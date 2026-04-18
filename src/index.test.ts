import { expect, test } from "bun:test"

import { createApp } from "./index"

test("GET / renders hello world", async () => {
  const lines: string[] = []
  const app = createApp({ write: (line) => lines.push(line) })
  const response = await app.handle(new Request("http://localhost/"))
  const requestId = response.headers.get("x-request-id")

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/html")
  expect(requestId).toBeTruthy()
  expect(await response.text()).toContain("<h1>Hello, world!</h1>")

  expect(lines).toHaveLength(1)

  const log = JSON.parse(lines[0]) as Record<string, unknown>

  expect(log.event).toBe("request")
  expect(log.level).toBe("info")
  expect(log.requestId).toBe(requestId)
  expect(log.method).toBe("GET")
  expect(log.path).toBe("/")
  expect(log.status).toBe(200)
  expect(typeof log.responseTime).toBe("number")
})

test("GET /boom logs error and request", async () => {
  const lines: string[] = []
  const app = createApp({ write: (line) => lines.push(line) }).get("/boom", () => {
    throw new Error("boom")
  })
  const response = await app.handle(new Request("http://localhost/boom"))
  const requestId = response.headers.get("x-request-id")
  const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
  const errorLog = records.find((record) => record.event === "error")
  const requestLog = records.find((record) => record.event === "request")

  expect(response.status).toBe(500)
  expect(requestId).toBeTruthy()
  expect(lines).toHaveLength(2)
  expect(errorLog).toBeTruthy()
  expect(requestLog).toBeTruthy()
  expect(errorLog?.requestId).toBe(requestId)
  expect(requestLog?.requestId).toBe(requestId)
  expect(errorLog?.status).toBe(500)
  expect(requestLog?.status).toBe(500)
  expect(errorLog?.level).toBe("error")
  expect(requestLog?.level).toBe("info")
  expect((errorLog?.error as { message?: string })?.message).toBe("boom")
})
