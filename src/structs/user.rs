use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize, ToSchema)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub password_hash: String,
    pub is_admin: bool,
    pub created_at: chrono::NaiveDateTime,
}
