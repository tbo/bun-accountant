FROM oven/bun:1-slim AS base dev
RUN apt-get update && apt-get install -y --no-install-recommends \
    git postgresql-client curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dev
RUN bun install -g typescript-language-server typescript

FROM base AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install
COPY tsconfig.json ./
COPY src ./src

FROM oven/bun:distroless
WORKDIR /app
COPY --from=build /app .
USER bun
EXPOSE 8080
ENTRYPOINT ["bun", "run", "src/index.ts"]
