use chrono::Utc;

use crate::*;

#[derive(Serialize, Deserialize)]
pub struct JWTClaims {
    pub sub: i64,
    pub iat: i64,
    pub exp: i64,

    pub real_name: String,
    pub email: String,
}

impl JWTClaims {
    pub fn new(sub: i64, real_name: String, email: String) -> Self {
        let iat = Utc::now().timestamp();
        let exp = iat + 60 * 60 * 24 * 7;
        Self {
            sub,
            iat,
            exp,
            real_name,
            email,
        }
    }

    // /// Create a new JWT Claims with a custom expiration time. Expiration time is added to current time.
    // pub fn new_with_exp(
    //     sub: Uuid,
    //     username: String,
    //     real_name: String,
    //     email: String,
    //     exp: i64,
    // ) -> Self {
    //     let iat = Utc::now().timestamp();
    //     Self {
    //         sub,
    //         iat,
    //         exp: iat + exp,
    //         username,
    //         real_name,
    //         email,
    //     }
    // }
}
