use argon2::password_hash::PasswordHasher;
use hmac::{Hmac, Mac};
use sqlx::migrate::Migrator;
use std::{net::Ipv4Addr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::services::ServeDir;
use utoipa::{openapi::Server, Modify, OpenApi};
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_swagger_ui::SwaggerUi;

// tags
use v1::{
    auth::AUTH_TAG,
    shorturls::SHORTURLS_TAG,
    // exercises::EXERCISES_TAG,
    // muscles::MUSCLES_TAG
};

mod catchall;
mod db;
mod error;
mod extractors;
mod state;
mod structs;
mod util;
mod v1;

pub(crate) use anyhow::Context;
pub(crate) use axum::extract::{Json, State};
pub(crate) use error::{AppError, Errors};
pub(crate) use serde::{Deserialize, Serialize};
pub(crate) use state::AppState;
pub(crate) use tracing::{debug, error, info, trace, warn};
pub(crate) use utoipa::ToSchema;

#[derive(OpenApi)]
#[openapi(
    tags(
        (name = AUTH_TAG, description = "Authentication API endpoints"),
        (name = SHORTURLS_TAG, description = "Short URL API endpoints"),
    ),
    modifiers(&ServerAddon)
)]
struct ApiDoc;

struct ServerAddon;
impl Modify for ServerAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        openapi.servers = Some(vec![Server::new("http://localhost:8080")]);
    }
}

/// Get health of the API.
#[utoipa::path(
    get,
    path = "/.well-known/health-check",
    responses(
        (status = OK, description = "Success", body = str, content_type = "text/plain")
    )
)]
async fn health_check() -> &'static str {
    "ok"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    tracing::subscriber::set_global_default(subscriber)?;

    dotenv::dotenv().ok();
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()?;
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let admin_password =
        std::env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "adminadmin".to_string());

    if !cfg!(debug_assertions) && jwt_secret == "secret" {
        panic!("JWT_SECRET is not set. Defaulting to 'secret'");
    }

    {
        info!("Checking if database file exists");
        let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL is not set");
        let dbfile = database_url.trim_start_matches("sqlite://");
        if !std::path::Path::new(dbfile).exists() {
            info!("Database file {} does not exist. Creating it.", dbfile);
            std::fs::write(dbfile, "").unwrap();
        }
    }

    let db = db::db().await?;
    sqlx::migrate!().run(&db).await.unwrap();
    let state = state::AppState {
        db: Arc::new(db),
        jwt_key: Hmac::new_from_slice(jwt_secret.as_bytes()).context("Failed to create HMAC")?,
    };

    {
        let salt = argon2::password_hash::SaltString::generate(&mut rand_core::OsRng);
        let argon2 = argon2::Argon2::default();
        let hash = argon2
            .hash_password(admin_password.as_bytes(), &salt)
            .expect("Password hashing failed")
            .to_string();

        sqlx::query!(
            "INSERT INTO users (id, name, username, password_hash, is_admin)
                VALUES (1, 'admin', 'admin', $1, true)
                ON CONFLICT DO NOTHING",
            hash
        )
        .execute(&*state.db)
        .await?;
    }

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(health_check))
        .routes(routes!(catchall::catchall))
        .with_state(state.clone())
        .nest("/api/v1", v1::router(state.clone()))
        .fallback_service(ServeDir::new("web"))
        .split_for_parts();

    std::fs::write("openapi.json", api.to_pretty_json()?.as_bytes()).unwrap();

    let swagger_ui = SwaggerUi::new("/docs").url("/docs/openapi.json", api);
    let router = router.merge(swagger_ui);

    let listener = match TcpListener::bind((Ipv4Addr::LOCALHOST, port)).await {
        Ok(listener) => {
            info!("Listening on http://localhost:{port}");
            listener
        }
        Err(e) => {
            error!("Failed to bind to port {port}: {e}");
            std::process::exit(1);
        }
    };
    axum::serve(listener, router).await?;

    Ok(())
}
