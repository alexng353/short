use chrono::Utc;

use crate::*;

#[derive(Serialize, Deserialize)]
pub struct JWTClaims {
    pub sub: i64,
    pub iat: i64,
    pub exp: i64,
    pub tv: i64,

    pub name: String,
    pub username: String,
}

impl JWTClaims {
    pub fn new(sub: i64, name: String, username: String, tv: i64) -> Self {
        let iat = Utc::now().timestamp();
        let exp = iat + 60 * 60 * 24 * 7;
        Self {
            sub,
            iat,
            exp,
            tv,
            name,
            username,
        }
    }
}
