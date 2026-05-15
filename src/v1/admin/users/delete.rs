use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[utoipa::path(
    delete,
    path = "/{id}",
    responses(
        (status = NO_CONTENT, description = "Deleted"),
        (status = CONFLICT, description = "User has shortlinks or is last admin"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn delete(
    State(state): State<AppState>,
    AdminUserId(caller_id): AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    if id == caller_id {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "cannot delete yourself".into(),
        ));
    }

    let owned: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM shortlinks WHERE user_id = $1",
        id
    )
    .fetch_one(&*state.db)
    .await?;
    if owned > 0 {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            format!("user owns {owned} shortlinks; reassign or delete first"),
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

    sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&*state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
