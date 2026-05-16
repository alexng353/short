use axum::http::StatusCode;

use crate::extractors::users::UserId;
use crate::*;

use super::get_self::UserResponse;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateSelfBody {
    pub name: Option<String>,
    pub username: Option<String>,
}

#[utoipa::path(
    patch,
    path = "/self",
    responses(
        (status = OK, body = UserResponse),
        (status = CONFLICT, description = "Username taken"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn update_self(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Json(body): Json<UpdateSelfBody>,
) -> Result<Json<UserResponse>, AppError> {
    let res = sqlx::query_as!(
        UserResponse,
        "UPDATE users SET
           name = COALESCE($2, name),
           username = COALESCE(lower($3), username)
         WHERE id = $1
         RETURNING id, name, username, is_admin",
        user_id,
        body.name,
        body.username
    )
    .fetch_one(&*state.db)
    .await;

    match res {
        Ok(r) => Ok(Json(r)),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Status(StatusCode::CONFLICT, "username taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}
