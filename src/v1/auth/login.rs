use crate::{structs::user::User, *};
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
    // Json(body): Json<LoginBody>,
) -> Response {
    info!("User {} logging in", body.username);
    // TODO: add indices on user for unique lowercase and search
    let lowercase_username = body.username.to_lowercase();
    let user = sqlx::query_as!(
        User,
        "SELECT id, name, username, password_hash, is_admin, created_at
        FROM users
        WHERE username = $1",
        lowercase_username
    )
    .fetch_one(&*state.db)
    .await;

    let user = match user {
        Ok(user) => user,
        Err(sqlx::Error::RowNotFound) => {
            return (StatusCode::NOT_FOUND, "User not found").into_response()
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let argon2 = Argon2::default();
    let hash =
        PasswordHash::parse(&user.password_hash, Encoding::B64).expect("Password hashing failed");

    if !argon2
        .verify_password(body.password.as_bytes(), &hash)
        .is_ok()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password").into_response();
    }

    let claims = JWTClaims::new(user.id, user.name, user.username);
    let token_str = match claims.sign_with_key(&state.jwt_key) {
        Ok(token_str) => token_str,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    (
        StatusCode::SEE_OTHER,
        [
            (
                SET_COOKIE,
                if cfg!(debug_assertions) {
                    format!("short-token={token_str}; Max-Age=86400; Path=/; HttpOnly")
                } else {
                    format!("__Secure-short-token={token_str}; Max-Age=86400; Path=/; HttpOnly; SameSite=Strict; Secure")
                },
            ),
            (LOCATION, "/dashboard".into()),
        ],
    ).into_response()
}
