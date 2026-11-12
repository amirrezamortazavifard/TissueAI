use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

use crate::llm::provider_secrets;
use crate::llm::remote_chat;
use crate::llm::remote_providers::{ProviderConfig, ProviderCustomHeader};

/// Value returned in `api_key` when a key is stored in the OS keyring but must
/// not be shipped back to the webview. The frontend only tests truthiness.
pub const KEY_MASK: &str = "••••••••••••••••";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProviderPreset {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub default_models: Vec<String>,
    pub key_prefix: String,
    pub key_placeholder: String,
    pub icon_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProviderConfig {
    pub id: String,
    pub provider_id: String,
    pub name: String,
    pub base_url: String,
    /// Never persisted to disk: `""` or [`KEY_MASK`] on load. Real keys live in
    /// the OS keyring (see `provider_secrets`).
    pub api_key: String,
    /// Additional fallback keys tried on 401/403/429.
    #[serde(default)]
    pub api_keys: Vec<String>,
    #[serde(default)]
    pub custom_headers: Vec<ProviderCustomHeader>,
    /// Upstream wire API (`None`/`"openai"` = OpenAI-compatible passthrough,
    /// or `"anthropic"` / `"google"` / `"openai-responses"` for a converter).
    #[serde(default)]
    pub api_type: Option<String>,
    pub selected_model: String,
    pub created_at: u64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiChatRequest {
    pub provider_id: String,
    pub model: String,
    pub messages: Vec<ApiChatMessage>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiChatResponse {
    pub content: String,
    pub model: String,
    pub usage: ApiUsage,
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiTestResult {
    pub success: bool,
    pub model: Option<String>,
    pub latency_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProvidersConfig {
    pub providers: Vec<ApiProviderConfig>,
}

impl Default for ApiProvidersConfig {
    fn default() -> Self {
        Self { providers: Vec::new() }
    }
}

impl ApiProvidersConfig {
    pub fn config_path() -> PathBuf {
        let dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("tissueai");
        fs::create_dir_all(&dir).ok();
        dir.join("api_providers.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())
    }
}

pub fn get_provider_presets() -> Vec<ApiProviderPreset> {
    vec![
        ApiProviderPreset {
            id: "openai".into(), name: "OpenAI".into(),
            base_url: "https://api.openai.com/v1".into(),
            default_models: vec!["gpt-4o".into(), "gpt-4o-mini".into(), "gpt-4-turbo".into(), "o3-mini".into(), "gpt-3.5-turbo".into()],
            key_prefix: "sk-".into(), key_placeholder: "sk-...".into(), icon_color: "#10a37f".into(),
        },
        ApiProviderPreset {
            id: "gemini".into(), name: "Google Gemini".into(),
            base_url: "https://generativelanguage.googleapis.com/v1beta/openai".into(),
            default_models: vec!["gemini-2.5-pro".into(), "gemini-2.5-flash".into(), "gemini-2.0-flash".into(), "gemini-2.0-flash-lite".into()],
            key_prefix: "AIza".into(), key_placeholder: "AIza...".into(), icon_color: "#4285f4".into(),
        },
        ApiProviderPreset {
            id: "anthropic".into(), name: "Anthropic".into(),
            base_url: "https://api.anthropic.com/v1".into(),
            default_models: vec!["claude-sonnet-4-20250514".into(), "claude-3-5-haiku-20241022".into(), "claude-3-opus-20240229".into()],
            key_prefix: "sk-ant-".into(), key_placeholder: "sk-ant-...".into(), icon_color: "#d4a574".into(),
        },
        ApiProviderPreset {
            id: "deepseek".into(), name: "DeepSeek".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            default_models: vec!["deepseek-chat".into(), "deepseek-reasoner".into()],
            key_prefix: "sk-".into(), key_placeholder: "sk-...".into(), icon_color: "#4d6bfe".into(),
        },
        ApiProviderPreset {
            id: "openrouter".into(), name: "OpenRouter".into(),
            base_url: "https://openrouter.ai/api/v1".into(),
            default_models: vec!["openai/gpt-4o".into(), "anthropic/claude-sonnet-4".into(), "google/gemini-2.0-flash".into(), "meta-llama/llama-3.3-70b-instruct".into(), "deepseek/deepseek-chat".into()],
            key_prefix: "sk-or-".into(), key_placeholder: "sk-or-...".into(), icon_color: "#6366f1".into(),
        },
        ApiProviderPreset {
            id: "groq".into(), name: "Groq".into(),
            base_url: "https://api.groq.com/openai/v1".into(),
            default_models: vec!["llama-3.3-70b-versatile".into(), "llama-3.1-8b-instant".into(), "mixtral-8x7b-32768".into(), "gemma2-9b-it".into()],
            key_prefix: "gsk_".into(), key_placeholder: "gsk_...".into(), icon_color: "#f55036".into(),
        },
        ApiProviderPreset {
            id: "mistral".into(), name: "Mistral AI".into(),
            base_url: "https://api.mistral.ai/v1".into(),
            default_models: vec!["mistral-large-latest".into(), "mistral-small-latest".into(), "codestral-latest".into(), "open-mistral-nemo".into()],
            key_prefix: "".into(), key_placeholder: "your-mistral-key".into(), icon_color: "#ff7000".into(),
        },
        ApiProviderPreset {
            id: "xai".into(), name: "xAI (Grok)".into(),
            base_url: "https://api.x.ai/v1".into(),
            default_models: vec!["grok-3".into(), "grok-3-mini".into(), "grok-2".into()],
            key_prefix: "xai-".into(), key_placeholder: "xai-...".into(), icon_color: "#1d9bf0".into(),
        },
        ApiProviderPreset {
            id: "together".into(), name: "Together AI".into(),
            base_url: "https://api.together.xyz/v1".into(),
            default_models: vec!["meta-llama/Llama-3.3-70B-Instruct-Turbo".into(), "Qwen/Qwen2.5-72B-Instruct-Turbo".into(), "deepseek-ai/DeepSeek-V3".into()],
            key_prefix: "".into(), key_placeholder: "your-together-key".into(), icon_color: "#6366f1".into(),
        },
        ApiProviderPreset {
            id: "fireworks".into(), name: "Fireworks AI".into(),
            base_url: "https://api.fireworks.ai/inference/v1".into(),
            default_models: vec!["accounts/fireworks/models/llama-v3p3-70b-instruct".into(), "accounts/fireworks/models/deepseek-v3".into()],
            key_prefix: "".into(), key_placeholder: "your-fireworks-key".into(), icon_color: "#ff5e00".into(),
        },
        ApiProviderPreset {
            id: "cerebras".into(), name: "Cerebras".into(),
            base_url: "https://api.cerebras.ai/v1".into(),
            default_models: vec!["llama-3.3-70b".into(), "llama-3.1-8b".into(), "qwen-2.5-32b".into()],
            key_prefix: "".into(), key_placeholder: "your-cerebras-key".into(), icon_color: "#00c9a7".into(),
        },
        ApiProviderPreset {
            id: "perplexity".into(), name: "Perplexity".into(),
            base_url: "https://api.perplexity.ai".into(),
            default_models: vec!["sonar".into(), "sonar-reasoning".into(), "sonar-deep-research".into()],
            key_prefix: "pplx-".into(), key_placeholder: "pplx-...".into(), icon_color: "#20b8cd".into(),
        },
        ApiProviderPreset {
            id: "deepinfra".into(), name: "DeepInfra".into(),
            base_url: "https://api.deepinfra.com/v1/openai".into(),
            default_models: vec!["meta-llama/Meta-Llama-3.3-70B-Instruct".into(), "deepseek-ai/DeepSeek-V3".into()],
            key_prefix: "".into(), key_placeholder: "your-deepinfra-key".into(), icon_color: "#6366f1".into(),
        },
        ApiProviderPreset {
            id: "cohere".into(), name: "Cohere".into(),
            base_url: "https://api.cohere.com/compatibility/v1".into(),
            default_models: vec!["command-r-plus-08-2024".into(), "command-r-08-2024".into()],
            key_prefix: "".into(), key_placeholder: "your-cohere-key".into(), icon_color: "#39594d".into(),
        },
        ApiProviderPreset {
            id: "huggingface".into(), name: "Hugging Face".into(),
            base_url: "https://api-inference.huggingface.co/v1".into(),
            default_models: vec!["meta-llama/Llama-3.3-70B-Instruct".into(), "Qwen/Qwen2.5-72B-Instruct".into()],
            key_prefix: "hf_".into(), key_placeholder: "hf_...".into(), icon_color: "#ffd21e".into(),
        },
        ApiProviderPreset {
            id: "qwen".into(), name: "Qwen (Alibaba)".into(),
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".into(),
            default_models: vec!["qwen-max".into(), "qwen-plus".into(), "qwen-turbo".into()],
            key_prefix: "sk-".into(), key_placeholder: "sk-...".into(), icon_color: "#615ced".into(),
        },
        ApiProviderPreset {
            id: "zhipu".into(), name: "Zhipu AI (GLM)".into(),
            base_url: "https://open.bigmodel.cn/api/paas/v4".into(),
            default_models: vec!["glm-4".into(), "glm-4-flash".into(), "glm-4-air".into()],
            key_prefix: "".into(), key_placeholder: "your-zhipu-key".into(), icon_color: "#3451b2".into(),
        },
        ApiProviderPreset {
            id: "moonshot".into(), name: "Moonshot (Kimi)".into(),
            base_url: "https://api.moonshot.cn/v1".into(),
            default_models: vec!["moonshot-v1-8k".into(), "moonshot-v1-32k".into(), "moonshot-v1-128k".into()],
            key_prefix: "sk-".into(), key_placeholder: "sk-...".into(), icon_color: "#1a1a2e".into(),
        },
        ApiProviderPreset {
            id: "nebius".into(), name: "Nebius".into(),
            base_url: "https://api.studio.nebius.com/v1".into(),
            default_models: vec!["meta-llama/Meta-Llama-3.3-70B-Instruct".into(), "Qwen/Qwen2.5-72B-Instruct".into()],
            key_prefix: "".into(), key_placeholder: "your-nebius-key".into(), icon_color: "#6366f1".into(),
        },
        ApiProviderPreset {
            id: "custom".into(), name: "Custom (OpenAI-compatible)".into(),
            base_url: "".into(), default_models: vec![],
            key_prefix: "".into(), key_placeholder: "your-api-key".into(), icon_color: "#888888".into(),
        },
    ]
}

/// True when a stored `api_key` is the masked sentinel or empty — i.e. it must
/// not be persisted again (the real key lives in the keyring).
pub fn is_masked_or_empty(key: &str) -> bool {
    key.is_empty() || key == KEY_MASK
}

/// Build a `ProviderConfig` for the remote-chat layer from a stored provider,
/// resolving the real key chain from the OS keyring. Legacy plaintext keys in
/// the JSON file are migrated into the keyring on first use.
pub fn build_provider_config(provider: &ApiProviderConfig) -> Result<ProviderConfig, String> {
    let id = provider.id.clone();
    let mut key_chain = provider_secrets::load_provider_keys(&id);

    if key_chain.is_empty() && !is_masked_or_empty(&provider.api_key) {
        // Legacy: key was persisted in the settings file by an older build.
        // Move it into the keyring and never write it back.
        key_chain = vec![provider.api_key.clone()];
        let _ = provider_secrets::store_provider_keys(&id, &key_chain);
    }

    Ok(ProviderConfig {
        provider: provider.id.clone(),
        api_key: key_chain.first().cloned(),
        api_keys: key_chain,
        base_url: Some(provider.base_url.clone()),
        custom_headers: provider.custom_headers.clone(),
        models: vec![provider.selected_model.clone()],
        api_type: provider.api_type.clone(),
    })
}

pub async fn send_api_chat(
    req: &ApiChatRequest,
    providers: &ApiProvidersConfig,
    client: &reqwest::Client,
) -> Result<ApiChatResponse, String> {
    let provider = providers.providers.iter()
        .find(|p| p.id == req.provider_id || p.provider_id == req.provider_id)
        .ok_or_else(|| format!("Provider '{}' not found", req.provider_id))?;

    let config = build_provider_config(provider)?;

    let body = serde_json::json!({
        "model": req.model,
        "messages": req.messages,
        "temperature": req.temperature.unwrap_or(0.7),
        "max_tokens": req.max_tokens.unwrap_or(4096),
        "stream": req.stream.unwrap_or(false),
    });

    let json = remote_chat::chat_completions(client, &config, &body).await?;

    let content = json["choices"][0]["message"]["content"]
        .as_str().unwrap_or("").to_string();

    let model = json["model"].as_str().unwrap_or(&req.model).to_string();

    let usage = ApiUsage {
        prompt_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
        completion_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
        total_tokens: json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
    };

    let finish_reason = json["choices"][0]["finish_reason"]
        .as_str().unwrap_or("stop").to_string();

    Ok(ApiChatResponse { content, model, usage, finish_reason })
}

pub async fn test_api_provider(
    provider: &ApiProviderConfig,
    client: &reqwest::Client,
) -> ApiTestResult {
    let start = Instant::now();

    let config = match build_provider_config(provider) {
        Ok(c) => c,
        Err(e) => {
            return ApiTestResult { success: false, model: None, latency_ms: 0, error: Some(e) };
        }
    };

    let body = serde_json::json!({
        "model": provider.selected_model,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5,
    });

    match remote_chat::chat_completions(client, &config, &body).await {
        Ok(_) => {
            let latency = start.elapsed().as_millis() as u64;
            ApiTestResult { success: true, model: Some(provider.selected_model.clone()), latency_ms: latency, error: None }
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;
            ApiTestResult { success: false, model: None, latency_ms: latency, error: Some(e) }
        }
    }
}
