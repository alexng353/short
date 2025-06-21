use axum::{extract::State, http::StatusCode};

use crate::extractors::users::UserId;

use super::*;

/// create invite
#[utoipa::path(
    post,
    path = "/invite",
    responses(
        // (status = OK, body = String, description = "JWT token"),
        // (status = UNAUTHORIZED, body = String, description = "Incorrect password"),
        // (status = NOT_FOUND, body = String, description = "User not found"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn invite(
    State(state): State<AppState>,
    UserId(user_id): UserId,
) -> (StatusCode, String) {
    let is_admin = sqlx::query!("SELECT is_admin FROM users WHERE id = $1", user_id)
        .fetch_one(&*state.db)
        .await
        .expect("Failed to fetch user")
        .is_admin;

    if !is_admin {
        return (StatusCode::UNAUTHORIZED, "You are not an admin".into());
    }

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
