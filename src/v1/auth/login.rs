use crate::{util::cookies::{auth_cookie, short_auth_companion}, *};
use argon2::{
    password_hash::{Encoding, PasswordHash, PasswordVerifier},
    Argon2,
};
use axum::{
    http::{
        header::{LOCATION, SET_COOKIE},
        StatusCode,
    },
    response::{IntoResponse, Response},
    Form,
};
use jwt::SignWithKey;
use util::auth::JWTClaims;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LoginBody {
    username: String,
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
    Form(body): Form<LoginBody>,
) -> Response {
    info!("User {} logging in", body.username);
    let lowercase_username = body.username.to_lowercase();

    let row = sqlx::query!(
        "SELECT id, name, username, password_hash, is_admin, disabled_at, token_version, created_at
        FROM users WHERE username = $1",
        lowercase_username
    )
    .fetch_optional(&*state.db)
    .await;

    let row = match row {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    if row.disabled_at.is_some() {
        return (StatusCode::UNAUTHORIZED, "Account disabled").into_response();
    }

    let argon2 = Argon2::default();
    let hash = match PasswordHash::parse(&row.password_hash, Encoding::B64) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Bad hash").into_response(),
    };

    if argon2
        .verify_password(body.password.as_bytes(), &hash)
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password").into_response();
    }

    let claims = JWTClaims::new(row.id, row.name, row.username, row.token_version);
    let token_str = match claims.sign_with_key(&state.jwt_key) {
        Ok(t) => t,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    (
        StatusCode::SEE_OTHER,
        [
            (SET_COOKIE, auth_cookie(&token_str)),
            (SET_COOKIE, short_auth_companion()),
            (LOCATION, "/dashboard".into()),
        ],
    )
        .into_response()
}
