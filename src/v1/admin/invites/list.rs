use crate::extractors::users::AdminUserId;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct InviteRow {
    pub id: i64,
    pub code: String,
    pub used_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub created_by_username: String,
}

#[utoipa::path(
    get,
    path = "",
    responses((status = OK, body = Vec<InviteRow>)),
    tag = super::super::ADMIN_TAG
)]
pub async fn list(
    State(state): State<AppState>,
    _: AdminUserId,
) -> Result<Json<Vec<InviteRow>>, AppError> {
    let rows = sqlx::query_as!(
        InviteRow,
        "SELECT i.id, i.code, i.used_at, i.created_at, u.username AS created_by_username
         FROM invite_codes i
         JOIN users u ON u.id = i.user_id
         WHERE i.used_at IS NULL
         ORDER BY i.created_at DESC"
    )
    .fetch_all(&*state.db)
    .await?;
    Ok(Json(rows))
}
