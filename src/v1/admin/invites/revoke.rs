use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[utoipa::path(
    delete,
    path = "/{id}",
    responses(
        (status = NO_CONTENT, description = "Revoked"),
        (status = NOT_FOUND, description = "Not found or already used"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn revoke(
    State(state): State<AppState>,
    _: AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let res = sqlx::query!(
        "DELETE FROM invite_codes WHERE id = $1 AND used_at IS NULL",
        id
    )
    .execute(&*state.db)
    .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::Status(
            StatusCode::NOT_FOUND,
            "invite not found or already used".into(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}
