FROM rust:1.87 as builder

WORKDIR /app

RUN cargo install sqlx-cli

COPY . .

RUN touch build.db

RUN DATABASE_URL=sqlite://build.db cargo sqlx migrate run

RUN DATABASE_URL=sqlite://build.db cargo build --release

FROM rust:1.87

WORKDIR /app

COPY --from=builder /app/target/release/short /app/short

CMD [ "/app/short" ]
