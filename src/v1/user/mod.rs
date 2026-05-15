use crate::AppState;

pub(super) use super::*;

pub mod get_self;
pub mod update;

pub const AUTH_TAG: &str = "auth";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_self::get_self))
        .routes(routes!(update::update_self))
        .with_state(state)
}
