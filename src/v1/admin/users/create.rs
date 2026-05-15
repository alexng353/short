use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::http::StatusCode;

use crate::extractors::users::AdminUserId;
use crate::*;

use super::list::AdminUserRow;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CreateUserBody {
    pub name: String,
    pub username: String,
    pub password: String,
    pub is_admin: bool,
}

#[utoipa::path(
    post,
    path = "",
    responses(
        (status = CREATED, body = AdminUserRow),
        (status = CONFLICT, body = String, description = "Username taken"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn create(
    State(state): State<AppState>,
    _: AdminUserId,
    Json(body): Json<CreateUserBody>,
) -> Result<(StatusCode, Json<AdminUserRow>), AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .expect("hash")
        .to_string();

    let res = sqlx::query_as!(
        AdminUserRow,
        "INSERT INTO users (name, username, password_hash, is_admin)
         VALUES ($1, lower($2), $3, $4)
         RETURNING id, name, username, is_admin, disabled_at, created_at",
        body.name,
        body.username,
        hash,
        body.is_admin,
    )
    .fetch_one(&*state.db)
    .await;

    match res {
        Ok(row) => Ok((StatusCode::CREATED, Json(row))),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Status(StatusCode::CONFLICT, "username taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}
