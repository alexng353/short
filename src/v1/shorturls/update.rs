use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::UserId;
use crate::util::cloudflare::purge_short;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateBody {
    pub long: String,
}

#[utoipa::path(
    patch,
    path = "/{id}",
    responses(
        (status = NO_CONTENT, description = "Updated"),
        (status = NOT_FOUND, description = "Not found or not owned"),
    ),
    tag = super::SHORTURLS_TAG
)]
pub async fn update(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Path(id): Path<i64>,
    Json(body): Json<UpdateBody>,
) -> Result<StatusCode, AppError> {
    let is_admin: bool = sqlx::query_scalar!(
        "SELECT is_admin FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await?;

    let short: Option<String> = if is_admin {
        sqlx::query!(
            "UPDATE shortlinks
             SET long = $1, updated_at = datetime('now','localtime')
             WHERE id = $2
             RETURNING short",
            body.long,
            id
        )
        .fetch_optional(&*state.db)
        .await?
        .map(|r| r.short)
    } else {
        sqlx::query!(
            "UPDATE shortlinks
             SET long = $1, updated_at = datetime('now','localtime')
             WHERE id = $2 AND user_id = $3
             RETURNING short",
            body.long,
            id,
            user_id
        )
        .fetch_optional(&*state.db)
        .await?
        .map(|r| r.short)
    };

    let Some(short) = short else {
        return Err(AppError::Status(StatusCode::NOT_FOUND, "not found".into()));
    };
    tokio::spawn(async move { purge_short(&short).await });

    Ok(StatusCode::NO_CONTENT)
}
