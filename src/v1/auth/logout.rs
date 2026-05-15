use axum::{
    http::{
        header::{LOCATION, SET_COOKIE},
        StatusCode,
    },
    response::{IntoResponse, Response},
};

use crate::util::cookies::{clear_auth_cookie, clear_short_auth_companion};

#[utoipa::path(
    post,
    path = "/logout",
    responses(
        (status = SEE_OTHER, description = "Redirect to /"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn logout() -> Response {
    (
        StatusCode::SEE_OTHER,
        [
            (SET_COOKIE, clear_auth_cookie()),
            (SET_COOKIE, clear_short_auth_companion()),
            (LOCATION, "/".into()),
        ],
    )
        .into_response()
}
