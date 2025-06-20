use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize, ToSchema)]
pub struct ShortLink {
    pub id: i64,
    pub user_id: i64,
    pub long: String,
    pub short: String,
    pub created_at: chrono::NaiveDateTime,
}
