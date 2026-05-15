pub(super) use utoipa_axum::router::OpenApiRouter;
pub(super) use utoipa_axum::routes;

use crate::AppState;

pub mod admin;
pub mod auth;
pub mod shorturls;
pub mod user;

pub fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .with_state(state.clone())
        .nest("/auth", auth::router(state.clone()))
        .nest("/user", user::router(state.clone()))
        .nest("/shorturls", shorturls::router(state.clone()))
        .nest("/admin", admin::router(state.clone()))
}
