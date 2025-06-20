use crate::{extractors::users::UserId, *};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct NewShortUrlBody {
    long: String,
    short: Option<String>,
}

/// Create a new short URL
#[utoipa::path(
    post,
    path = "/new",
    responses(
        (status = OK, body = String, description = "Short URL"),
        (status = UNAUTHORIZED, body = String, description = "User not logged in"),
    ),
    tag = super::SHORTURLS_TAG
)]
pub async fn new(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Json(body): Json<NewShortUrlBody>,
) -> Result<Json<String>, AppError> {
    let short_url = body.short.unwrap_or_else(|| nanoid::nanoid!(8));

    match sqlx::query!(
        "INSERT INTO shortlinks (user_id, long, short) VALUES ($1, $2, $3)",
        user_id,
        body.long,
        short_url
    )
    .execute(&*state.db)
    .await
    {
        Ok(_) => Ok(Json(short_url)),
        Err(sqlx::Error::Database(err)) => {
            eprintln!("Error returned from database: {err}");
            Err(AppError::AnyhowError(err.into()))
        }
        Err(e) => Err(AppError::AnyhowError(e.into())),
    }
}
