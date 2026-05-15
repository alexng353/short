use crate::AppState;

pub(super) use super::*;

pub mod list;
pub mod create;
pub mod update;
pub mod set_password;
pub mod revoke;
pub mod delete;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(list::list))
        .routes(routes!(create::create))
        .routes(routes!(update::update))
        .routes(routes!(set_password::set_password))
        .routes(routes!(revoke::revoke))
        .routes(routes!(revoke::restore))
        .routes(routes!(delete::delete))
        .with_state(state)
}
