use anyhow::Result;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, delete};
use axum::{Json, Router};
use axum::response::sse::Event;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tokio_stream::wrappers::ReceiverStream;
use tower_http::cors::{Any, CorsLayer};

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_image: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_time_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub session_id: String,
    pub message: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RenameRequest {
    pub title: String,
}

// ── Monitoring Types ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActivity {
    pub user_id: String,
    pub ip_address: String,
    pub first_seen: String,
    pub last_seen: String,
    pub total_messages: u64,
    pub total_sessions: u64,
    pub is_active: bool,
    #[serde(default)]
    pub total_tokens: u64,
    #[serde(default)]
    pub total_input_tokens: u64,
    #[serde(default)]
    pub total_output_tokens: u64,
    #[serde(default)]
    pub total_images: u64,
    #[serde(default)]
    pub avg_response_time_ms: u64,
    #[serde(default)]
    pub total_response_time_ms: u64,
    #[serde(default)]
    pub response_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLogEntry {
    pub timestamp: String,
    pub user_id: String,
    pub action: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyActivity {
    pub hour: String,
    pub messages: u64,
    pub tokens: u64,
    pub images: u64,
    pub unique_users: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStats {
    pub total_users: usize,
    pub active_users: usize,
    pub total_sessions: usize,
    pub total_messages: usize,
    pub online_now: usize,
    pub total_tokens: u64,
    pub total_images: u64,
    pub avg_response_time: f64,
    pub messages_last_hour: usize,
    pub messages_last_24h: usize,
}

#[derive(Debug, Clone)]
pub struct WebServerConfig {
    pub port: u16,
    pub llama_server_port: u16,
    pub data_dir: PathBuf,
    pub bind_to_lan: bool,
}

impl WebServerConfig {
    pub fn clone_fields(&self) -> Self {
        Self {
            port: self.port,
            llama_server_port: self.llama_server_port,
            data_dir: self.data_dir.clone(),
            bind_to_lan: self.bind_to_lan,
        }
    }
}

pub struct WebServerState {
    pub config: WebServerConfig,
    pub sessions: RwLock<HashMap<String, ChatSession>>,
    pub user_activity: RwLock<HashMap<String, UserActivity>>,
    pub activity_log: RwLock<Vec<ActivityLogEntry>>,
    pub active_connections: RwLock<HashMap<String, String>>, // user_id -> ip
    pub active_connection_times: RwLock<HashMap<String, chrono::DateTime<chrono::Utc>>>,
    pub hourly_activity: RwLock<Vec<HourlyActivity>>,
    pub error_log: RwLock<Vec<ActivityLogEntry>>,
}

// ── File persistence ─────────────────────────────────────────────────────────

fn sessions_file(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("chat_sessions.json")
}

fn activity_file(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("activity_log.json")
}

fn user_activity_file(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("user_activity.json")
}

fn load_sessions(data_dir: &std::path::Path) -> HashMap<String, ChatSession> {
    let path = sessions_file(data_dir);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(sessions) = serde_json::from_str(&content) {
                return sessions;
            }
        }
    }
    HashMap::new()
}

pub fn save_sessions(data_dir: &std::path::Path, sessions: &HashMap<String, ChatSession>) -> Result<()> {
    let path = sessions_file(data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(sessions)?)?;
    Ok(())
}

fn load_user_activity(data_dir: &std::path::Path) -> HashMap<String, UserActivity> {
    let path = user_activity_file(data_dir);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(activity) = serde_json::from_str(&content) {
                return activity;
            }
        }
    }
    HashMap::new()
}

pub fn save_user_activity(data_dir: &std::path::Path, activity: &HashMap<String, UserActivity>) -> Result<()> {
    let path = user_activity_file(data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(activity)?)?;
    Ok(())
}

fn load_activity_log(data_dir: &std::path::Path) -> Vec<ActivityLogEntry> {
    let path = activity_file(data_dir);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(log) = serde_json::from_str(&content) {
                return log;
            }
        }
    }
    Vec::new()
}

fn save_activity_log(data_dir: &std::path::Path, log: &[ActivityLogEntry]) -> Result<()> {
    let path = activity_file(data_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    // Keep only last 1000 entries
    let truncated: Vec<_> = log.iter().rev().take(1000).cloned().collect();
    std::fs::write(path, serde_json::to_string_pretty(&truncated)?)?;
    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn extract_user_id(headers: &HeaderMap) -> Option<String> {
    headers.get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

fn extract_ip(headers: &HeaderMap) -> String {
    // Try X-Forwarded-For first (for proxied requests)
    if let Some(ip) = headers.get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
    {
        if !ip.is_empty() && ip != "unknown" {
            return ip;
        }
    }
    // Try X-Real-IP
    if let Some(ip) = headers.get("X-Real-IP")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
    {
        if !ip.is_empty() && ip != "unknown" {
            return ip;
        }
    }
    "unknown".to_string()
}

fn extract_or_create_user_id(headers: &HeaderMap) -> String {
    // Check X-User-Id header first
    if let Some(uid) = extract_user_id(headers) {
        return uid;
    }
    // Check cookie
    if let Some(cookie) = headers.get("cookie").and_then(|v| v.to_str().ok()) {
        for pair in cookie.split(';') {
            let pair = pair.trim();
            if let Some(val) = pair.strip_prefix("llm_user_id=") {
                return val.to_string();
            }
        }
    }
    // Generate new user ID
    format!("user_{}", uuid::Uuid::new_v4().to_string().replace('-', ""))
}

fn llama_url(state: &WebServerState) -> String {
    format!("http://127.0.0.1:{}", state.config.llama_server_port)
}

async fn log_activity(
    state: &WebServerState,
    user_id: &str,
    ip: &str,
    action: &str,
    details: &str,
) {
    let now = chrono::Utc::now().to_rfc3339();

    // Update user activity
    {
        let mut activity = state.user_activity.write().await;
        let entry = activity.entry(user_id.to_string()).or_insert_with(|| UserActivity {
            user_id: user_id.to_string(),
            ip_address: ip.to_string(),
            first_seen: now.clone(),
            last_seen: now.clone(),
            total_messages: 0,
            total_sessions: 0,
            is_active: true,
            total_tokens: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_images: 0,
            avg_response_time_ms: 0,
            total_response_time_ms: 0,
            response_count: 0,
        });
        entry.last_seen = now.clone();
        entry.ip_address = ip.to_string();
        entry.is_active = true;
    }

    // Add to activity log
    {
        let mut log = state.activity_log.write().await;
        log.push(ActivityLogEntry {
            timestamp: now,
            user_id: user_id.to_string(),
            action: action.to_string(),
            details: details.to_string(),
        });
        let _ = save_activity_log(&state.config.data_dir, &log);
    }
}

async fn log_error(state: &WebServerState, user_id: &str, ip: &str, error_type: &str, details: &str) {
    let enriched = format!("[{}] {}", ip, details);
    let entry = ActivityLogEntry {
        timestamp: chrono::Utc::now().to_rfc3339(),
        user_id: user_id.to_string(),
        action: error_type.to_string(),
        details: enriched,
    };
    let mut log = state.error_log.write().await;
    log.push(entry);
    if log.len() > 500 {
        let drain = log.len() - 500;
        log.drain(0..drain);
    }
    log::error!("[{}|{}] {}: {}", user_id, ip, error_type, details);
}

// ── Session handlers ─────────────────────────────────────────────────────────

async fn list_sessions_handler(
    State(state): State<Arc<WebServerState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<ChatSession>>, StatusCode> {
    let user_id = extract_user_id(&headers).ok_or(StatusCode::BAD_REQUEST)?;
    let ip = extract_ip(&headers);

    // Track connection and create user if not exists
    {
        let mut activity = state.user_activity.write().await;
        if let Some(entry) = activity.get_mut(&user_id) {
            entry.is_active = true;
            entry.last_seen = chrono::Utc::now().to_rfc3339();
            entry.ip_address = ip.clone();
        } else {
            let now = chrono::Utc::now().to_rfc3339();
            activity.insert(user_id.clone(), UserActivity {
                user_id: user_id.clone(),
                ip_address: ip.clone(),
                first_seen: now.clone(),
                last_seen: now,
                total_messages: 0,
                total_sessions: 0,
                is_active: true,
                total_tokens: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_images: 0,
                avg_response_time_ms: 0,
                total_response_time_ms: 0,
                response_count: 0,
            });
        }
    }

    // Track active connection
    {
        let mut active = state.active_connections.write().await;
        let mut times = state.active_connection_times.write().await;
        active.insert(user_id.clone(), ip.clone());
        times.insert(user_id.clone(), chrono::Utc::now());
    }

    log_activity(&state, &user_id, &ip, "list_sessions", "").await;

    let sessions = state.sessions.read().await;
    let mut list: Vec<ChatSession> = sessions.values()
        .filter(|s| s.user_id == user_id)
        .cloned()
        .collect();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(Json(list))
}

async fn create_session_handler(
    State(state): State<Arc<WebServerState>>,
    headers: HeaderMap,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<ChatSession>, StatusCode> {
    let user_id = extract_user_id(&headers).ok_or(StatusCode::BAD_REQUEST)?;
    let ip = extract_ip(&headers);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let session = ChatSession {
        id: id.clone(),
        user_id: user_id.clone(),
        title: req.title.unwrap_or_else(|| "New Chat".to_string()),
        messages: Vec::new(),
        created_at: now.clone(),
        updated_at: now,
    };
    let mut sessions = state.sessions.write().await;
    sessions.insert(id, session.clone());
    let _ = save_sessions(&state.config.data_dir, &sessions);

    // Update stats and track connection
    {
        let mut activity = state.user_activity.write().await;
        if let Some(entry) = activity.get_mut(&user_id) {
            entry.total_sessions += 1;
            entry.is_active = true;
            entry.last_seen = chrono::Utc::now().to_rfc3339();
            entry.ip_address = ip.clone();
        } else {
            // Create new user activity if not exists
            let now = chrono::Utc::now().to_rfc3339();
            activity.insert(user_id.clone(), UserActivity {
                user_id: user_id.clone(),
                ip_address: ip.clone(),
                first_seen: now.clone(),
                last_seen: now,
                total_messages: 0,
                total_sessions: 1,
                is_active: true,
                total_tokens: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_images: 0,
                avg_response_time_ms: 0,
                total_response_time_ms: 0,
                response_count: 0,
            });
        }
    }

    // Track active connection
    {
        let mut active = state.active_connections.write().await;
        let mut times = state.active_connection_times.write().await;
        active.insert(user_id.clone(), ip.clone());
        times.insert(user_id.clone(), chrono::Utc::now());
    }

    log_activity(&state, &user_id, &ip, "create_session", &session.title).await;
    Ok(Json(session))
}

async fn get_session_handler(
    State(state): State<Arc<WebServerState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ChatSession>, StatusCode> {
    let user_id = extract_user_id(&headers).ok_or(StatusCode::BAD_REQUEST)?;
    let sessions = state.sessions.read().await;
    let session = sessions.get(&id).cloned().ok_or(StatusCode::NOT_FOUND)?;
    if session.user_id != user_id {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(Json(session))
}

async fn delete_session_handler(
    State(state): State<Arc<WebServerState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user_id = extract_user_id(&headers).ok_or(StatusCode::BAD_REQUEST)?;
    let ip = extract_ip(&headers);
    let mut sessions = state.sessions.write().await;
    if let Some(session) = sessions.get(&id) {
        if session.user_id != user_id {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    if sessions.remove(&id).is_some() {
        let _ = save_sessions(&state.config.data_dir, &sessions);
        log_activity(&state, &user_id, &ip, "delete_session", &id).await;
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn rename_session_handler(
    State(state): State<Arc<WebServerState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<RenameRequest>,
) -> Result<Json<ChatSession>, StatusCode> {
    let user_id = extract_user_id(&headers).ok_or(StatusCode::BAD_REQUEST)?;
    let mut sessions = state.sessions.write().await;
    if let Some(session) = sessions.get_mut(&id) {
        if session.user_id != user_id {
            return Err(StatusCode::FORBIDDEN);
        }
        session.title = req.title;
        session.updated_at = chrono::Utc::now().to_rfc3339();
        let session = session.clone();
        let _ = save_sessions(&state.config.data_dir, &sessions);
        Ok(Json(session))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// ── Chat handler (SSE proxy with history) ────────────────────────────────────

async fn chat_handler(
    State(state): State<Arc<WebServerState>>,
    headers: HeaderMap,
    Json(req): Json<ChatRequest>,
) -> Result<Response, StatusCode> {
    let user_id = extract_user_id(&headers).ok_or(StatusCode::BAD_REQUEST)?;
    let ip = extract_ip(&headers);

    // Detect if message contains images (base64 data URLs)
    let is_image = req.message.contains("data:image") || req.message.contains("base64");

    // Estimate input tokens (rough: 1 token ≈ 4 chars for English, 2 chars for non-English)
    let input_tokens = (req.message.len() as u64) / 3;

    let user_msg = ChatMessage {
        role: "user".to_string(),
        content: req.message.clone(),
        timestamp: Some(chrono::Utc::now().to_rfc3339()),
        tokens: Some(input_tokens),
        is_image: Some(is_image),
        response_time_ms: None,
        model: req.model.clone(),
    };
    {
        let mut sessions = state.sessions.write().await;
        if let Some(session) = sessions.get_mut(&req.session_id) {
            if session.user_id != user_id {
                log_error(&state, &user_id, &ip, "chat_forbidden", &format!("session {} belongs to another user", req.session_id)).await;
                return Err(StatusCode::FORBIDDEN);
            }
            session.messages.push(user_msg);
            session.updated_at = chrono::Utc::now().to_rfc3339();
            if session.title == "New Chat" && !session.messages.is_empty() {
                session.title = req.message.chars().take(50).collect();
            }
            let _ = save_sessions(&state.config.data_dir, &sessions);
        } else {
            log_error(&state, &user_id, &ip, "chat_session_not_found", &req.session_id).await;
            return Err(StatusCode::NOT_FOUND);
        }
    }

    // Update message count and track connection with token/image stats
    {
        let mut activity = state.user_activity.write().await;
        if let Some(entry) = activity.get_mut(&user_id) {
            entry.total_messages += 1;
            entry.total_tokens += input_tokens;
            entry.total_input_tokens += input_tokens;
            if is_image {
                entry.total_images += 1;
            }
            entry.is_active = true;
            entry.last_seen = chrono::Utc::now().to_rfc3339();
            entry.ip_address = ip.clone();
        } else {
            // Create new user activity if not exists
            let now = chrono::Utc::now().to_rfc3339();
            activity.insert(user_id.clone(), UserActivity {
                user_id: user_id.clone(),
                ip_address: ip.clone(),
                first_seen: now.clone(),
                last_seen: now,
                total_messages: 1,
                total_sessions: 0,
                is_active: true,
                total_tokens: input_tokens,
                total_input_tokens: input_tokens,
                total_output_tokens: 0,
                total_images: if is_image { 1 } else { 0 },
                avg_response_time_ms: 0,
                total_response_time_ms: 0,
                response_count: 0,
            });
        }
    }

    // Track active connection
    {
        let mut active = state.active_connections.write().await;
        let mut times = state.active_connection_times.write().await;
        active.insert(user_id.clone(), ip.clone());
        times.insert(user_id.clone(), chrono::Utc::now());
    }

    log_activity(&state, &user_id, &ip, "send_message", &req.message.chars().take(50).collect::<String>()).await;

    let sessions = state.sessions.read().await;
    let session = sessions.get(&req.session_id).cloned();
    drop(sessions);
    let session = session.ok_or(StatusCode::NOT_FOUND)?;
    let messages: Vec<serde_json::Value> = session.messages.iter().map(|m| {
        serde_json::json!({ "role": m.role, "content": m.content })
    }).collect();
    let mut body = serde_json::json!({ "messages": messages, "stream": true });
    if let Some(temp) = req.temperature { body["temperature"] = serde_json::json!(temp); }
    if let Some(max) = req.max_tokens { body["max_tokens"] = serde_json::json!(max); }

    let url_str = llama_url(&state);
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", url_str);
    let upstream_resp = client.post(&url)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&body).unwrap_or_default())
        .send().await.map_err(|e| {
            let err = format!("upstream connect error: {}", e);
            let state_clone = Arc::clone(&state);
            let uid = user_id.clone();
            let ip_clone = ip.clone();
            tokio::spawn(async move { log_error(&state_clone, &uid, &ip_clone, "chat_upstream_error", &err).await; });
            StatusCode::BAD_GATEWAY
        })?;
    if !upstream_resp.status().is_success() {
        log_error(&state, &user_id, &ip, "chat_upstream_error", &format!("upstream returned {}", upstream_resp.status())).await;
        return Err(StatusCode::BAD_GATEWAY);
    }

    let session_id = req.session_id.clone();
    let data_dir = state.config.data_dir.clone();
    let model_for_spawn = req.model.clone();
    let _sessions_ref = Arc::clone(&state);
    let stream = upstream_resp.bytes_stream();
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(64);
    let request_start = std::time::Instant::now();
    let uid_for_spawn = user_id.clone();
    let sessions_for_spawn = Arc::clone(&state);

    tokio::spawn(async move {
        use futures::StreamExt;
        let mut full_response = String::new();
        let mut buffer = String::new();
        let mut stream = std::pin::pin!(stream);
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk { Ok(c) => c, Err(_) => break };
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);
            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer = buffer[line_end + 1..].to_string();
                if line.starts_with("data: ") {
                    let data = &line[6..];
                    if data == "[DONE]" {
                        let _ = tx.send(Ok(Event::default().data("[DONE]"))).await;
                        break;
                    }
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choice) = parsed.get("choices").and_then(|c| c.get(0)) {
                            if let Some(delta) = choice.get("delta") {
                                if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                    if !content.is_empty() {
                                        full_response.push_str(content);
                                        let _ = tx.send(Ok(Event::default().data(content))).await;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let response_time_ms = request_start.elapsed().as_millis() as u64;
        let output_tokens = (full_response.len() as u64) / 3;

        if !full_response.is_empty() {
            let mut sessions = sessions_for_spawn.sessions.write().await;
            if let Some(session) = sessions.get_mut(&session_id) {
                session.messages.push(ChatMessage {
                    role: "assistant".to_string(),
                    content: full_response,
                    timestamp: Some(chrono::Utc::now().to_rfc3339()),
                    tokens: Some(output_tokens),
                    is_image: None,
                    response_time_ms: Some(response_time_ms),
                    model: model_for_spawn,
                });
                session.updated_at = chrono::Utc::now().to_rfc3339();
                let _ = save_sessions(&data_dir, &sessions);
            }
        }

        // Update output token and response time stats
        {
            let mut activity = sessions_for_spawn.user_activity.write().await;
            if let Some(entry) = activity.get_mut(&uid_for_spawn) {
                entry.total_tokens += output_tokens;
                entry.total_output_tokens += output_tokens;
                entry.total_response_time_ms += response_time_ms;
                entry.response_count += 1;
                entry.avg_response_time_ms = entry.total_response_time_ms / entry.response_count;
            }
        }
    });

    let sse_stream = ReceiverStream::new(rx);
    let mut h = HeaderMap::new();
    h.insert("Content-Type", "text/event-stream".parse().unwrap());
    h.insert("Cache-Control", "no-cache".parse().unwrap());
    h.insert("Connection", "keep-alive".parse().unwrap());
    Ok((h, axum::response::sse::Sse::new(sse_stream)).into_response())
}

// ── Admin handlers ───────────────────────────────────────────────────────────

async fn admin_stats_handler(
    State(state): State<Arc<WebServerState>>,
) -> Result<Json<UserStats>, StatusCode> {
    let sessions = state.sessions.read().await;
    let activity = state.user_activity.read().await;
    let active = state.active_connections.read().await;

    let total_sessions = sessions.len();
    let total_messages: usize = sessions.values().map(|s| s.messages.len()).sum();
    let active_users: usize = activity.values().filter(|a| a.is_active).count();
    let total_tokens: u64 = activity.values().map(|a| a.total_tokens).sum();
    let total_images: u64 = activity.values().map(|a| a.total_images).sum();
    let total_response_time: u64 = activity.values().map(|a| a.total_response_time_ms).sum();
    let total_responses: u64 = activity.values().map(|a| a.response_count).sum();
    let avg_response_time = if total_responses > 0 { total_response_time as f64 / total_responses as f64 } else { 0.0 };

    // Count messages in last hour and 24h
    let now = chrono::Utc::now();
    let one_hour_ago = now - chrono::Duration::hours(1);
    let one_day_ago = now - chrono::Duration::hours(24);

    let mut messages_last_hour = 0usize;
    let mut messages_last_24h = 0usize;
    for session in sessions.values() {
        for msg in &session.messages {
            if let Some(ref ts) = msg.timestamp {
                if let Ok(dt) = ts.parse::<chrono::DateTime<chrono::Utc>>() {
                    if dt > one_hour_ago { messages_last_hour += 1; }
                    if dt > one_day_ago { messages_last_24h += 1; }
                }
            }
        }
    }

    Ok(Json(UserStats {
        total_users: activity.len(),
        active_users,
        total_sessions,
        total_messages,
        online_now: active.len(),
        total_tokens,
        total_images,
        avg_response_time,
        messages_last_hour,
        messages_last_24h,
    }))
}

async fn admin_users_handler(
    State(state): State<Arc<WebServerState>>,
) -> Result<Json<Vec<UserActivity>>, StatusCode> {
    let activity = state.user_activity.read().await;
    let active = state.active_connections.read().await;

    let mut users: Vec<UserActivity> = activity.values().cloned().collect();
    // Update online status
    for user in &mut users {
        user.is_active = active.contains_key(&user.user_id);
    }
    users.sort_by(|a, b| b.last_seen.cmp(&a.last_seen));
    Ok(Json(users))
}

async fn admin_activity_handler(
    State(state): State<Arc<WebServerState>>,
) -> Result<Json<Vec<ActivityLogEntry>>, StatusCode> {
    let log = state.activity_log.read().await;
    let recent: Vec<_> = log.iter().rev().take(100).cloned().collect();
    Ok(Json(recent))
}

async fn admin_user_sessions_handler(
    State(state): State<Arc<WebServerState>>,
    Path(user_id): Path<String>,
) -> Result<Json<Vec<ChatSession>>, StatusCode> {
    let sessions = state.sessions.read().await;
    let mut list: Vec<ChatSession> = sessions.values()
        .filter(|s| s.user_id == user_id)
        .cloned()
        .collect();
    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(Json(list))
}

async fn admin_delete_user_handler(
    State(state): State<Arc<WebServerState>>,
    Path(user_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut sessions = state.sessions.write().await;
    let to_remove: Vec<_> = sessions.keys()
        .filter(|k| sessions.get(*k).map(|s| s.user_id.as_str()) == Some(user_id.as_str()))
        .cloned()
        .collect();
    for key in &to_remove {
        sessions.remove(key);
    }
    let _ = save_sessions(&state.config.data_dir, &sessions);

    let mut activity = state.user_activity.write().await;
    activity.remove(&user_id);
    let _ = save_user_activity(&state.config.data_dir, &activity);

    let mut active = state.active_connections.write().await;
    active.remove(&user_id);
    let mut times = state.active_connection_times.write().await;
    times.remove(&user_id);

    Ok(StatusCode::NO_CONTENT)
}

async fn admin_delete_session_handler(
    State(state): State<Arc<WebServerState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let mut sessions = state.sessions.write().await;
    if sessions.remove(&id).is_some() {
        let _ = save_sessions(&state.config.data_dir, &sessions);
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// ── Proxy to llama-server ────────────────────────────────────────────────────

const USER_ID_SCRIPT: &str = r#"<script>
(function(){
  var uid=localStorage.getItem('llm_user_id');
  if(!uid){
    uid='user_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
    localStorage.setItem('llm_user_id',uid);
  }
  // Sync to cookie for server-side tracking
  document.cookie='llm_user_id='+uid+';path=/;max-age=86400';
  var origFetch=window.fetch;
  window.fetch=function(url,opts){
    opts=opts||{};
    opts.headers=opts.headers||{};
    if(typeof Headers!=='undefined'&&opts.headers instanceof Headers){
      opts.headers.set('X-User-Id',uid);
    }else if(typeof opts.headers==='object'){
      opts.headers['X-User-Id']=uid;
    }
    return origFetch.call(this,url,opts);
  };
  var origSetReqHeader=XMLHttpRequest.prototype.setRequestHeader;
  var origOpen=XMLHttpRequest.prototype.open;
  var origSend=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(){
    this._uid=uid;
    return origOpen.apply(this,arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader=function(name,value){
    if(name.toLowerCase()==='x-user-id')return;
    return origSetReqHeader.call(this,name,value);
  };
  XMLHttpRequest.prototype.send=function(){
    try{this.setRequestHeader('X-User-Id',this._uid||uid)}catch(e){}
    return origSend.apply(this,arguments);
  };
})();
</script>"#;

async fn proxy_handler(
    State(state): State<Arc<WebServerState>>,
    req: axum::extract::Request,
) -> Result<Response, StatusCode> {
    let url_str = llama_url(&state);
    let client = reqwest::Client::new();
    let path_and_query = req.uri().path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let url = format!("{}{}", url_str, path_and_query);
    let method = req.method().clone();
    let mut headers = HeaderMap::new();
    for (key, value) in req.headers().iter() {
        if key != "host" {
            headers.insert(key.clone(), value.clone());
        }
    }

    // Always get or create a user ID for tracking
    let uid = extract_or_create_user_id(&headers);
    let ip = extract_ip(&headers);

    // Track connection and user activity
    {
        let mut active = state.active_connections.write().await;
        let mut times = state.active_connection_times.write().await;
        active.insert(uid.clone(), ip.clone());
        times.insert(uid.clone(), chrono::Utc::now());
    }
    {
        let mut activity = state.user_activity.write().await;
        if let Some(entry) = activity.get_mut(&uid) {
            entry.is_active = true;
            entry.last_seen = chrono::Utc::now().to_rfc3339();
            entry.ip_address = ip.clone();
        } else {
            let now = chrono::Utc::now().to_rfc3339();
            activity.insert(uid.clone(), UserActivity {
                user_id: uid.clone(),
                ip_address: ip.clone(),
                first_seen: now.clone(),
                last_seen: now,
                total_messages: 0,
                total_sessions: 0,
                is_active: true,
                total_tokens: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_images: 0,
                avg_response_time_ms: 0,
                total_response_time_ms: 0,
                response_count: 0,
            });
        }
        let _ = save_user_activity(&state.config.data_dir, &activity);
    }

    // Add X-User-Id header to proxied request
    headers.insert("X-User-Id", uid.parse().unwrap());

    let body = axum::body::to_bytes(req.into_body(), usize::MAX)
        .await.map_err(|e| {
            let s = Arc::clone(&state);
            let u = uid.clone();
            let i = ip.clone();
            tokio::spawn(async move { log_error(&s, &u, &i, "proxy_bad_request", &e.to_string()).await; });
            StatusCode::BAD_REQUEST
        })?;
    let mut proxy_req = client.request(method, &url).headers(headers);
    if !body.is_empty() { proxy_req = proxy_req.body(body); }
    let upstream_resp = proxy_req.send().await.map_err(|e| {
        let s = Arc::clone(&state);
        let u = uid.clone();
        let i = ip.clone();
        tokio::spawn(async move { log_error(&s, &u, &i, "proxy_upstream_error", &e.to_string()).await; });
        StatusCode::BAD_GATEWAY
    })?;
    let status = upstream_resp.status();
    let content_type = upstream_resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let resp_headers: HeaderMap = upstream_resp.headers().clone();
    let resp_body = upstream_resp.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    // Build response
    let mut response = if content_type.contains("text/html") && !resp_body.is_empty() {
        let html = String::from_utf8_lossy(&resp_body).to_string();
        let injected = if html.contains("</head>") {
            html.replace("</head>", &format!("{}\n</head>", USER_ID_SCRIPT))
        } else if html.contains("</body>") {
            html.replace("</body>", &format!("{}\n</body>", USER_ID_SCRIPT))
        } else {
            format!("{}{}", html, USER_ID_SCRIPT)
        };
        let mut resp = Response::new(axum::body::Body::from(injected));
        *resp.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK);
        *resp.headers_mut() = resp_headers;
        resp.headers_mut().insert("content-type", "text/html; charset=utf-8".parse().unwrap());
        resp
    } else {
        let mut resp = Response::new(axum::body::Body::from(resp_body));
        *resp.status_mut() = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK);
        *resp.headers_mut() = resp_headers;
        resp
    };

    // Set cookie for server-side user tracking
    response.headers_mut().insert(
        "Set-Cookie",
        format!("llm_user_id={};path=/;max-age=86400;SameSite=Lax", uid).parse().unwrap(),
    );

    Ok(response)
}

// ── Server lifecycle ─────────────────────────────────────────────────────────

pub async fn start_web_server(
    config: WebServerConfig,
) -> Result<(tokio::task::JoinHandle<()>, u16, Arc<WebServerState>)> {
    let data_dir = config.data_dir.clone();
    let sessions = load_sessions(&data_dir);
    let mut user_activity = load_user_activity(&data_dir);
    let activity_log = load_activity_log(&data_dir);

    // Rebuild user_activity from sessions if empty
    if user_activity.is_empty() && !sessions.is_empty() {
        for session in sessions.values() {
            let entry = user_activity.entry(session.user_id.clone()).or_insert_with(|| UserActivity {
                user_id: session.user_id.clone(),
                ip_address: "unknown".to_string(),
                first_seen: session.created_at.clone(),
                last_seen: session.updated_at.clone(),
                total_messages: 0,
                total_sessions: 0,
                is_active: false,
                total_tokens: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_images: 0,
                avg_response_time_ms: 0,
                total_response_time_ms: 0,
                response_count: 0,
            });
            entry.total_sessions += 1;
            entry.total_messages += session.messages.len() as u64;
            if session.updated_at > entry.last_seen {
                entry.last_seen = session.updated_at.clone();
            }
        }
        let _ = save_user_activity(&data_dir, &user_activity);
    }

    let state = Arc::new(WebServerState {
        config: config.clone_fields(),
        sessions: RwLock::new(sessions),
        user_activity: RwLock::new(user_activity),
        activity_log: RwLock::new(activity_log),
        active_connections: RwLock::new(HashMap::new()),
        active_connection_times: RwLock::new(HashMap::new()),
        hourly_activity: RwLock::new(Vec::new()),
        error_log: RwLock::new(Vec::new()),
    });

    // Spawn periodic cleanup of stale connections (every 30s, expire after 120s)
    {
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
                let now = chrono::Utc::now();
                let mut times = state.active_connection_times.write().await;
                let mut connections = state.active_connections.write().await;
                let stale: Vec<String> = times.iter()
                    .filter(|(_, t)| (now - **t).num_seconds() > 120)
                    .map(|(uid, _)| uid.clone())
                    .collect();
                for uid in &stale {
                    connections.remove(uid);
                    times.remove(uid);
                }
            }
        });
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // User API
        .route("/api/sessions", get(list_sessions_handler))
        .route("/api/sessions", post(create_session_handler))
        .route("/api/sessions/{id}", get(get_session_handler))
        .route("/api/sessions/{id}", delete(delete_session_handler))
        .route("/api/sessions/{id}/rename", post(rename_session_handler))
        .route("/api/chat", post(chat_handler))
        // Admin API
        .route("/api/admin/stats", get(admin_stats_handler))
        .route("/api/admin/users", get(admin_users_handler))
        .route("/api/admin/activity", get(admin_activity_handler))
        .route("/api/admin/users/{id}/sessions", get(admin_user_sessions_handler))
        .route("/api/admin/users/{id}", delete(admin_delete_user_handler))
        .route("/api/admin/sessions/{id}", delete(admin_delete_session_handler))
        // Fallback
        .fallback(proxy_handler)
        .with_state(Arc::clone(&state))
        .layer(cors);

    let host = if config.bind_to_lan { "0.0.0.0" } else { "127.0.0.1" };
    let addr = format!("{}:{}", host, config.port);
    let listener = TcpListener::bind(&addr).await?;
    let actual_port = listener.local_addr()?.port();

    let handle = tokio::spawn(async move {
        log::info!("Web server listening on {}", addr);
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("Web server error: {}", e);
        }
    });

    Ok((handle, actual_port, state))
}
