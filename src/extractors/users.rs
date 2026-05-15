use crate::*;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};

use cookie::ParseError;
use jwt::VerifyWithKey;
use util::auth::JWTClaims;

pub struct UserId(pub i64);
pub struct AdminUserId(pub i64);

#[derive(sqlx::FromRow)]
struct AuthRow {
    is_admin: bool,
    disabled_at: Option<chrono::NaiveDateTime>,
    token_version: i64,
}

async fn authed_row(parts: &mut Parts, state: &AppState) -> Result<(i64, AuthRow), AppError> {
    let cookie = parts
        .headers
        .get(header::COOKIE)
        .ok_or(AppError::Error(Errors::Unauthorized))?
        .to_str()
        .map_err(|_| AppError::Error(Errors::Unauthorized))?;

    let cookies = cookie::Cookie::split_parse(cookie)
        .collect::<Result<Vec<_>, ParseError>>()
        .map_err(|_| AppError::Error(Errors::Unauthorized))?;

    let cookie = cookies
        .into_iter()
        .find(|c| c.name() == "short-token" || c.name() == "__Secure-short-token")
        .ok_or(AppError::Error(Errors::Unauthorized))?;

    let claims: JWTClaims = cookie
        .value_trimmed()
        .verify_with_key(&state.jwt_key)
        .map_err(|_| AppError::Error(Errors::Unauthorized))?;

    if claims.exp < chrono::Utc::now().timestamp() {
        return Err(AppError::Error(Errors::JWTExpired));
    }

    let row = sqlx::query_as!(
        AuthRow,
        "SELECT is_admin, disabled_at, token_version FROM users WHERE id = $1",
        claims.sub
    )
    .fetch_optional(&*state.db)
    .await?
    .ok_or(AppError::Error(Errors::Unauthorized))?;

    if row.disabled_at.is_some() {
        return Err(AppError::Error(Errors::Unauthorized));
    }
    if row.token_version != claims.tv {
        return Err(AppError::Error(Errors::Unauthorized));
    }

    Ok((claims.sub, row))
}

impl<S> FromRequestParts<S> for UserId
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, s: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(s);
        let (id, _) = authed_row(parts, &state).await?;
        Ok(UserId(id))
    }
}

impl<S> FromRequestParts<S> for AdminUserId
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, s: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(s);
        let (id, row) = authed_row(parts, &state).await?;
        if !row.is_admin {
            return Err(AppError::Error(Errors::Unauthorized));
        }
        Ok(AdminUserId(id))
    }
}
