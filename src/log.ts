import { Elysia } from "elysia"

type LogWrite = (line: string) => void

type LoggerOptions = {
  write?: LogWrite
}

const errorStatus = {
  INVALID_COOKIE_SIGNATURE: 400,
  NOT_FOUND: 404,
  PARSE: 400,
  VALIDATION: 422,
} satisfies Record<string, number>

const createStdoutWrite = (): LogWrite => {
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
      return
    }
    if (buffer && !scheduled) {
      scheduled = true
      queueMicrotask(flush)
    }
  }

  return (line) => {
    buffer += `${line}\n`
    if (!scheduled && !draining) {
      scheduled = true
      queueMicrotask(flush)
    }
  }
}

const stdoutWrite = createStdoutWrite()

const pathOf = (url: string) => new URL(url).pathname

const statusOf = (status: unknown, fallback: number) =>
  typeof status === "number"
    ? status
    : typeof status === "string"
      ? errorStatus[status] ?? fallback
      : fallback

const serializeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) }

export const requestLogger = ({ write = stdoutWrite }: LoggerOptions = {}) => {
  const log = (record: Record<string, unknown>) => write(JSON.stringify(record))

  return new Elysia({ name: "request-logger" })
    .derive(({ request, set }) => {
      const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
      set.headers["x-request-id"] = requestId
      return { requestId, startTime: performance.now() }
    })
    .onError(({ code, error, request, requestId, set, startTime }) => {
      const status = statusOf(set.status, errorStatus[code] ?? 500)
      const responseTime = Math.round(performance.now() - startTime)
      const base = {
        time: new Date().toISOString(),
        requestId,
        method: request.method,
        url: request.url,
        path: pathOf(request.url),
        status,
        responseTime,
      }

      log({
        ...base,
        level: "error",
        event: "error",
        error: serializeError(error),
      })
      log({ ...base, level: "info", event: "request" })
    })
    .onAfterHandle(({ request, requestId, set, startTime }) => {
      log({
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
}
