use crate::AppState;

pub(super) use super::*;

pub const SHORTURLS_TAG: &str = "shorturls";

pub mod myurls;
pub mod new;
pub mod delete;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(new::new))
        .routes(routes!(myurls::myurls))
        .routes(routes!(delete::delete))
        .with_state(state)
}
