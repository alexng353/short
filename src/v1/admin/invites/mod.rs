use crate::AppState;

pub(super) use super::*;

pub mod list;
pub mod revoke;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(list::list))
        .routes(routes!(revoke::revoke))
        .with_state(state)
}
