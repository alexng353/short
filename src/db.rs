use anyhow::{Context, Result};
use sqlx::sqlite::SqlitePoolOptions;

pub async fn db() -> Result<sqlx::Pool<sqlx::Sqlite>> {
    let db_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
    Ok(SqlitePoolOptions::new()
        .max_connections(8)
        .connect(&db_url)
        .await?)
}
