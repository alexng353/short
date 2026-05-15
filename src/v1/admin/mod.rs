use crate::AppState;

pub(super) use super::*;

pub mod users;
pub mod invites;

pub const ADMIN_TAG: &str = "admin";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .with_state(state.clone())
        .nest("/users", users::router(state.clone()))
        .nest("/invites", invites::router(state.clone()))
}
