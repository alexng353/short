use crate::AppState;

pub(super) use super::*;

pub fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new().with_state(state)
}
