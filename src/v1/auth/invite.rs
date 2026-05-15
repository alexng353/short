use axum::{extract::State, http::StatusCode};

use crate::extractors::users::AdminUserId;

use super::*;

/// Create invite (admin only)
#[utoipa::path(
    post,
    path = "/invite",
    responses(
        (status = OK, body = String, description = "Invite code"),
        (status = UNAUTHORIZED, body = String, description = "Not an admin"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn invite(
    State(state): State<AppState>,
    AdminUserId(user_id): AdminUserId,
) -> (StatusCode, String) {
    let code = nanoid::nanoid!(12);
    sqlx::query!(
        "INSERT INTO invite_codes (user_id, code) VALUES ($1, $2)",
        user_id,
        code
    )
    .execute(&*state.db)
    .await
    .expect("Failed to insert invite");

    (StatusCode::OK, code)
}
