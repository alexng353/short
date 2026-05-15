use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

use super::list::AdminUserRow;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateUserBody {
    pub name: Option<String>,
    pub username: Option<String>,
    pub is_admin: Option<bool>,
}

#[utoipa::path(
    patch,
    path = "/{id}",
    responses(
        (status = OK, body = AdminUserRow),
        (status = CONFLICT, description = "Username taken or would leave zero admins"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn update(
    State(state): State<AppState>,
    AdminUserId(caller_id): AdminUserId,
    Path(id): Path<i64>,
    Json(body): Json<UpdateUserBody>,
) -> Result<Json<AdminUserRow>, AppError> {
    // Guard: caller cannot demote themselves
    if id == caller_id && matches!(body.is_admin, Some(false)) {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "cannot demote yourself".into(),
        ));
    }

    // Guard: must keep at least one active admin
    if matches!(body.is_admin, Some(false)) {
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
    }

    let res = sqlx::query_as!(
        AdminUserRow,
        "UPDATE users SET
           name = COALESCE($2, name),
           username = COALESCE(lower($3), username),
           is_admin = COALESCE($4, is_admin)
         WHERE id = $1
         RETURNING id, name, username, is_admin, disabled_at, created_at",
        id,
        body.name,
        body.username,
        body.is_admin,
    )
    .fetch_one(&*state.db)
    .await;

    match res {
        Ok(row) => Ok(Json(row)),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Status(StatusCode::CONFLICT, "username taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}
