use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

// ═══════════════════════════════════════════════════════════════════
// MCP Server Configuration Types
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default = "default_true")]
    pub active: bool,
    #[serde(rename = "type")]
    pub server_type: Option<String>, // "stdio" | "http" | "sse"
    pub url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub timeout: Option<u64>,
    #[serde(default)]
    pub official: bool,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub description: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerState {
    pub name: String,
    pub config: MCPServerConfig,
    pub connected: bool,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub server: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPCallToolRequest {
    pub tool_name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPCallToolResult {
    pub content: Option<serde_json::Value>,
    pub error: Option<String>,
}

// ═══════════════════════════════════════════════════════════════════
// MCP State Manager
// ═══════════════════════════════════════════════════════════════════

pub struct MCPState {
    pub servers: Mutex<HashMap<String, MCPServerState>>,
    pub config: Mutex<HashMap<String, MCPServerConfig>>,
}

impl MCPState {
    pub fn new() -> Self {
        Self {
            servers: Mutex::new(HashMap::new()),
            config: Mutex::new(HashMap::new()),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Tauri Commands
// ═══════════════════════════════════════════════════════════════════

/// Update MCP configuration from JSON string
#[tauri::command]
pub async fn mcp_update_config(
    config_str: String,
    state: State<'_, MCPState>,
) -> Result<(), String> {
    let parsed: serde_json::Value = serde_json::from_str(&config_str)
        .map_err(|e| format!("Failed to parse MCP config: {}", e))?;

    let servers_map = parsed
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .ok_or("mcpServers not found in config")?;

    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.clear();

    for (name, server_value) in servers_map {
        if let Ok(server_config) = serde_json::from_value::<MCPServerConfig>(server_value.clone()) {
            config.insert(name.clone(), server_config);
        }
    }

    Ok(())
}

/// Restart all MCP servers
#[tauri::command]
pub async fn mcp_restart_servers(
    state: State<'_, MCPState>,
) -> Result<(), String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let mut servers = state.servers.lock().map_err(|e| e.to_string())?;

    // Stop all existing servers
    for (name, server_state) in servers.iter_mut() {
        if server_state.connected {
            // Kill the process if it exists
            if let Some(pid) = server_state.pid {
                #[cfg(target_os = "windows")]
                {
                    let _ = std::process::Command::new("taskkill")
                        .args(&["/PID", &pid.to_string(), "/F"])
                        .output();
                }
                #[cfg(not(target_os = "windows"))]
                {
                    unsafe {
                        libc::kill(pid as i32, libc::SIGTERM);
                    }
                }
            }
            server_state.connected = false;
            server_state.pid = None;
        }
    }

    // Start servers that are active
    for (name, server_config) in config.iter() {
        if !server_config.active {
            continue;
        }

        // For now, just mark as "ready to connect"
        // Full MCP implementation would spawn processes here
        let server_state = MCPServerState {
            name: name.clone(),
            config: server_config.clone(),
            connected: false,
            pid: None,
            error: None,
        };
        servers.insert(name.clone(), server_state);
    }

    Ok(())
}

/// Get MCP server summaries (for UI)
#[tauri::command]
pub async fn mcp_get_server_summaries(
    state: State<'_, MCPState>,
) -> Result<Vec<serde_json::Value>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let servers = state.servers.lock().map_err(|e| e.to_string())?;

    let mut summaries = Vec::new();
    for (name, server_config) in config.iter() {
        let server_state = servers.get(name);
        summaries.push(serde_json::json!({
            "name": name,
            "connected": server_state.map(|s| s.connected).unwrap_or(false),
            "capabilities": server_config.capabilities,
            "description": server_config.description,
            "active": server_config.active,
        }));
    }

    Ok(summaries)
}

/// Get all tools from connected MCP servers
#[tauri::command]
pub async fn mcp_get_tools(
    state: State<'_, MCPState>,
) -> Result<Vec<MCPTool>, String> {
    let _servers = state.servers.lock().map_err(|e| e.to_string())?;

    // In a full implementation, this would query each connected MCP server
    // for its available tools via the MCP protocol
    // For now, return empty list
    Ok(vec![])
}

/// Get tools for specific servers
#[tauri::command]
pub async fn mcp_get_tools_for_servers(
    server_names: Vec<String>,
    state: State<'_, MCPState>,
) -> Result<Vec<MCPTool>, String> {
    let _servers = state.servers.lock().map_err(|e| e.to_string())?;
    let _server_names = server_names;

    // In a full implementation, this would query specific servers
    Ok(vec![])
}

/// Call an MCP tool
#[tauri::command]
pub async fn mcp_call_tool(
    request: MCPCallToolRequest,
    state: State<'_, MCPState>,
) -> Result<MCPCallToolResult, String> {
    let _servers = state.servers.lock().map_err(|e| e.to_string())?;
    let _request = request;

    // In a full implementation, this would route the call to the appropriate server
    Ok(MCPCallToolResult {
        content: None,
        error: Some("MCP not fully implemented yet".to_string()),
    })
}

/// Activate an MCP server
#[tauri::command]
pub async fn mcp_activate_server(
    name: String,
    config: Option<MCPServerConfig>,
    state: State<'_, MCPState>,
) -> Result<(), String> {
    let mut servers = state.config.lock().map_err(|e| e.to_string())?;

    if let Some(server_config) = config {
        servers.insert(name, server_config);
    } else {
        if let Some(server_config) = servers.get_mut(&name) {
            server_config.active = true;
        }
    }

    Ok(())
}

/// Deactivate an MCP server
#[tauri::command]
pub async fn mcp_deactivate_server(
    name: String,
    state: State<'_, MCPState>,
) -> Result<(), String> {
    let mut servers = state.config.lock().map_err(|e| e.to_string())?;

    if let Some(server_config) = servers.get_mut(&name) {
        server_config.active = false;
    }

    Ok(())
}
