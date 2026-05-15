use axum::{
    http::{
        header::{LOCATION, SET_COOKIE},
        StatusCode,
    },
    response::Response,
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
    axum::http::Response::builder()
        .status(StatusCode::SEE_OTHER)
        .header(SET_COOKIE, clear_auth_cookie())
        .header(SET_COOKIE, clear_short_auth_companion())
        .header(LOCATION, "/")
        .body(axum::body::Body::empty())
        .unwrap()
}
