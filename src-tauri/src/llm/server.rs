use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use crate::llm::hardware::{suggest_config, SystemInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub model_path: String,
    #[serde(default)]
    pub mmproj_path: Option<String>,
    pub host: String,
    pub port: u16,
    pub n_ctx: u32,
    pub n_gpu_layers: i32,
    pub n_threads: Option<i32>,
    pub flash_attn: String,
    pub cache_type_k: String,
    pub cache_type_v: String,
    pub temperature: f32,
    pub top_k: i32,
    pub min_p: f32,
    pub top_p: f32,
    pub n_predict: i32,
    pub n_batch: u32,
    pub n_ubatch: u32,
    pub cont_batching: bool,
    pub mlock: bool,
    pub no_mmap: bool,
    pub seed: Option<u64>,
    pub rope_freq_scale: Option<f32>,
    pub rope_freq_base: Option<f32>,
    pub grp_attn_n: Option<u32>,
    pub grp_attn_w: Option<u32>,
    pub parallel: u32,
    #[serde(default)]
    pub no_mmproj_offload: bool,
    #[serde(default)]
    pub extra_params: HashMap<String, String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            model_path: String::new(),
            mmproj_path: None,
            host: "127.0.0.1".to_string(),
            port: 8081,
            n_ctx: 0,
            n_gpu_layers: -1,
            n_threads: None,
            flash_attn: "auto".to_string(),
            cache_type_k: "f16".to_string(),
            cache_type_v: "f16".to_string(),
            temperature: 0.8,
            top_k: 40,
            min_p: 0.05,
            top_p: 0.95,
            n_predict: -1,
            n_batch: 512,
            n_ubatch: 512,
            cont_batching: true,
            mlock: false,
            no_mmap: false,
            seed: None,
            rope_freq_scale: None,
            rope_freq_base: None,
            grp_attn_n: None,
            grp_attn_w: None,
            parallel: 1,
            no_mmproj_offload: false,
            extra_params: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ServerStatus {
    Stopped,
    Starting,
    Running { port: u16, pid: u32, host: String },
    Error { message: String },
}

pub struct ServerState {
    pub process: Option<Child>,
    pub status: ServerStatus,
    pub log_lines: Vec<String>,
    pub cancel_token: Arc<AtomicBool>,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            process: None,
            status: ServerStatus::Stopped,
            log_lines: Vec::new(),
            cancel_token: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn is_running(&self) -> bool {
        matches!(self.status, ServerStatus::Running { .. } | ServerStatus::Starting)
    }
}

pub type SharedServerState = Arc<Mutex<ServerState>>;

pub fn new_server_state() -> SharedServerState {
    Arc::new(Mutex::new(ServerState::new()))
}

pub fn apply_hf_preset_params(params: &crate::llm::huggingface::HfPresetParams, config: &mut ServerConfig) {
    if let Some(v) = params.temperature { config.temperature = v; }
    if let Some(v) = params.top_k { config.top_k = v; }
    if let Some(v) = params.top_p { config.top_p = v; }
    if let Some(v) = params.min_p { config.min_p = v; }
    if let Some(v) = params.n_predict { config.n_predict = v; }
    if let Some(v) = params.seed { config.seed = Some(v); }
    if let Some(v) = params.repeat_penalty {
        config.extra_params.insert("repeat-penalty".to_string(), format!("{:.4}", v));
    }
    if let Some(v) = params.repeat_last_n {
        config.extra_params.insert("repeat-last-n".to_string(), v.to_string());
    }
}

pub fn preset_name_from_repo(repo_id: &str) -> String {
    repo_id.replace('/', "__")
}

pub fn migrate_extra_params(extra: &mut HashMap<String, String>) -> bool {
    const REMOVED_DROP: &[&str] = &[
        "spec-ngram-size-n",
        "spec-ngram-size-m",
        "spec-ngram-min-hits",
    ];
    const RENAMES: &[(&str, &str)] = &[
        ("draft", "spec-draft-n-max"),
        ("draft-max", "spec-draft-n-max"),
        ("draft-n-max", "spec-draft-n-max"),
        ("draft-min", "spec-draft-n-min"),
        ("draft-n-min", "spec-draft-n-min"),
        ("model-draft", "spec-draft-model"),
        ("ctx-size-draft", "spec-draft-ctx-size"),
        ("n-gpu-layers-draft", "spec-draft-ngl"),
        ("gpu-layers-draft", "spec-draft-ngl"),
        ("device-draft", "spec-draft-device"),
        ("threads-draft", "spec-draft-threads"),
        ("threads-batch-draft", "spec-draft-threads-batch"),
        ("cpu-moe-draft", "spec-draft-cpu-moe"),
        ("draft-cpu-moe", "spec-draft-cpu-moe"),
        ("n-cpu-moe-draft", "spec-draft-n-cpu-moe"),
        ("override-tensor-draft", "spec-draft-override-tensor"),
        ("draft-p-min", "spec-draft-p-min"),
        ("draft-p-split", "spec-draft-p-split"),
        ("hf-repo-draft", "spec-draft-hf"),
        ("cache-type-k-draft", "spec-draft-type-k"),
        ("cache-type-v-draft", "spec-draft-type-v"),
    ];

    let mut changed = false;
    for k in REMOVED_DROP {
        if extra.remove(*k).is_some() { changed = true; }
    }
    for (old, new) in RENAMES {
        if let Some(v) = extra.remove(*old) {
            extra.entry((*new).to_string()).or_insert(v);
            changed = true;
        }
    }
    changed
}

fn get_fallback_configs(base: &ServerConfig) -> Vec<ServerConfig> {
    let mut configs = Vec::new();
    let has_mmproj = base.mmproj_path.as_ref().map_or(false, |p| !p.is_empty());

    // Level 1: User's settings as-is
    configs.push(base.clone());

    // Level 2: mmproj on CPU (if vision model)
    if has_mmproj && !base.no_mmproj_offload {
        let mut c = base.clone();
        c.no_mmproj_offload = true;
        configs.push(c);
    }

    // Level 3: GPU layers 0 + mmproj on CPU
    if base.n_gpu_layers != 0 || (has_mmproj && !base.no_mmproj_offload) {
        let mut c = base.clone();
        c.n_gpu_layers = 0;
        c.no_mmproj_offload = true;
        configs.push(c);
    }

    // Level 4: CPU only + no-mmap + mmproj on CPU
    {
        let mut c = base.clone();
        c.n_gpu_layers = 0;
        c.no_mmproj_offload = true;
        c.no_mmap = true;
        configs.push(c);
    }

    // Level 5: Nuclear option - CPU + no-mmap + no flash-attn + mmproj on CPU
    {
        let mut c = base.clone();
        c.n_gpu_layers = 0;
        c.no_mmproj_offload = true;
        c.no_mmap = true;
        c.flash_attn = "off".to_string();
        configs.push(c);
    }

    configs
}

fn describe_config_level(cfg: &ServerConfig, base: &ServerConfig) -> String {
    let mut parts = Vec::new();

    if cfg.n_gpu_layers == 0 && base.n_gpu_layers != 0 {
        parts.push("CPU-only inference".to_string());
    } else if cfg.n_gpu_layers == base.n_gpu_layers {
        if cfg.n_gpu_layers == -1 {
            parts.push("Full GPU offload".to_string());
        } else if cfg.n_gpu_layers == 0 {
            parts.push("CPU-only inference".to_string());
        } else {
            parts.push(format!("{} GPU layers", cfg.n_gpu_layers));
        }
    } else {
        parts.push(format!("{} GPU layers", cfg.n_gpu_layers));
    }

    if cfg.no_mmproj_offload && !base.no_mmproj_offload {
        parts.push("vision encoder on CPU".to_string());
    }

    if cfg.no_mmap && !base.no_mmap {
        parts.push("no memory mapping".to_string());
    }

    if cfg.flash_attn == "off" && base.flash_attn != "off" {
        parts.push("flash attention disabled".to_string());
    }

    if parts.is_empty() {
        "user settings".to_string()
    } else {
        parts.join(", ")
    }
}

/// Force-kill ANY process holding the given TCP port (Windows).
/// On Unix, we rely on the Child handle; on Windows orphaned processes
/// are common and `netstat` + `taskkill` is the only reliable way.
async fn force_free_port(port: u16) {
    #[cfg(target_os = "windows")]
    {
        // netstat -ano | findstr :PORT → extract PID → taskkill /F /PID
        let output = tokio::process::Command::new("netstat")
            .args(["-ano"])
            .output()
            .await;
        let output = match output {
            Ok(o) if o.status.success() => o,
            _ => return,
        };
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            // Lines look like:  TCP  0.0.0.0:8080  0.0.0.0:0  LISTENING  12345
            if !trimmed.contains(&format!(":{}", port)) {
                continue;
            }
            // Skip lines that aren't LISTENING or similar
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() < 5 {
                continue;
            }
            let pid_str = parts[parts.len() - 1];
            let pid: u32 = match pid_str.parse() {
                Ok(p) => p,
                Err(_) => continue,
            };
            // Don't kill our own process
            if pid == std::process::id() {
                continue;
            }
            let _ = tokio::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
                .await;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = port; // no-op on Unix (Child handle suffices)
    }
}

/// Check whether the server is actually listening on the given port.
async fn check_http_health(port: u16) -> bool {
    use tokio::net::TcpStream;
    let addr = format!("127.0.0.1:{}", port);
    matches!(
        tokio::time::timeout(
            std::time::Duration::from_millis(1000),
            TcpStream::connect(&addr)
        )
        .await,
        Ok(Ok(_))
    )
}

/// Wait until the port is free, or until timeout (max 20s).
/// Returns true if port became free, false if timeout.
async fn wait_for_port_free(port: u16) -> bool {
    // Re-use the same TCP-connect approach: if connect fails, port is free.
    for _ in 0..40 {
        // 40 * 500ms = 20s
        if !check_http_health(port).await {
            return true; // port is free (connection refused)
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    false // port still occupied after 20s
}

pub async fn start_server(
    server_binary: &PathBuf,
    config: &ServerConfig,
    state: SharedServerState,
    log_cb: impl Fn(String) + Send + Sync + 'static,
) -> Result<()> {
    {
        let s = state.lock().unwrap();
        if s.is_running() {
            anyhow::bail!("Server is already running");
        }
    }

    let fallback_configs = get_fallback_configs(config);
    let log_cb = Arc::new(log_cb);

    // Clone the cancel token and reset it for this run
    let cancel_token = {
        let s = state.lock().unwrap();
        s.cancel_token.store(false, std::sync::atomic::Ordering::Relaxed);
        s.cancel_token.clone()
    };

    // Keep status as Starting throughout all fallback attempts
    {
        let mut s = state.lock().unwrap();
        s.status = ServerStatus::Starting;
        s.log_lines.clear();
    }

    // Wrapper: store log line in state AND emit to frontend
    let state_log = state.clone();
    let log = {
        let log_cb = log_cb.clone();
        Arc::new(move |line: String| {
            {
                let mut s = state_log.lock().unwrap();
                s.log_lines.push(line.clone());
                if s.log_lines.len() > 500 {
                    s.log_lines.drain(0..100);
                }
            }
            log_cb(line);
        })
    };

    // First: ensure the port is free before any attempt
    let port = config.port;
    let host = config.host.clone();
    force_free_port(port).await;
    if !wait_for_port_free(port).await {
        log(format!("[error] Port {} is stuck — cannot start server", port));
        {
            let mut s = state.lock().unwrap();
            s.status = ServerStatus::Error {
                message: format!("Port {} is stuck occupied", port),
            };
        }
        anyhow::bail!("Port {} is still occupied after 20s", port);
    }

    for (level, cfg) in fallback_configs.iter().enumerate() {
        // Check if user clicked Stop before starting this level
        {
            let s = state.lock().unwrap();
            if matches!(s.status, ServerStatus::Stopped) {
                log("[fallback] Server stopped by user".to_string());
                anyhow::bail!("Server stopped by user");
            }
        }

        let desc = describe_config_level(cfg, config);
        let total = fallback_configs.len();

        log(format!(
            "[fallback] ═══ Starting level {}/{}: {} ═══",
            level + 1,
            total,
            desc
        ));

        // Before each level: force-free the port (kill any orphan)
        force_free_port(port).await;

        // Emit progress event
        log(format!("[progress] {}|{}|{}", level + 1, total, desc));

        let args = build_args(cfg);
        let cmdline = format!("{} {}", server_binary.display(), args.join(" "));
        log::info!("Attempt {}/{}: {}", level + 1, total, cmdline);
        log(format!("$ {}", cmdline));
        {
            let mut s = state.lock().unwrap();
            s.log_lines.push(format!("$ {}", cmdline));
        }
        log(format!(
            "[fallback] Attempt {}/{} — {}",
            level + 1,
            total,
            desc
        ));

        let mut cmd = Command::new(server_binary);
        cmd.args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(target_os = "windows")]
        {
            #[allow(unused_imports)]
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                log::warn!("Failed to spawn (attempt {}): {}", level + 1, e);
                log(format!("[fallback] ✗ Spawn failed: {}", e));
                log(format!("[progress] {}|{}|{}|failed", level + 1, total, desc));
                continue;
            }
        };

        let pid = child.id().unwrap_or(0);
        log(format!("[fallback] Process spawned — PID: {}", pid));

        // Take streams BEFORE storing child in state
        let stdout = child.stdout.take().expect("stdout not piped");
        let stderr = child.stderr.take().expect("stderr not piped");

        // Store child in state for stop_server API
        {
            let mut s = state.lock().unwrap();
            s.process = Some(child);
        }

        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let started = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let output_count = Arc::new(AtomicUsize::new(0));

        // stdout reader
        let log_os = log_cb.clone();
        let stop_os = stop.clone();
        let started_os = started.clone();
        let out_os = output_count.clone();
        let state_os = state.clone();
        let h_out = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            loop {
                if stop_os.load(std::sync::atomic::Ordering::Relaxed) {
                    break;
                }
                buf.clear();
                match reader.read_until(b'\n', &mut buf).await {
                    Ok(0) => break,
                    Ok(_) => {
                        out_os.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                        if !started_os.load(std::sync::atomic::Ordering::Relaxed)
                            && (line.contains("HTTP server listening")
                                || line.contains("server is listening")
                                || line.contains("listening on"))
                        {
                            started_os.store(true, std::sync::atomic::Ordering::Relaxed);
                        }
                        {
                            let mut s = state_os.lock().unwrap();
                            s.log_lines.push(line.clone());
                            if s.log_lines.len() > 500 {
                                s.log_lines.drain(0..100);
                            }
                        }
                        log_os(line);
                    }
                    Err(_) => break,
                }
            }
        });

        // stderr reader
        let log_es = log_cb.clone();
        let stop_es = stop.clone();
        let started_es = started.clone();
        let out_es = output_count.clone();
        let state_es = state.clone();
        let h_err = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            loop {
                if stop_es.load(std::sync::atomic::Ordering::Relaxed) {
                    break;
                }
                buf.clear();
                match reader.read_until(b'\n', &mut buf).await {
                    Ok(0) => break,
                    Ok(_) => {
                        out_es.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                        if !started_es.load(std::sync::atomic::Ordering::Relaxed)
                            && (line.contains("HTTP server listening")
                                || line.contains("server is listening")
                                || line.contains("listening on"))
                        {
                            started_es.store(true, std::sync::atomic::Ordering::Relaxed);
                        }
                        {
                            let mut s = state_es.lock().unwrap();
                            s.log_lines.push(format!("[stderr] {}", line));
                            if s.log_lines.len() > 500 {
                                s.log_lines.drain(0..100);
                            }
                        }
                        log_es(format!("[stderr] {}", line));
                    }
                    Err(_) => break,
                }
            }
        });

        // ── Wait for "listening" or hard timeout (60s) ────────────────────
        let mut success = false;
        let mut cancelled = false;
        let attempt_start = std::time::Instant::now();
        let max_attempt_secs: u64 = 60;

        log(format!(
            "[fallback] Waiting up to {}s for server to start...",
            max_attempt_secs
        ));

        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let elapsed = attempt_start.elapsed().as_secs();

            // Hard timeout — kill and move to next fallback
            if elapsed >= max_attempt_secs {
                log(format!(
                    "[fallback] ⏱ Attempt {}/{} timed out after {}s — killing & moving on",
                    level + 1,
                    total,
                    max_attempt_secs
                ));
                log(format!("[progress] {}|{}|{}|failed", level + 1, total, desc));
                break;
            }

            // Check if user clicked Stop
            if cancel_token.load(std::sync::atomic::Ordering::Relaxed) {
                log(format!(
                    "[fallback] 🛑 Attempt {}/{} cancelled by user at {}s",
                    level + 1,
                    total,
                    elapsed
                ));
                cancelled = true;
                {
                    let mut s = state.lock().unwrap();
                    if let Some(mut child) = s.process.take() {
                        log(format!("[fallback] Killing PID {} via start_kill", pid));
                        let _ = child.start_kill();
                    }
                }
                break;
            }

            // Check if server is listening (SUCCESS)
            if started.load(std::sync::atomic::Ordering::Relaxed) {
                success = true;
                log(format!(
                    "[fallback] ✓ Server listening detected at {}s",
                    elapsed
                ));
                break;
            }

            // Check if child process died unexpectedly
            {
                let s = state.lock().unwrap();
                if s.process.is_none() {
                    log(format!(
                        "[fallback] ✗ Process died unexpectedly at {}s",
                        elapsed
                    ));
                    log(format!("[progress] {}|{}|{}|failed", level + 1, total, desc));
                    break;
                }
            }

            // Progress log every 10s
            if elapsed > 0 && elapsed % 10 == 0 {
                let out = output_count.load(std::sync::atomic::Ordering::Relaxed);
                log(format!(
                    "[fallback] ⏳ Attempt {}/{} — {}s elapsed, {} output lines",
                    level + 1, total, elapsed, out
                ));
            }
        }

        log(format!(
            "[fallback] success={}, cancelled={}",
            success, cancelled
        ));

        if success {
            // ── SUCCESS — keep process running ────────────────────────────
            log(format!("[progress] {}|{}|{}|success", level + 1, total, desc));
            log(format!("[success] Server started — {}", desc));
            log::info!("Server started on attempt {}", level + 1);

            {
                let mut s = state.lock().unwrap();
                s.status = ServerStatus::Running { port, pid, host: host.clone() };
            }
            // Don't kill the process — it's the running server!
            // Spawn a monitor to detect unexpected exit
            let state_monitor = state.clone();
            let log_cb_monitor = log_cb.clone();
            tokio::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                    let exit_status = {
                        let mut s = state_monitor.lock().unwrap();
                        match s.process.as_mut() {
                            Some(child) => child.try_wait(),
                            None => break,
                        }
                    };
                    match exit_status {
                        Ok(Some(status)) => {
                            let mut s = state_monitor.lock().unwrap();
                            s.process = None;
                            if s.status == ServerStatus::Stopped {
                                break;
                            }
                            if status.success() {
                                s.status = ServerStatus::Stopped;
                            } else {
                                let code = status.code().unwrap_or(-1);
                                let hex = format!("0x{:08X}", code as u32);
                                let msg = format!("Server crashed with exit code {} ({})", code, hex);
                                s.log_lines.push(format!("[error] {}", msg));

                                // Detect Vulkan GPU device lost during multimodal processing
                                let has_device_lost = s.log_lines.iter().any(|l| l.contains("ErrorDeviceLost"));
                                if has_device_lost {
                                    let hint = "[hint] Vulkan GPU device lost during image processing. \
                                        Enable 'mmproj Offload' = OFF (Advanced tab) to run vision encoder on CPU, \
                                        or reduce --n-gpu-layers to free GPU memory.";
                                    s.log_lines.push(hint.to_string());
                                    s.status = ServerStatus::Error {
                                        message: format!("{} — GPU cannot process images. Enable 'mmproj Offload' = OFF in Advanced tab.", msg),
                                    };
                                    drop(s);
                                    log_cb_monitor(format!("[error] {}", msg));
                                    log_cb_monitor(hint.to_string());
                                } else {
                                    s.status = ServerStatus::Error { message: msg.clone() };
                                    drop(s);
                                    log_cb_monitor(format!("[error] {}", msg));
                                }
                            }
                            break;
                        }
                        Ok(None) => continue,
                        Err(e) => {
                            let mut s = state_monitor.lock().unwrap();
                            s.process = None;
                            let msg = format!("Server process error: {}", e);
                            s.log_lines.push(format!("[error] {}", msg));
                            s.status = ServerStatus::Error { message: msg.clone() };
                            drop(s);
                            log_cb_monitor(format!("[error] {}", msg));
                            break;
                        }
                    }
                }
            });
            return Ok(());
        }

        // ── FAILED — kill process, then try next fallback level ───────────

        // Stop the stdout/stderr readers for this attempt
        stop.store(true, std::sync::atomic::Ordering::Relaxed);

        // Wait for monitors to exit (they'll exit because stop flag is set)
        let killed_child = {
            let mut s = state.lock().unwrap();
            s.process.take()
        };
        if let Some(mut child) = killed_child {
            let _ = child.start_kill();
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                child.wait(),
            ).await;
        }
        let _ = tokio::join!(h_out, h_err);
        log("[fallback] Monitors stopped".to_string());

        // ── Try HTTP health check as fallback detection ──────────────────
        log(format!("[fallback] Checking HTTP health on port {}", port));
        if check_http_health(port).await {
            log(format!(
                "[fallback] ✓ Server detected via port check (attempt {})",
                level + 1
            ));
            log(format!(
                "[success] Server detected via port check (attempt {})",
                level + 1
            ));
            log(format!("[progress] {}|{}|{}|success", level + 1, total, desc));
            {
                let mut s = state.lock().unwrap();
                s.status = ServerStatus::Running { port, pid, host: host.clone() };
            }
            return Ok(());
        }
        log(format!("[fallback] Port {} is free — process not listening", port));

        // ── FAILED — clean up, then continue ──────────────────────────────
        log(format!("[fallback] Cleaning up level {}/{}", level + 1, total));

        // Take the child from state so we can kill it by PID
        let proc_pid = {
            let mut s = state.lock().unwrap();
            let pid = s.process.as_ref().and_then(|c| c.id());
            s.process.take(); // drops the Child handle
            pid
        };

        // Force-kill by PID via taskkill (Windows) — more reliable than Child::kill()
        if let Some(kill_pid) = proc_pid {
            log(format!("[fallback] Force-killing PID {} via taskkill", kill_pid));
            #[cfg(target_os = "windows")]
            {
                let output = tokio::process::Command::new("taskkill")
                    .args(["/F", "/PID", &kill_pid.to_string()])
                    .output()
                    .await;
                match output {
                    Ok(o) => {
                        let stderr_out = String::from_utf8_lossy(&o.stderr);
                        if o.status.success() {
                            log(format!(
                                "[fallback] taskkill success for PID {}",
                                kill_pid
                            ));
                        } else {
                            log(format!(
                                "[fallback] taskkill failed for PID {}: {}",
                                kill_pid,
                                stderr_out.trim()
                            ));
                        }
                    }
                    Err(e) => {
                        log(format!(
                            "[fallback] taskkill error for PID {}: {}",
                            kill_pid, e
                        ));
                    }
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                // On Unix we rely on the Child handle + SIGTERM (kill_on_drop)
                log(format!("[fallback] Unix — relying on SIGTERM for PID {}", kill_pid));
            }
        } else {
            log("[fallback] No PID to kill (process already gone)".to_string());
        }

        // Force-kill any orphaned process still holding the port
        log(format!("[fallback] Checking for orphan processes on port {}", port));
        force_free_port(port).await;

        // If cancelled or stopped, skip to next level (don't bail)
        {
            let s = state.lock().unwrap();
            if matches!(s.status, ServerStatus::Stopped) {
                cancelled = true;
            }
        }

        // Emit failed progress only if not already emitted by the monitoring loop
        if !success && !cancelled {
            log(format!("[progress] {}|{}|{}|failed", level + 1, total, desc));
        }
        log::warn!("Attempt {} failed, trying next config", level + 1);

        if level + 1 < total {
            let next_desc = describe_config_level(&fallback_configs[level + 1], config);
            log(format!(
                "[fallback] Attempt {} failed — next: {}",
                level + 1,
                next_desc
            ));
        }
    }

    // All levels exhausted
    let total = fallback_configs.len();
    log(format!("[progress] {}|{}||exhausted", total, total));
    log("[error] All fallback configurations exhausted".to_string());

    {
        let mut s = state.lock().unwrap();
        s.status = ServerStatus::Error {
            message: "All fallback configurations exhausted".to_string(),
        };
    }

    anyhow::bail!(
        "Server failed to start after {} attempts. All fallback configurations exhausted.",
        total
    )
}

pub async fn stop_server(state: &SharedServerState) -> Result<()> {
    let mut child = {
        let mut s = state.lock().unwrap();
        s.status = ServerStatus::Stopped;
        s.cancel_token.store(true, std::sync::atomic::Ordering::Relaxed);
        s.process.take()
    };

    if let Some(ref mut child) = child {
        #[cfg(unix)]
        if let Some(pid) = child.id() {
            unsafe { libc::kill(pid as i32, libc::SIGTERM); }
            log::info!("Sent SIGTERM to server (pid {})", pid);
        }

        #[cfg(not(unix))]
        { let _ = child.start_kill(); }

        match tokio::time::timeout(
            std::time::Duration::from_secs(30),
            child.wait(),
        ).await {
            Ok(Ok(status)) => { log::info!("Server exited: {}", status); }
            Ok(Err(e)) => { log::warn!("Error waiting for server exit: {}", e); }
            Err(_) => {
                log::warn!("Server did not stop within 30 seconds, force killing");
                let _ = child.start_kill();
                let _ = child.wait().await;
            }
        }
    }

    Ok(())
}

pub fn kill_server_sync(state: &SharedServerState) {
    let mut child = {
        let mut s = state.lock().unwrap();
        s.status = ServerStatus::Stopped;
        s.cancel_token.store(true, std::sync::atomic::Ordering::Relaxed);
        s.process.take()
    };

    if let Some(ref mut child) = child {
        #[cfg(unix)]
        if let Some(pid) = child.id() {
            unsafe { libc::kill(pid as i32, libc::SIGTERM); }
        }

        #[cfg(not(unix))]
        { let _ = child.start_kill(); }

        let start = std::time::Instant::now();
        while start.elapsed() < std::time::Duration::from_secs(5) {
            match child.try_wait() {
                Ok(Some(status)) => {
                    log::info!("Server exited on shutdown: {}", status);
                    return;
                }
                Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
                Err(_) => break,
            }
        }

        let _ = child.start_kill();
        let _ = child.try_wait();
        log::warn!("Force-killed server on shutdown");
    }
}

pub fn build_args(config: &ServerConfig) -> Vec<String> {
    let mut args = Vec::new();

    args.push("--model".to_string());
    args.push(config.model_path.clone());

    if let Some(ref mmproj) = config.mmproj_path {
        if !mmproj.is_empty() {
            args.push("--mmproj".to_string());
            args.push(mmproj.clone());
            if config.no_mmproj_offload {
                args.push("--no-mmproj-offload".to_string());
            }
        }
    }

    args.push("--host".to_string());
    args.push(config.host.clone());

    args.push("--port".to_string());
    args.push(config.port.to_string());

    // Vision models need larger context — images generate many tokens.
    // If mmproj is set and ctx-size is 0 (auto) or too small, bump to 8192.
    let effective_ctx = if config.mmproj_path.is_some() {
        let min_ctx: u32 = 8192;
        if config.n_ctx == 0 || config.n_ctx < min_ctx {
            min_ctx
        } else {
            config.n_ctx
        }
    } else {
        config.n_ctx
    };
    args.push("--ctx-size".to_string());
    args.push(effective_ctx.to_string());

    args.push("--n-gpu-layers".to_string());
    args.push(config.n_gpu_layers.to_string());

    if let Some(threads) = config.n_threads {
        args.push("--threads".to_string());
        args.push(threads.to_string());
    }

    args.push("--flash-attn".to_string());
    args.push(config.flash_attn.clone());

    args.push("--cache-type-k".to_string());
    args.push(config.cache_type_k.clone());

    args.push("--cache-type-v".to_string());
    args.push(config.cache_type_v.clone());

    args.push("--temp".to_string());
    args.push(format!("{:.2}", config.temperature));

    args.push("--top-k".to_string());
    args.push(config.top_k.to_string());

    args.push("--min-p".to_string());
    args.push(format!("{:.4}", config.min_p));

    args.push("--top-p".to_string());
    args.push(format!("{:.4}", config.top_p));

    if config.n_predict != -1 {
        args.push("--n-predict".to_string());
        args.push(config.n_predict.to_string());
    }

    args.push("--batch-size".to_string());
    args.push(config.n_batch.to_string());

    args.push("--ubatch-size".to_string());
    args.push(config.n_ubatch.to_string());

    if config.cont_batching {
        args.push("--cont-batching".to_string());
    } else {
        args.push("--no-cont-batching".to_string());
    }

    if config.mlock { args.push("--mlock".to_string()); }
    if config.no_mmap { args.push("--no-mmap".to_string()); }

    if let Some(seed) = config.seed {
        args.push("--seed".to_string());
        args.push(seed.to_string());
    }

    if let Some(scale) = config.rope_freq_scale {
        args.push("--rope-freq-scale".to_string());
        args.push(format!("{:.6}", scale));
    }

    if let Some(base) = config.rope_freq_base {
        args.push("--rope-freq-base".to_string());
        args.push(format!("{:.1}", base));
    }

    if let Some(n) = config.grp_attn_n {
        args.push("--grp-attn-n".to_string());
        args.push(n.to_string());
    }

    if let Some(w) = config.grp_attn_w {
        args.push("--grp-attn-w".to_string());
        args.push(w.to_string());
    }

    args.push("--parallel".to_string());
    args.push(config.parallel.to_string());

    let mut sorted_params: Vec<_> = config.extra_params.iter()
        .filter(|(k, _)| k.as_str() != "__raw__" && k.as_str() != "mmproj")
        .collect();
    sorted_params.sort_by_key(|(k, _)| (*k).clone());
    for (key, value) in sorted_params {
        args.push(format!("--{}", key));
        if !value.is_empty() {
            args.push(value.clone());
        }
    }

    if let Some(raw) = config.extra_params.get("__raw__") {
        for part in raw.split_whitespace() {
            args.push(part.to_string());
        }
    }

    args
}

pub fn suggest_server_config(
    model_path: &str,
    model_size_mb: u64,
    system: &SystemInfo,
) -> ServerConfig {
    let suggestion = suggest_config(model_size_mb, system);

    let cache_type_k = if suggestion.can_fit_fully_in_vram || suggestion.total_usable_mb > 8192 {
        "f16".to_string()
    } else {
        "q8_0".to_string()
    };

    ServerConfig {
        model_path: model_path.to_string(),
        n_ctx: suggestion.n_ctx,
        n_gpu_layers: suggestion.n_gpu_layers,
        parallel: suggestion.parallel,
        flash_attn: "auto".to_string(),
        cache_type_k,
        cache_type_v: "f16".to_string(),
        ..ServerConfig::default()
    }
}
