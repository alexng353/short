use axum::{
    extract::{Path, State},
    http::{
        header::{CACHE_CONTROL, LOCATION},
        StatusCode,
    },
    response::{IntoResponse, Response},
};
use tracing::error;

use crate::{structs::shortlink::ShortLink, AppState};

#[utoipa::path(
    get,
    path = "/s/{short}",
    responses(
        (status = OK, description = "Success", body = str, content_type = "text/plain")
    ),
    params(
        ("short" = String, Path, description = "Short URL")
    )
)]
pub async fn catchall(State(state): State<AppState>, Path(short): Path<String>) -> Response {
    let ttl = std::env::var("TTL")
        .unwrap_or("3600".to_string())
        .parse::<u32>()
        .unwrap();

    match sqlx::query_as!(
        ShortLink,
        "SELECT * FROM shortlinks WHERE short = $1",
        short
    )
    .fetch_one(&*state.db)
    .await
    {
        Ok(long) => (
            StatusCode::TEMPORARY_REDIRECT,
            [
                (LOCATION, long.long),
                (
                    CACHE_CONTROL,
                    format!("public, max-age={ttl}, s-maxage={ttl}"),
                ),
            ],
        )
            .into_response(),
        Err(sqlx::Error::RowNotFound) => {
            (StatusCode::NOT_FOUND, "Short URL not found").into_response()
        }
        Err(e) => {
            let error_id = uuid::Uuid::new_v4();
            error!("Error {} - {}", error_id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("INTERNAL SERVER ERROR\nTrace ID: {}", error_id),
            )
                .into_response()
        }
    }
}
