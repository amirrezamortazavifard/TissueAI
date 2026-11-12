//! Remote provider chat calls: OpenAI chat/completions (verbatim) or via a
//! translating converter (Anthropic /messages, Google generateContent, OpenAI
//! /v1/responses). Ported from Jan's `core/server/proxy.rs` request path,
//! minus the HTTP server: this module talks straight to the upstream provider.
//!
//! Key-chain behavior: every API key registered for the provider is tried in
//! order; on HTTP 401/403/429 the next key is used. Custom headers from the
//! provider config are attached to every attempt, and the converter decides
//! the auth scheme (Google uses `x-goog-api-key`, Anthropic `x-api-key`).

use futures::StreamExt;
use reqwest::StatusCode;
use serde_json::Value;

use crate::llm::converters::{
    converter_for, SseAccumulator, StreamState, UpstreamConverter,
};
use crate::llm::remote_providers::ProviderConfig;

/// True when an upstream status means "bad/expired/ratelimited key" and the
/// request should be retried with the next key in the chain.
pub(crate) fn http_status_indicates_api_key_retry(status: StatusCode) -> bool {
    matches!(
        status,
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS
    )
}

/// Resolve the upstream URL for a provider + request body.
fn upstream_url(config: &ProviderConfig, body: &Value) -> Result<String, String> {
    let base_url = config
        .base_url
        .as_deref()
        .ok_or_else(|| format!("Missing base_url for provider '{}'", config.provider))?;
    let base_url = base_url.trim_end_matches('/');
    let converter = converter_for(config.api_type.as_deref());
    let path = match &converter {
        Some(c) => c.upstream_path(body),
        None => "/chat/completions".to_string(),
    };
    Ok(format!("{base_url}{path}"))
}

/// Build the per-attempt request: custom headers + auth (converter-decided) +
/// converter extra headers. Body is re-buffered by reqwest, so no stale
/// Content-Length concerns.
fn build_request(
    client: &reqwest::Client,
    url: &str,
    config: &ProviderConfig,
    converter: Option<&dyn UpstreamConverter>,
    key_opt: Option<&str>,
    body_bytes: Vec<u8>,
) -> reqwest::RequestBuilder {
    let mut req = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept-Encoding", "identity");

    for h in &config.custom_headers {
        req = req.header(&h.header, &h.value);
    }

    if let Some(key) = key_opt {
        // The converter decides the auth scheme (Google uses x-goog-api-key).
        let (auth_name, auth_value) = match converter {
            Some(conv) => conv.auth_header(key),
            None => ("authorization", format!("Bearer {key}")),
        };
        req = req.header(auth_name, auth_value);
    } else {
        log::debug!("No API key for this attempt");
    }

    // Fixed headers the native API requires (Anthropic: anthropic-version).
    if let Some(conv) = converter {
        for (name, value) in conv.extra_headers() {
            req = req.header(name, value);
        }
    }

    req.body(body_bytes)
}

/// Send a non-streaming chat/completions request to a remote provider, trying
/// each API key in the chain on 401/403/429. Returns the OpenAI-shaped
/// response (already translated back to chat/completions when a converter is
/// engaged).
pub async fn chat_completions(
    client: &reqwest::Client,
    config: &ProviderConfig,
    body: &Value,
) -> Result<Value, String> {
    let url = upstream_url(config, body)?;
    let converter = converter_for(config.api_type.as_deref());
    let key_chain = config.bearer_key_chain();
    let key_attempts: Vec<Option<String>> = if key_chain.is_empty() {
        vec![None]
    } else {
        key_chain.iter().cloned().map(Some).collect()
    };
    let body_bytes = body.to_string().into_bytes();

    let mut last_err = String::new();
    for (idx, key_opt) in key_attempts.iter().enumerate() {
        let req = build_request(
            client,
            &url,
            config,
            converter.as_deref(),
            key_opt.as_deref(),
            body_bytes.clone(),
        );

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Upstream request failed: {e}")),
        };

        let status = resp.status();
        let is_error = !status.is_success();

        if is_error && http_status_indicates_api_key_retry(status) && idx + 1 < key_attempts.len()
        {
            let _ = resp.text().await;
            log::warn!("Upstream {status} for API key index {idx}, trying next key");
            continue;
        }

        let text = resp.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            last_err = format!("Upstream returned HTTP {status}: {text}");
            continue;
        }

        let upstream: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse upstream JSON: {e}. Body: {text}"))?;

        return match converter {
            Some(conv) => Ok(conv.convert_response(&upstream)),
            None => Ok(upstream),
        };
    }

    Err(if last_err.is_empty() {
        "Upstream key chain exhausted without a response".to_string()
    } else {
        last_err
    })
}

/// Send a streaming chat/completions request. `on_chunk` receives each raw
/// body fragment as it arrives: for verbatim OpenAI upstreams these are the
/// SSE frames as-is; for converted upstreams they are chat/completions SSE
/// `data: {payload}\n\n` frames re-emitted by the converter.
pub async fn chat_completions_stream(
    client: &reqwest::Client,
    config: &ProviderConfig,
    body: &Value,
    mut on_chunk: impl FnMut(String),
) -> Result<(), String> {
    let url = upstream_url(config, body)?;
    let converter = converter_for(config.api_type.as_deref());
    let key_chain = config.bearer_key_chain();
    let key_attempts: Vec<Option<String>> = if key_chain.is_empty() {
        vec![None]
    } else {
        key_chain.iter().cloned().map(Some).collect()
    };
    let body_bytes = body.to_string().into_bytes();

    let mut last_err = String::new();
    for (idx, key_opt) in key_attempts.iter().enumerate() {
        let req = build_request(
            client,
            &url,
            config,
            converter.as_deref(),
            key_opt.as_deref(),
            body_bytes.clone(),
        );

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Err(format!("Upstream request failed: {e}")),
        };

        let status = resp.status();
        let is_error = !status.is_success();

        if is_error && http_status_indicates_api_key_retry(status) && idx + 1 < key_attempts.len()
        {
            let _ = resp.text().await;
            log::warn!("Upstream {status} for API key index {idx}, trying next key");
            continue;
        }

        if is_error {
            let text = resp.text().await.map_err(|e| e.to_string())?;
            last_err = format!("Upstream returned HTTP {status}: {text}");
            continue;
        }

        // Success — forward the body stream.
        if let Some(converter) = converter {
            let is_sse = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|ct| ct.contains("event-stream"))
                .unwrap_or(false);
            if is_sse {
                forward_converted_stream(resp.bytes_stream(), &mut on_chunk, converter).await;
            } else {
                let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
                let out = match serde_json::from_slice::<Value>(&bytes) {
                    Ok(v) => serde_json::to_vec(&converter.convert_response(&v))
                        .unwrap_or_else(|_| bytes.to_vec()),
                    Err(_) => bytes.to_vec(),
                };
                on_chunk(String::from_utf8_lossy(&out).to_string());
            }
            return Ok(());
        }

        // Verbatim passthrough.
        let mut stream = resp.bytes_stream();
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    on_chunk(String::from_utf8_lossy(&chunk).to_string());
                }
                Err(e) => {
                    log::error!("Upstream stream error: {e}");
                    break;
                }
            }
        }
        return Ok(());
    }

    Err(if last_err.is_empty() {
        "Upstream key chain exhausted without a response".to_string()
    } else {
        last_err
    })
}

/// Stream a native upstream response through an [`UpstreamConverter`], emitting
/// chat/completions SSE `data:` frames. Uses [`SseAccumulator`] so events split
/// across network chunks are reassembled before translation.
async fn forward_converted_stream<S>(
    mut stream: S,
    on_chunk: &mut impl FnMut(String),
    converter: Box<dyn UpstreamConverter>,
) where
    S: futures::Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin,
{
    let mut acc = SseAccumulator::new();
    let mut state = StreamState::default();
    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let text = String::from_utf8_lossy(&chunk);
                for event in acc.push(&text) {
                    for payload in converter.convert_stream_event(&event, &mut state) {
                        on_chunk(format!("data: {payload}\n\n"));
                    }
                }
            }
            Err(e) => {
                log::error!("Converter stream error: {e}");
                break;
            }
        }
    }
    if let Some(event) = acc.finish() {
        for payload in converter.convert_stream_event(&event, &mut state) {
            on_chunk(format!("data: {payload}\n\n"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_statuses_match() {
        assert!(http_status_indicates_api_key_retry(StatusCode::UNAUTHORIZED));
        assert!(http_status_indicates_api_key_retry(StatusCode::FORBIDDEN));
        assert!(http_status_indicates_api_key_retry(StatusCode::TOO_MANY_REQUESTS));
        assert!(!http_status_indicates_api_key_retry(StatusCode::BAD_REQUEST));
        assert!(!http_status_indicates_api_key_retry(StatusCode::INTERNAL_SERVER_ERROR));
        assert!(!http_status_indicates_api_key_retry(StatusCode::OK));
    }

    #[test]
    fn url_paths() {
        let openai = ProviderConfig {
            provider: "openai".into(),
            base_url: Some("https://api.openai.com/v1".into()),
            ..Default::default()
        };
        assert_eq!(
            upstream_url(&openai, &serde_json::json!({})).unwrap(),
            "https://api.openai.com/v1/chat/completions"
        );

        let anthropic = ProviderConfig {
            provider: "anthropic".into(),
            base_url: Some("https://api.anthropic.com/v1".into()),
            api_type: Some("anthropic".into()),
            ..Default::default()
        };
        assert_eq!(
            upstream_url(&anthropic, &serde_json::json!({})).unwrap(),
            "https://api.anthropic.com/v1/messages"
        );

        let google = ProviderConfig {
            provider: "gemini".into(),
            base_url: Some("https://generativelanguage.googleapis.com/v1beta".into()),
            api_type: Some("google".into()),
            ..Default::default()
        };
        assert_eq!(
            upstream_url(&google, &serde_json::json!({"model": "gemini-2.5-pro"})).unwrap(),
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"
        );
    }
}
