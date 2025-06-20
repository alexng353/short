use crate::AppState;

pub(super) use super::*;

pub mod login;
pub mod signup;

pub const AUTH_TAG: &str = "auth";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(signup::signup))
        .routes(routes!(login::login))
        .with_state(state)
}
