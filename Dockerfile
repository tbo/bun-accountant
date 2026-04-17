FROM --platform=$BUILDPLATFORM nixos/nix:latest AS dev

ENV NIX_CONFIG="experimental-features = nix-command flakes"
ENV PATH="/nix/var/nix/profiles/dev/bin:${PATH}"

WORKDIR /tmp/dev
COPY flake.nix flake.lock ./
RUN nix profile add --impure --accept-flake-config --profile /nix/var/nix/profiles/dev .#default

FROM --platform=$BUILDPLATFORM dev AS builder
ENV GOOS=linux
ENV GOARCH=amd64
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY Taskfile.yml ./
COPY . .
RUN task build

FROM scratch
USER 1000
COPY --from=builder /nix/var/nix/profiles/dev/etc/ssl/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /app/build/app /app
EXPOSE 8080
ENTRYPOINT ["/app"]
