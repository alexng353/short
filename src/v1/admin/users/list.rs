use crate::extractors::users::AdminUserId;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct AdminUserRow {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub is_admin: bool,
    pub disabled_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

#[utoipa::path(
    get,
    path = "",
    responses((status = OK, body = Vec<AdminUserRow>)),
    tag = super::super::ADMIN_TAG
)]
pub async fn list(
    State(state): State<AppState>,
    _: AdminUserId,
) -> Result<Json<Vec<AdminUserRow>>, AppError> {
    let rows = sqlx::query_as!(
        AdminUserRow,
        "SELECT id, name, username, is_admin, disabled_at, created_at
         FROM users ORDER BY id"
    )
    .fetch_all(&*state.db)
    .await?;
    Ok(Json(rows))
}
