use crate::*;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use jwt::SignWithKey;
use sqlx::query;
use util::auth::JWTClaims;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SignupBody {
    invite_code: String,
    name: String,
    username: String,
    password: String,
}

/// Sign up
#[utoipa::path(post, path = "/signup", responses((status = OK, body = String)), tag = super::AUTH_TAG)]
pub async fn signup(
    State(state): State<AppState>,
    Json(body): Json<SignupBody>,
) -> Result<String, AppError> {
    if body.invite_code.is_empty() {
        return Err(Errors::Unauthorized.into());
    }

    let invite_code = sqlx::query!(
        "SELECT * FROM invite_codes WHERE code = $1",
        body.invite_code
    )
    .fetch_optional(&*state.db)
    .await?;

    match invite_code {
        Some(invite_code) => match invite_code.used_at {
            Some(_) => return Err(Errors::Unauthorized.into()),
            None => {
                sqlx::query!(
                    "UPDATE invite_codes SET used_at = (datetime('now', 'localtime')) WHERE code = $1",
                    body.invite_code
                )
                .execute(&*state.db)
                .await?;
            }
        },
        None => {
            return Err(Errors::Unauthorized.into());
        }
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(body.password.as_bytes(), &salt)
        .expect("Password hashing failed")
        .to_string();

    let user = query!(
        "INSERT INTO users (name, username, password_hash)
        VALUES ($1, lower($2), $3)
        RETURNING id, name, username, password_hash, is_admin, created_at",
        body.name,
        body.username,
        hash
    )
    .fetch_one(&*state.db)
    .await?;

    let claims = JWTClaims::new(user.id, user.name, user.username);

    let token_str = claims
        .sign_with_key(&state.jwt_key)
        .context("Failed to sign JWT")?;

    Ok(token_str)
}
