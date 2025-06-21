use crate::AppState;

pub(super) use super::*;

pub mod login;
pub mod signup;
pub mod invite;

pub const AUTH_TAG: &str = "auth";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(signup::signup))
        .routes(routes!(login::login))
        .routes(routes!(invite::invite))
        .with_state(state)
}
