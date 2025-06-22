use axum::{
    http::{
        header::{LOCATION, SET_COOKIE},
        StatusCode,
    },
    response::{IntoResponse, Response},
};

/// Logout
#[utoipa::path(
    post,
    path = "/logout",
    responses(
        (status = SEE_OTHER, description = "Redirect to dashboard"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn logout() -> Response {
    (
        StatusCode::SEE_OTHER,
        [
            (
                SET_COOKIE,
                if cfg!(debug_assertions) {
                    format!("short-token=; Max-Age=86400; Path=/; HttpOnly")
                } else {
                    format!("__Secure-short-token=; Max-Age=86400; Path=/; HttpOnly; SameSite=Strict; Secure")
                },
            ),
            (LOCATION, "/dashboard".into()),
        ]
    )
        .into_response()
}
