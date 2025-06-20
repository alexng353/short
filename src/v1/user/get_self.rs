use crate::{extractors::users::UserId, *};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UserResponse {
    id: i64,
    name: String,
    email: String,
}

/// Get self
#[utoipa::path(
    get,
    path = "/self",
    responses(
        (status = OK, body = UserResponse)
    ),
    tag = super::AUTH_TAG
)]
#[axum::debug_handler]
pub async fn get_self(
    State(state): State<AppState>,
    UserId(user_id): UserId,
) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query_as!(
        UserResponse,
        "SELECT id, name, email
        FROM users
        WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await?;

    Ok(Json(user))
}
