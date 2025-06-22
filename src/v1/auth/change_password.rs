use argon2::{
    password_hash::{rand_core::OsRng, Encoding, PasswordHasher, SaltString},
    Argon2, PasswordHash, PasswordVerifier,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Form,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::*;
use crate::{extractors::users::UserId, structs::user::User};

use super::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChangePasswordBody {
    change_password: String,
    new_password: String,
}

/// create invite
#[utoipa::path(
    post,
    path = "/change-password",
    responses(
        (status = OK, description = "Success"),
        (status = INTERNAL_SERVER_ERROR, description = "Internal server error"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn change_password(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Form(body): Form<ChangePasswordBody>,
) -> Response {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let user = match sqlx::query_as!(
        User,
        "SELECT id, name, username, password_hash, is_admin, created_at
        FROM users
        WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await
    {
        Ok(user) => user,
        Err(sqlx::Error::RowNotFound) => {
            return (StatusCode::NOT_FOUND, "User not found").into_response()
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let hash =
        PasswordHash::parse(&user.password_hash, Encoding::B64).expect("Password hashing failed");

    if !argon2
        .verify_password(body.change_password.as_bytes(), &hash)
        .is_ok()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password").into_response();
    }

    let hash = argon2
        .hash_password(body.new_password.as_bytes(), &salt)
        .expect("Password hashing failed")
        .to_string();

    match sqlx::query!(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        hash,
        user_id
    )
    .execute(&*state.db)
    .await
    {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => {
            error!("Failed to update password: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
