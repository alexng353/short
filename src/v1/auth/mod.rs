use crate::AppState;

pub(super) use super::*;

pub mod login;
pub mod signup;
pub mod invite;
pub mod change_password;
pub mod logout;

pub const AUTH_TAG: &str = "auth";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(signup::signup))
        .routes(routes!(login::login))
        .routes(routes!(invite::invite))
        .routes(routes!(change_password::change_password))
        .routes(routes!(logout::logout))
        .with_state(state)
}
