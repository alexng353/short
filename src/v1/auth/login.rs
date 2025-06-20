use crate::*;
use argon2::{
    password_hash::{Encoding, PasswordHash, PasswordVerifier},
    Argon2,
};
use axum::http::StatusCode;
use jwt::SignWithKey;
use sqlx::query;
use util::auth::JWTClaims;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LoginBody {
    email: String,
    password: String,
}

/// Login
#[utoipa::path(
    post,
    path = "/login",
    responses(
        (status = OK, body = String, description = "JWT token"),
        (status = UNAUTHORIZED, body = String, description = "Incorrect password"),
        (status = NOT_FOUND, body = String, description = "User not found"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> (StatusCode, String) {
    info!("User {} logging in", body.email);
    // TODO: add indices on user for unique lowercase and search
    let lowercase_email = body.email.to_lowercase();
    let user = query!(
        "SELECT id, name, email, password_hash, is_admin, created_at
        FROM users
        WHERE email = $1",
        lowercase_email
    )
    .fetch_one(&*state.db)
    .await;

    let user = match user {
        Ok(user) => user,
        Err(sqlx::Error::RowNotFound) => return (StatusCode::NOT_FOUND, "User not found".into()),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    let argon2 = Argon2::default();
    let hash =
        PasswordHash::parse(&user.password_hash, Encoding::B64).expect("Password hashing failed");

    if !argon2
        .verify_password(body.password.as_bytes(), &hash)
        .is_ok()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password".into());
    }

    let claims = JWTClaims::new(user.id, user.name, user.email);
    let token_str = match claims.sign_with_key(&state.jwt_key) {
        Ok(token_str) => token_str,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    (StatusCode::OK, token_str)
}
