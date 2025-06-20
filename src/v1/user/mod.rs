use crate::AppState;

pub(super) use super::*;

pub mod get_self;

pub const AUTH_TAG: &str = "auth";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_self::get_self))
        .with_state(state)
}
