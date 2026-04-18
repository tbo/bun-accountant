import { writeSync } from "node:fs"

import { Elysia } from "elysia"

const errorStatus = {
  INVALID_COOKIE_SIGNATURE: 400,
  NOT_FOUND: 404,
  PARSE: 400,
  VALIDATION: 422,
} satisfies Record<string, number>

let buffer = ""
let draining = false
let scheduled = false

const flush = () => {
  scheduled = false
  if (draining || !buffer) return
  const chunk = buffer
  buffer = ""
  if (!process.stdout.write(chunk)) {
    draining = true
    process.stdout.once("drain", () => {
      draining = false
      flush()
    })
  }
}

const flushSync = () => {
  if (!buffer) return
  const chunk = buffer
  buffer = ""
  writeSync(process.stdout.fd, chunk)
}

const schedule = () => {
  if (scheduled || draining) return
  scheduled = true
  queueMicrotask(flush)
}

const write = (record: Record<string, unknown>) => {
  buffer += `${JSON.stringify(record)}\n`
  schedule()
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  const handler = () => {
    flushSync()
    process.off(signal, handler)
    process.kill(process.pid, signal)
  }
  process.once(signal, handler)
}

process.once("beforeExit", flushSync)

const pathOf = (url: string) => new URL(url).pathname
const statusOf = (status: unknown, fallback: number) =>
  typeof status === "number"
    ? status
    : typeof status === "string"
      ? errorStatus[status] ?? fallback
      : fallback
const errorOf = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) }

export const requestLogger = new Elysia({ name: "request-logger" })
  .derive(({ request, set }) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
    set.headers["x-request-id"] = requestId
    return { requestId, startTime: performance.now() }
  })
  .onError(({ code, error, request, requestId, set, startTime }) => {
    write({
      time: new Date().toISOString(),
      level: "error",
      event: "error",
      requestId,
      method: request.method,
      url: request.url,
      path: pathOf(request.url),
      status: statusOf(set.status, errorStatus[code] ?? 500),
      responseTime: Math.round(performance.now() - startTime),
      error: errorOf(error),
    })
  })
  .onAfterResponse(({ request, requestId, set, startTime }) => {
    write({
      time: new Date().toISOString(),
      level: "info",
      event: "request",
      requestId,
      method: request.method,
      url: request.url,
      path: pathOf(request.url),
      status: statusOf(set.status, 200),
      responseTime: Math.round(performance.now() - startTime),
    })
  })
  .as("global")
