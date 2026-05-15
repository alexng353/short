use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[utoipa::path(
    post,
    path = "/{id}/revoke",
    responses(
        (status = NO_CONTENT, description = "Revoked"),
        (status = CONFLICT, description = "Self-revoke or last-admin disallowed"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn revoke(
    State(state): State<AppState>,
    AdminUserId(caller_id): AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    if id == caller_id {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "cannot revoke yourself".into(),
        ));
    }

    let active_admins: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users
         WHERE is_admin = true AND disabled_at IS NULL AND id != $1",
        id
    )
    .fetch_one(&*state.db)
    .await?;
    if active_admins == 0 {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "must keep at least one active admin".into(),
        ));
    }

    let res = sqlx::query!(
        "UPDATE users
         SET disabled_at = datetime('now','localtime'),
             token_version = token_version + 1
         WHERE id = $1",
        id
    )
    .execute(&*state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::Status(StatusCode::NOT_FOUND, "user not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/{id}/restore",
    responses((status = NO_CONTENT, description = "Restored")),
    tag = super::super::ADMIN_TAG
)]
pub async fn restore(
    State(state): State<AppState>,
    _: AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let res = sqlx::query!(
        "UPDATE users SET disabled_at = NULL WHERE id = $1",
        id
    )
    .execute(&*state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::Status(StatusCode::NOT_FOUND, "user not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}
