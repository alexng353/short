use axum::extract::{Path, Query};

use crate::{extractors::users::UserId, structs::shortlink::ShortLink, *};

/// Create a new short URL
#[utoipa::path(
    delete,
    path = "/delete/{id}",
    responses(
        // (status = OK, body = String, description = "Short URL"),
        // (status = UNAUTHORIZED, body = String, description = "User not logged in"),
    ),
    tag = super::SHORTURLS_TAG
)]
pub async fn delete(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Path(id): Path<i64>,
) -> Result<(), AppError> {
    info!("Deleting shortlink with id {id}");
    sqlx::query!(
        "DELETE FROM shortlinks WHERE id = $1 AND user_id = $2",
        id,
        user_id
    )
    .execute(&*state.db)
    .await?;
    Ok(())
}
