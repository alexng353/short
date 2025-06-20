use crate::AppState;

pub(super) use super::*;

pub const SHORTURLS_TAG: &str = "shorturls";

pub mod new;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(new::new))
        .with_state(state)
}
