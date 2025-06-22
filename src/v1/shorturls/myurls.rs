use axum::extract::Query;

use crate::{extractors::users::UserId, structs::shortlink::ShortLink, *};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct MyUrlsQuery {
    page: Option<i64>,
    limit: Option<i64>,
}

/// Create a new short URL
#[utoipa::path(
    get,
    path = "/myurls",
    responses(
        // (status = OK, body = String, description = "Short URL"),
        // (status = UNAUTHORIZED, body = String, description = "User not logged in"),
    ),
    tag = super::SHORTURLS_TAG
)]
pub async fn myurls(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Query(query): Query<MyUrlsQuery>,
) -> Result<Json<Vec<ShortLink>>, AppError> {
    // let limit = query.limit.unwrap_or(10);
    // let page = (query.page.unwrap_or(1) - 1) * limit;

    // pagination disabled for now
    let urls = sqlx::query_as!(
        ShortLink,
        "SELECT * FROM shortlinks WHERE user_id = $1 ORDER BY created_at DESC",
        // "SELECT * FROM shortlinks WHERE user_id = $1
        //     ORDER BY created_at DESC
        //     LIMIT $2 OFFSET $3",
        user_id,
        // limit,
        // page
    )
    .fetch_all(&*state.db)
    .await?;

    Ok(Json(urls))
}
