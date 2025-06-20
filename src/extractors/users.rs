use crate::*;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};

use jwt::VerifyWithKey;
use sqlx::types::Uuid;
use util::auth::JWTClaims;

/// Remember, this is FromRequestParts, so it has to be ABOVE the extractors
/// that eat the entire request
pub struct UserId(pub Uuid);

impl<S> FromRequestParts<S> for UserId
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        s: &S,
    ) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(s);

        let jwt_string = parts
            .headers
            .get(header::AUTHORIZATION)
            .ok_or(AppError::Error(Errors::Unauthorized))?
            .to_str()
            .map_err(|_| AppError::Error(Errors::Unauthorized))?
            .trim_start_matches("Bearer ");

        let claims: JWTClaims = jwt_string
            .verify_with_key(&state.jwt_key)
            .map_err(|_| AppError::Error(Errors::Unauthorized))?;

        if claims.exp < chrono::Utc::now().timestamp() {
            return Err(AppError::Error(Errors::JWTExpired));
        }

        Ok(UserId(claims.sub))
    }
}
