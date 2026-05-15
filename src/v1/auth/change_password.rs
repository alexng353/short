use argon2::{
    password_hash::{rand_core::OsRng, Encoding, PasswordHasher, SaltString},
    Argon2, PasswordHash, PasswordVerifier,
};
use axum::{
    extract::State,
    http::{header::SET_COOKIE, StatusCode},
    response::{IntoResponse, Response},
    Form,
};
use jwt::SignWithKey;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::util::cookies::{auth_cookie, short_auth_companion};
use crate::*;
use crate::{extractors::users::UserId, structs::user::User, util::auth::JWTClaims};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChangePasswordBody {
    old_password: String,
    new_password: String,
}

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
        FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await
    {
        Ok(u) => u,
        Err(sqlx::Error::RowNotFound) => {
            return (StatusCode::NOT_FOUND, "User not found").into_response()
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let old_hash = match PasswordHash::parse(&user.password_hash, Encoding::B64) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Bad hash").into_response(),
    };
    if argon2
        .verify_password(body.old_password.as_bytes(), &old_hash)
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password").into_response();
    }

    let new_hash = argon2
        .hash_password(body.new_password.as_bytes(), &salt)
        .expect("Password hashing failed")
        .to_string();

    let updated = sqlx::query!(
        "UPDATE users
         SET password_hash = $1, token_version = token_version + 1
         WHERE id = $2
         RETURNING token_version",
        new_hash,
        user_id
    )
    .fetch_one(&*state.db)
    .await;

    let new_tv = match updated {
        Ok(r) => r.token_version,
        Err(e) => {
            error!("Failed to update password: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let claims = JWTClaims::new(user.id, user.name, user.username, new_tv);
    let token_str = match claims.sign_with_key(&state.jwt_key) {
        Ok(t) => t,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    axum::http::Response::builder()
        .status(StatusCode::OK)
        .header(SET_COOKIE, auth_cookie(&token_str))
        .header(SET_COOKIE, short_auth_companion())
        .body(axum::body::Body::empty())
        .unwrap()
}
