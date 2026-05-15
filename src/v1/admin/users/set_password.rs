use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SetPasswordBody {
    pub password: String,
}

#[utoipa::path(
    post,
    path = "/{id}/password",
    responses((status = NO_CONTENT, description = "Password updated")),
    tag = super::super::ADMIN_TAG
)]
pub async fn set_password(
    State(state): State<AppState>,
    _: AdminUserId,
    Path(id): Path<i64>,
    Json(body): Json<SetPasswordBody>,
) -> Result<StatusCode, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .expect("hash")
        .to_string();

    let res = sqlx::query!(
        "UPDATE users
         SET password_hash = $1, token_version = token_version + 1
         WHERE id = $2",
        hash,
        id
    )
    .execute(&*state.db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::Status(StatusCode::NOT_FOUND, "user not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}
