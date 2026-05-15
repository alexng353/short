use serde_json::json;
use tracing::{error, warn};

/// Fire a Cloudflare purge for /s/<short> on PUBLIC_HOST. Reads creds from env;
/// missing env vars produce a warn-log and a no-op return. Network failures are
/// also log-only — the cache TTL will expire on its own.
pub async fn purge_short(short: &str) {
    let Ok(token) = std::env::var("CF_API_TOKEN") else {
        warn!("CF_API_TOKEN unset; skipping cache purge");
        return;
    };
    let Ok(zone) = std::env::var("CF_ZONE_ID") else {
        warn!("CF_ZONE_ID unset; skipping cache purge");
        return;
    };
    let Ok(host) = std::env::var("PUBLIC_HOST") else {
        warn!("PUBLIC_HOST unset; skipping cache purge");
        return;
    };

    let url = format!(
        "https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache"
    );
    let file = format!("https://{host}/s/{short}");
    let body = json!({ "files": [file] });

    let client = match reqwest::Client::builder().build() {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to build reqwest client: {e}");
            return;
        }
    };

    let res = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await;

    match res {
        Ok(r) if r.status().is_success() => {}
        Ok(r) => error!(
            "Cloudflare purge failed: status={} body={:?}",
            r.status(),
            r.text().await.unwrap_or_default()
        ),
        Err(e) => error!("Cloudflare purge request errored: {e}"),
    }
}
