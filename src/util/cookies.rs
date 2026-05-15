/// Build the HttpOnly auth cookie holding the JWT.
pub fn auth_cookie(token: &str) -> String {
    if cfg!(debug_assertions) {
        format!("short-token={token}; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax")
    } else {
        format!(
            "__Secure-short-token={token}; Max-Age=604800; Path=/; HttpOnly; SameSite=Strict; Secure"
        )
    }
}

/// Clear the auth cookie (used by logout).
pub fn clear_auth_cookie() -> String {
    if cfg!(debug_assertions) {
        "short-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax".to_string()
    } else {
        "__Secure-short-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict; Secure".to_string()
    }
}

/// Non-HttpOnly companion cookie. Purely a client-side hint for routing —
/// the server still validates the JWT in `short-token`.
pub fn short_auth_companion() -> String {
    if cfg!(debug_assertions) {
        "short-auth=1; Max-Age=604800; Path=/; SameSite=Lax".to_string()
    } else {
        "short-auth=1; Max-Age=604800; Path=/; SameSite=Strict; Secure".to_string()
    }
}

/// Clear the non-HttpOnly companion cookie (used by logout).
pub fn clear_short_auth_companion() -> String {
    if cfg!(debug_assertions) {
        "short-auth=; Max-Age=0; Path=/; SameSite=Lax".to_string()
    } else {
        "short-auth=; Max-Age=0; Path=/; SameSite=Strict; Secure".to_string()
    }
}
