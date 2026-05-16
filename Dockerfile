FROM oven/bun:1 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile
COPY frontend ./
RUN bun run build

FROM rust:1.87 AS builder
WORKDIR /app
RUN cargo install sqlx-cli --locked --no-default-features --features sqlite,rustls
COPY . .
# Replace the static web/ from git with the build output from the frontend stage.
RUN rm -rf /app/web
COPY --from=frontend /app/web /app/web
RUN touch build.db
RUN DATABASE_URL=sqlite://build.db cargo sqlx migrate run
RUN DATABASE_URL=sqlite://build.db cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/short /app/short
COPY --from=builder /app/web /app/web
CMD [ "/app/short" ]
