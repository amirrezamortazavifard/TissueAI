use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio::io::AsyncBufReadExt;
use tokio::process::{Child, Command};
use tauri::Emitter;

const PORT: u16 = 8082;
const GET_PIP_URL: &str = "https://bootstrap.pypa.io/get-pip.py";
const GITHUB_RELEASES_URL: &str = "https://api.github.com/repos/python/cpython/releases";
const CACHE_TTL_SECS: u64 = 3600;

// ── Platform Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlatformType {
    Windows,
    Linux,
    MacOS,
    Unknown,
}

// ── Version Discovery ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PythonVersion {
    pub version: String,
    pub release_date: String,
    pub is_latest: bool,
    pub is_security_fix: bool,
    pub end_of_life: Option<String>,
    pub distributions: Vec<PythonDistribution>,
    pub compatibility_score: f64,
    pub notes: String,
    pub recommended: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PythonDistribution {
    pub version: String,
    pub url: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub arch: String,
    pub platform: PlatformType,
    pub variant: String,
    pub checksum_sha256: Option<String>,
    pub compatible: bool,
    pub recommended: bool,
    pub release_date: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub platform_type: PlatformType,
    pub kernel_version: Option<String>,
    pub distro_name: Option<String>,
    pub distro_version: Option<String>,
    pub compatible_variants: Vec<String>,
    pub recommended_variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrereqCheck {
    pub name: String,
    pub passed: bool,
    pub message: String,
    pub required: bool,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCheck {
    pub name: String,
    pub passed: bool,
    pub message: String,
    pub details: Option<String>,
}

// ── State Machine ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InstallPhase {
    Idle,
    Init(SinglePhase),
    DiscoveringVersions(SinglePhase),
    VersionSelect {
        available_versions: Vec<PythonVersion>,
        recommended: String,
        reason: String,
    },
    DetectingPlatform(SinglePhase),
    ValidatingPrereqs(SinglePhase),
    CheckingPython(SinglePhase),
    DownloadingPython(DownloadInfo),
    ExtractingPython(ExtractInfo),
    ConfiguringPython(SinglePhase),
    DownloadingGetPip(DownloadInfo),
    InstallingPip(InstallInfo),
    InstallingOpenWebUI(InstallInfo),
    Verifying(SinglePhase),
    Starting(SinglePhase),
    Running,
    Error {
        message: String,
        phase: String,
        recoverable: bool,
        retry_count: u32,
        max_retries: u32,
        suggested_action: String,
        error_code: String,
    },
    Paused {
        paused_at_phase: String,
        sub_phase: String,
        overall_percent: f64,
        can_resume: bool,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SinglePhase {
    pub sub_phase: String,
    pub percent: f64,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DownloadInfo {
    pub sub_phase: String,
    pub percent: f64,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub speed_bps: f64,
    pub eta_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExtractInfo {
    pub sub_phase: String,
    pub percent: f64,
    pub files_extracted: usize,
    pub total_files: usize,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InstallInfo {
    pub sub_phase: String,
    pub percent: f64,
    pub packages_installed: usize,
    pub total_packages: usize,
    pub detail: String,
}

// ── Log Entry ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub time_secs: f64,
    pub level: String,
    pub text: String,
    pub category: String,
    pub icon: Option<String>,
    pub is_milestone: bool,
}

// ── Detailed Progress Event ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub event_id: String,
    pub event_type: String,
    pub timestamp: f64,
    pub wall_clock: String,
    pub schema_version: String,
    pub phase: PhaseInfo,
    pub progress: ProgressMetrics,
    pub metrics: DetailedMetrics,
    pub message: String,
    pub detail: Option<String>,
    pub logs: Vec<LogEntry>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub context: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseInfo {
    pub current: String,
    pub label: String,
    pub sub_phase: String,
    pub sub_phase_label: String,
    pub percent: f64,
    pub total_phases: u32,
    pub completed_phases: u32,
    pub is_terminal: bool,
    pub is_error: bool,
    pub is_paused: bool,
    pub is_user_waiting: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressMetrics {
    pub overall_percent: f64,
    pub overall_eta_secs: Option<f64>,
    pub overall_eta_display: String,
    pub overall_eta_human: String,
    pub phase_percent: f64,
    pub phase_eta_secs: Option<f64>,
    pub phase_eta_display: String,
    pub estimated_completion_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedMetrics {
    pub elapsed_secs: f64,
    pub phase_elapsed_secs: f64,
    pub speed_bytes_per_sec: Option<f64>,
    pub average_speed_bytes_per_sec: Option<f64>,
    pub peak_speed_bytes_per_sec: Option<f64>,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub files_processed: Option<usize>,
    pub total_files: Option<usize>,
    pub packages_installed: Option<usize>,
    pub total_packages: Option<usize>,
    pub memory_usage_mb: Option<f64>,
    pub memory_total_mb: Option<f64>,
    pub network_status: String,
    pub retried_count: u32,
    pub chunks_received: u64,
}

// ── Pause State ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PauseState {
    pub phase: String,
    pub sub_phase: String,
    pub overall_percent: f64,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub elapsed_secs: f64,
    pub paused_at: f64,
    pub reason: String,
    pub version_url: Option<String>,
}

impl PauseState {
    pub fn save(&self, path: &std::path::Path) -> Result<(), String> {
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load(path: &std::path::Path) -> Option<Self> {
        let content = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }
}

// ── Status ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenWebUIStatus {
    pub installed: bool,
    pub running: bool,
    pub installing: bool,
    pub paused: bool,
    pub port: u16,
    pub url: String,
    pub pid: Option<u32>,
    pub data_dir: String,
    pub venv_dir: String,
    pub python_dir: String,
    pub error: Option<String>,
    pub progress: Option<String>,
    pub phase: InstallPhase,
    pub overall_percent: f64,
    pub elapsed_secs: f64,
    pub logs: Vec<String>,
    pub selected_version: Option<String>,
    pub selected_variant: Option<String>,
    pub platform_info: Option<PlatformInfo>,
}

impl Default for OpenWebUIStatus {
    fn default() -> Self {
        Self {
            installed: false,
            running: false,
            installing: false,
            paused: false,
            port: 8082,
            url: "http://127.0.0.1:8082".into(),
            pid: None,
            data_dir: String::new(),
            venv_dir: String::new(),
            python_dir: String::new(),
            error: None,
            progress: None,
            phase: InstallPhase::Idle,
            overall_percent: 0.0,
            elapsed_secs: 0.0,
            logs: Vec::new(),
            selected_version: None,
            selected_variant: None,
            platform_info: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenWebUIDiskInfo {
    pub python_size: u64,
    pub data_size: u64,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonStatusInfo {
    pub python_dir: String,
    pub python_exists: bool,
    pub pip_installed: bool,
    pub open_webui_installed: bool,
    pub version: Option<String>,
    pub system_python: Option<SystemPythonInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemPythonInfo {
    pub path: String,
    pub version: String,
    pub pip_available: bool,
}



// ── Manager ───────────────────────────────────────────────────────────────────

pub struct OpenWebUIManager {
    process: Option<Child>,
    port: u16,
    status: OpenWebUIStatus,
    base_dir: PathBuf,
    install_start: Option<Instant>,
    phase_start: Option<Instant>,
    speed_samples: Vec<(f64, u64)>,
    logs: Vec<LogEntry>,
    raw_logs: Vec<String>,
    retry_count: u32,
    max_retries: u32,
    paused: bool,
    version_cache: Vec<PythonVersion>,
    cache_timestamp: Option<Instant>,
    selected_version_url: Option<String>,
    event_counter: u64,
}

impl OpenWebUIManager {
    pub fn new() -> Self {
        let base_dir = dirs::document_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("TissueAI");
        let python_dir = base_dir.join("python");
        let venv_dir = base_dir.join("open-webui");
        let data_dir = base_dir.join("open-webui-data");

        Self {
            process: None,
            port: PORT,
            status: OpenWebUIStatus {
                installed: false,
                running: false,
                installing: false,
                paused: false,
                port: PORT,
                url: format!("http://127.0.0.1:{}", PORT),
                pid: None,
                data_dir: data_dir.to_string_lossy().to_string(),
                venv_dir: venv_dir.to_string_lossy().to_string(),
                python_dir: python_dir.to_string_lossy().to_string(),
                error: None,
                progress: None,
                phase: InstallPhase::Idle,
                overall_percent: 0.0,
                elapsed_secs: 0.0,
                logs: Vec::new(),
                selected_version: None,
                selected_variant: None,
                platform_info: None,
            },
            base_dir,
            install_start: None,
            phase_start: None,
            speed_samples: Vec::new(),
            logs: Vec::new(),
            raw_logs: Vec::new(),
            retry_count: 0,
            max_retries: 3,
            paused: false,
            version_cache: Vec::new(),
            cache_timestamp: None,
            selected_version_url: None,
            event_counter: 0,
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn bundled_python(&self) -> PathBuf {
        self.base_dir.join("python").join("python.exe")
    }

    fn elapsed(&self) -> f64 {
        self.install_start.map(|s| s.elapsed().as_secs_f64()).unwrap_or(0.0)
    }

    fn phase_elapsed(&self) -> f64 {
        self.phase_start.map(|s| s.elapsed().as_secs_f64()).unwrap_or(0.0)
    }

    fn wall_clock(&self) -> String {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let secs = now.as_secs();
        let h = (secs / 3600) % 24;
        let m = (secs / 60) % 60;
        let s = secs % 60;
        format!("{:02}:{:02}:{:02}", h, m, s)
    }

    fn next_event_id(&mut self) -> String {
        self.event_counter += 1;
        format!("evt_{}_{}", self.elapsed() as u64, self.event_counter)
    }

    fn add_log(&mut self, msg: &str) {
        let ts = self.elapsed();
        let line = format!("[{ts:.1}s] {msg}");
        self.raw_logs.push(line.clone());
        self.logs.push(LogEntry {
            time_secs: ts,
            level: "info".into(),
            text: msg.to_string(),
            category: "system".into(),
            icon: None,
            is_milestone: false,
        });
        if self.logs.len() > 500 {
            self.logs.remove(0);
            self.raw_logs.remove(0);
        }
    }

    fn add_log_level(&mut self, msg: &str, level: &str) {
        let ts = self.elapsed();
        let line = format!("[{ts:.1}s] {msg}");
        self.raw_logs.push(line.clone());
        let icon = match level {
            "success" => Some("check-circle".into()),
            "error" => Some("alert-circle".into()),
            "warn" => Some("alert-triangle".into()),
            _ => None,
        };
        self.logs.push(LogEntry {
            time_secs: ts,
            level: level.to_string(),
            text: msg.to_string(),
            category: "system".into(),
            icon,
            is_milestone: level == "success",
        });
        if self.logs.len() > 500 {
            self.logs.remove(0);
            self.raw_logs.remove(0);
        }
    }

    fn add_log_categorized(&mut self, msg: &str, level: &str, category: &str, icon: Option<String>, milestone: bool) {
        let ts = self.elapsed();
        let line = format!("[{ts:.1}s] {msg}");
        self.raw_logs.push(line.clone());
        self.logs.push(LogEntry {
            time_secs: ts,
            level: level.to_string(),
            text: msg.to_string(),
            category: category.to_string(),
            icon,
            is_milestone: milestone,
        });
        if self.logs.len() > 500 {
            self.logs.remove(0);
            self.raw_logs.remove(0);
        }
    }

    fn set_phase(&mut self, phase: InstallPhase, message: &str, overall: f64) {
        self.status.phase = phase;
        self.status.overall_percent = overall;
        self.status.elapsed_secs = self.elapsed();
        self.status.progress = Some(message.to_string());
        self.phase_start = Some(Instant::now());
        self.add_log(message);
    }

    fn set_error(&mut self, message: &str, recoverable: bool, error_code: &str, suggested_action: &str) {
        self.status.installing = false;
        self.status.error = Some(message.to_string());
        self.status.phase = InstallPhase::Error {
            message: message.to_string(),
            phase: self.phase_to_string(),
            recoverable,
            retry_count: self.retry_count,
            max_retries: self.max_retries,
            suggested_action: suggested_action.to_string(),
            error_code: error_code.to_string(),
        };
        self.add_log_level(message, "error");
    }

    fn get_phase_label(&self) -> String {
        match &self.status.phase {
            InstallPhase::Idle => "Ready".into(),
            InstallPhase::Init(_) => "Initializing".into(),
            InstallPhase::DiscoveringVersions(_) => "Discovering Versions".into(),
            InstallPhase::VersionSelect { .. } => "Select Version".into(),
            InstallPhase::DetectingPlatform(_) => "Detecting Platform".into(),
            InstallPhase::ValidatingPrereqs(_) => "Validating".into(),
            InstallPhase::CheckingPython(_) => "Checking Python".into(),
            InstallPhase::DownloadingPython(_) => "Downloading Python".into(),
            InstallPhase::ExtractingPython(_) => "Extracting Python".into(),
            InstallPhase::ConfiguringPython(_) => "Configuring Python".into(),
            InstallPhase::DownloadingGetPip(_) => "Downloading get-pip.py".into(),
            InstallPhase::InstallingPip(_) => "Installing pip".into(),
            InstallPhase::InstallingOpenWebUI(_) => "Installing Open WebUI".into(),
            InstallPhase::Verifying(_) => "Verifying".into(),
            InstallPhase::Starting(_) => "Starting Server".into(),
            InstallPhase::Running => "Running".into(),
            InstallPhase::Error { .. } => "Error".into(),
            InstallPhase::Paused { .. } => "Paused".into(),
        }
    }

    fn phase_to_string(&self) -> String {
        match &self.status.phase {
            InstallPhase::Idle => "idle".into(),
            InstallPhase::Init(_) => "init".into(),
            InstallPhase::DiscoveringVersions(_) => "discovering_versions".into(),
            InstallPhase::VersionSelect { .. } => "version_select".into(),
            InstallPhase::DetectingPlatform(_) => "detecting_platform".into(),
            InstallPhase::ValidatingPrereqs(_) => "validating_prereqs".into(),
            InstallPhase::CheckingPython(_) => "checking_python".into(),
            InstallPhase::DownloadingPython(_) => "downloading_python".into(),
            InstallPhase::ExtractingPython(_) => "extracting_python".into(),
            InstallPhase::ConfiguringPython(_) => "configuring_python".into(),
            InstallPhase::DownloadingGetPip(_) => "downloading_get_pip".into(),
            InstallPhase::InstallingPip(_) => "installing_pip".into(),
            InstallPhase::InstallingOpenWebUI(_) => "installing_open_webui".into(),
            InstallPhase::Verifying(_) => "verifying".into(),
            InstallPhase::Starting(_) => "starting".into(),
            InstallPhase::Running => "running".into(),
            InstallPhase::Error { .. } => "error".into(),
            InstallPhase::Paused { .. } => "paused".into(),
        }
    }

    fn get_sub_phase(&self) -> String {
        match &self.status.phase {
            InstallPhase::Idle => "ready".into(),
            InstallPhase::Init(i) | InstallPhase::DiscoveringVersions(i)
            | InstallPhase::DetectingPlatform(i) | InstallPhase::ValidatingPrereqs(i)
            | InstallPhase::CheckingPython(i) | InstallPhase::ConfiguringPython(i)
            | InstallPhase::Verifying(i) | InstallPhase::Starting(i) => i.sub_phase.clone(),
            InstallPhase::VersionSelect { .. } => "waiting".into(),
            InstallPhase::DownloadingPython(i) | InstallPhase::DownloadingGetPip(i) => i.sub_phase.clone(),
            InstallPhase::ExtractingPython(i) => i.sub_phase.clone(),
            InstallPhase::InstallingPip(i) | InstallPhase::InstallingOpenWebUI(i) => i.sub_phase.clone(),
            InstallPhase::Running => "ready".into(),
            InstallPhase::Error { .. } => "error".into(),
            InstallPhase::Paused { .. } => "paused".into(),
        }
    }

    fn get_phase_percent(&self) -> f64 {
        match &self.status.phase {
            InstallPhase::Idle | InstallPhase::Running => 100.0,
            InstallPhase::VersionSelect { .. } | InstallPhase::Paused { .. } => 0.0,
            InstallPhase::Error { .. } => 0.0,
            InstallPhase::Init(i) | InstallPhase::DiscoveringVersions(i)
            | InstallPhase::DetectingPlatform(i) | InstallPhase::ValidatingPrereqs(i)
            | InstallPhase::CheckingPython(i) | InstallPhase::ConfiguringPython(i)
            | InstallPhase::Verifying(i) | InstallPhase::Starting(i) => i.percent,
            InstallPhase::DownloadingPython(i) | InstallPhase::DownloadingGetPip(i) => i.percent,
            InstallPhase::ExtractingPython(i) => i.percent,
            InstallPhase::InstallingPip(i) | InstallPhase::InstallingOpenWebUI(i) => i.percent,
        }
    }

    fn get_network_status(&self) -> String {
        let recent_speed = self.speed_samples.last();
        if let Some((_, bytes)) = recent_speed {
            if *bytes < 1024 {
                return "offline".into();
            }
        }
        if self.speed_samples.len() >= 3 {
            let avg: f64 = self.speed_samples.iter().rev().take(3).map(|(_, b)| *b as f64).sum::<f64>() / 3.0;
            if avg < 1024.0 * 10.0 {
                return "slow".into();
            }
        }
        "online".into()
    }

    fn format_eta_compact(secs: f64) -> String {
        if secs <= 0.0 { return "done".into(); }
        let secs = secs as u64;
        if secs < 60 { format!("{}s", secs) }
        else if secs < 3600 { format!("{}m {}s", secs / 60, secs % 60) }
        else { format!("{}h {}m", secs / 3600, (secs % 3600) / 60) }
    }

    fn format_eta_human(secs: f64) -> String {
        if secs <= 0.0 { return "almost done".into(); }
        if secs < 10.0 { return "a few seconds".into(); }
        if secs < 30.0 { return "less than a minute".into(); }
        if secs < 90.0 { return "about a minute".into(); }
        if secs < 300.0 { return format!("{} minutes", (secs / 60.0).round() as u64); }
        if secs < 1800.0 { return format!("about {} minutes", (secs / 60.0).round() as u64); }
        format!("about {} hours", (secs / 3600.0).round() as u64)
    }

    fn calculate_overall_percent(&self) -> f64 {
        let weights = [
            ("init", 2.0),
            ("discovering_versions", 6.0),
            ("version_select", 0.0),
            ("detecting_platform", 3.0),
            ("validating_prereqs", 4.0),
            ("checking_python", 2.0),
            ("downloading_python", 20.0),
            ("extracting_python", 7.0),
            ("configuring_python", 6.0),
            ("downloading_get_pip", 4.0),
            ("installing_pip", 6.0),
            ("installing_open_webui", 30.0),
            ("verifying", 7.0),
            ("starting", 5.0),
        ];

        let phase_name = self.phase_to_string();
        let phase_percent = self.get_phase_percent();
        let mut overall = 0.0;

        for (name, weight) in &weights {
            if *name == phase_name {
                overall += weight * (phase_percent / 100.0);
                break;
            } else if *name != "version_select" {
                overall += weight;
            }
        }
        overall.min(100.0)
    }

    fn emit_detailed_progress(&mut self, app: &tauri::AppHandle, message: &str, detail: Option<String>) {
        let overall = self.calculate_overall_percent();
        self.status.overall_percent = overall;
        let phase_percent = self.get_phase_percent();
        let phase_label = self.get_phase_label();
        let sub_phase = self.get_sub_phase();
        let phase_str = self.phase_to_string();

        let (total_phases, completed_phases) = match &self.status.phase {
            InstallPhase::Idle => (13, 0),
            InstallPhase::Init(_) => (13, 0),
            InstallPhase::DiscoveringVersions(_) => (13, 1),
            InstallPhase::VersionSelect { .. } => (13, 2),
            InstallPhase::DetectingPlatform(_) => (13, 2),
            InstallPhase::ValidatingPrereqs(_) => (13, 3),
            InstallPhase::CheckingPython(_) => (13, 4),
            InstallPhase::DownloadingPython(_) => (13, 5),
            InstallPhase::ExtractingPython(_) => (13, 7),
            InstallPhase::ConfiguringPython(_) => (13, 8),
            InstallPhase::DownloadingGetPip(_) => (13, 9),
            InstallPhase::InstallingPip(_) => (13, 10),
            InstallPhase::InstallingOpenWebUI(_) => (13, 11),
            InstallPhase::Verifying(_) => (13, 12),
            InstallPhase::Starting(_) => (13, 12),
            InstallPhase::Running => (13, 13),
            InstallPhase::Error { .. } => (13, 0),
            InstallPhase::Paused { .. } => (13, 0),
        };

        let is_terminal = matches!(&self.status.phase, InstallPhase::Running);
        let is_error = matches!(&self.status.phase, InstallPhase::Error { .. });
        let is_paused = matches!(&self.status.phase, InstallPhase::Paused { .. });
        let is_user_waiting = matches!(&self.status.phase, InstallPhase::VersionSelect { .. });

        let mut metrics = DetailedMetrics {
            elapsed_secs: self.elapsed(),
            phase_elapsed_secs: self.phase_elapsed(),
            speed_bytes_per_sec: None,
            average_speed_bytes_per_sec: None,
            peak_speed_bytes_per_sec: None,
            bytes_downloaded: 0,
            total_bytes: 0,
            files_processed: None,
            total_files: None,
            packages_installed: None,
            total_packages: None,
            memory_usage_mb: None,
            memory_total_mb: None,
            network_status: self.get_network_status(),
            retried_count: self.retry_count,
            chunks_received: 0,
        };

        if let InstallPhase::DownloadingPython(info) | InstallPhase::DownloadingGetPip(info) = &self.status.phase {
            metrics.bytes_downloaded = info.bytes_downloaded;
            metrics.total_bytes = info.total_bytes;
            metrics.speed_bytes_per_sec = Some(info.speed_bps);
            if !self.speed_samples.is_empty() {
                let total_bytes: u64 = self.speed_samples.iter().map(|(_, b)| *b).sum();
                let total_secs: f64 = self.speed_samples.last().map(|(t, _)| *t).unwrap_or(0.0) - self.speed_samples.first().map(|(t, _)| *t).unwrap_or(0.0);
                if total_secs > 0.0 {
                    metrics.average_speed_bytes_per_sec = Some(total_bytes as f64 / total_secs);
                }
                metrics.peak_speed_bytes_per_sec = Some(
                    self.speed_samples.iter().map(|(_, b)| *b as f64).fold(0.0_f64, f64::max)
                );
                metrics.chunks_received = self.speed_samples.len() as u64;
            }
        }

        if let InstallPhase::ExtractingPython(info) = &self.status.phase {
            metrics.files_processed = Some(info.files_extracted);
            metrics.total_files = Some(info.total_files);
        }

        if let InstallPhase::InstallingPip(info) | InstallPhase::InstallingOpenWebUI(info) = &self.status.phase {
            metrics.packages_installed = Some(info.packages_installed);
            metrics.total_packages = Some(info.total_packages);
        }

        // Memory usage (cross-platform)
        #[cfg(target_os = "windows")]
        {
            if let Ok(proc) = std::fs::read_to_string("NUL") {
                let _ = proc;
            }
            // Use sysinfo or just skip on Windows for now
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(proc) = std::fs::read_to_string("/proc/self/status") {
                for line in proc.lines() {
                    if line.starts_with("VmRSS:") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() > 1 {
                            if let Ok(kb) = parts[1].parse::<f64>() {
                                metrics.memory_usage_mb = Some(kb / 1024.0);
                            }
                        }
                    }
                }
            }
        }

        // ETA calculation
        let overall_eta = if overall > 0.0 && overall < 100.0 && self.elapsed() > 0.0 {
            let speed = overall / self.elapsed();
            if speed > 0.0 { Some((100.0 - overall) / speed) } else { None }
        } else { None };

        let progress = ProgressMetrics {
            overall_percent: overall,
            overall_eta_secs: overall_eta,
            overall_eta_display: overall_eta.map(|e| Self::format_eta_compact(e)).unwrap_or_default(),
            overall_eta_human: overall_eta.map(|e| Self::format_eta_human(e)).unwrap_or_default(),
            phase_percent,
            phase_eta_secs: None,
            phase_eta_display: String::new(),
            estimated_completion_time: None,
        };

        let payload = ProgressPayload {
            event_id: self.next_event_id(),
            event_type: "installation_progress".into(),
            timestamp: self.elapsed(),
            wall_clock: self.wall_clock(),
            schema_version: "2.0".into(),
            phase: PhaseInfo {
                current: phase_str,
                label: phase_label,
                sub_phase: sub_phase.clone(),
                sub_phase_label: sub_phase,
                percent: phase_percent,
                total_phases,
                completed_phases,
                is_terminal,
                is_error,
                is_paused,
                is_user_waiting,
            },
            progress,
            metrics,
            message: message.to_string(),
            detail,
            logs: self.logs.clone(),
            warnings: Vec::new(),
            errors: if let InstallPhase::Error { ref message, .. } = self.status.phase {
                vec![message.clone()]
            } else { Vec::new() },
            context: std::collections::HashMap::new(),
        };

        self.status.progress = Some(message.to_string());
        let _ = app.emit("open_webui_progress", payload);
    }

    // ── Version Discovery ─────────────────────────────────────────────────────

    pub async fn discover_versions(&mut self, app: Option<&tauri::AppHandle>) -> Result<Vec<PythonVersion>, String> {
        // Check cache
        if let Some(ts) = self.cache_timestamp {
            if ts.elapsed().as_secs() < CACHE_TTL_SECS && !self.version_cache.is_empty() {
                return Ok(self.version_cache.clone());
            }
        }

        if let Some(app) = app {
            self.set_phase(InstallPhase::DiscoveringVersions(SinglePhase {
                sub_phase: "fetching_from_github".into(),
                percent: 0.0,
                detail: "Fetching available Python versions from GitHub...".into(),
            }), "Discovering Python versions...", 2.0);
            self.emit_detailed_progress(app, "Fetching available Python versions from GitHub...", Some(GITHUB_RELEASES_URL.into()));
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;

        let platform = self.detect_platform_sync();

        match client.get(GITHUB_RELEASES_URL)
            .header("User-Agent", "TissueAI/1.0")
            .send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    let releases: Vec<GitHubRelease> = resp.json().await.map_err(|e| e.to_string())?;
                    let versions = self.map_releases_to_versions(releases, &platform);
                    self.version_cache = versions.clone();
                    self.cache_timestamp = Some(Instant::now());
                    if let Some(app) = app {
                        self.add_log_categorized(
                            &format!("Found {} compatible Python versions", versions.len()),
                            "success", "version_discovery", Some("check-circle".into()), true,
                        );
                    }
                    Ok(versions)
                } else {
                    // Fallback to hardcoded versions
                    let versions = self.get_fallback_versions(&platform);
                    Ok(versions)
                }
            }
            Err(_) => {
                // Fallback to hardcoded versions
                let versions = self.get_fallback_versions(&platform);
                Ok(versions)
            }
        }
    }

    fn map_releases_to_versions(&self, releases: Vec<GitHubRelease>, platform: &PlatformInfo) -> Vec<PythonVersion> {
        let mut versions = Vec::new();
        let mut found_latest = false;

        for release in releases {
            if release.prerelease || release.draft { continue; }
            if !release.tag_name.starts_with("3.") { continue; }

            let version = release.tag_name.trim_start_matches('v').to_string();
            let distributions = self.map_release_to_distributions(&release, platform);
            if distributions.is_empty() { continue; }

            let is_latest = !found_latest && release.tag_name.starts_with("3.1");
            if is_latest { found_latest = true; }

            let compatible_count = distributions.iter().filter(|d| d.compatible).count();
            let compatibility_score = if distributions.is_empty() { 0.0 } else { compatible_count as f64 / distributions.len() as f64 };

            versions.push(PythonVersion {
                version,
                release_date: release.published_at.clone(),
                is_latest,
                is_security_fix: false,
                end_of_life: None,
                distributions,
                compatibility_score,
                notes: String::new(),
                recommended: is_latest,
            });

            if versions.len() >= 6 { break; }
        }

        if let Some(first) = versions.first_mut() {
            first.recommended = true;
        }

        versions
    }

    fn map_release_to_distributions(&self, release: &GitHubRelease, platform: &PlatformInfo) -> Vec<PythonDistribution> {
        let mut dists = Vec::new();
        let version = release.tag_name.trim_start_matches('v').to_string();

        for asset in &release.assets {
            let name = asset.name.clone();
            let url = asset.browser_download_url.clone();
            let size = asset.size as u64;

            let (variant, arch, compatible) = match platform.platform_type {
                PlatformType::Windows => {
                    if name.ends_with("-amd64.zip") && name.contains("embed") {
                        ("embeddable".into(), "amd64".into(), platform.arch == "x86_64")
                    } else if name.ends_with("-amd64.exe") && !name.contains("webinstall") {
                        ("installer".into(), "amd64".into(), platform.arch == "x86_64")
                    } else if name.ends_with("-arm64.zip") && name.contains("embed") {
                        ("embeddable".into(), "arm64".into(), platform.arch == "aarch64")
                    } else if name.ends_with("-arm64.exe") && !name.contains("webinstall") {
                        ("installer".into(), "arm64".into(), platform.arch == "aarch64")
                    } else {
                        continue;
                    }
                }
                PlatformType::Linux => {
                    if name.ends_with(".tar.xz") && !name.contains("installonly") {
                        ("tar.xz".into(), if name.contains("aarch64") { "aarch64".into() } else { "x86_64".into() }, true)
                    } else {
                        continue;
                    }
                }
                PlatformType::MacOS => {
                    if name.ends_with(".pkg") && name.contains("macos") {
                        let arch = if name.contains("arm64") || name.contains("universal") { "universal2".into() } else { "x86_64".into() };
                        ("pkg".into(), arch, true)
                    } else {
                        continue;
                    }
                }
                _ => continue,
            };

            let is_recommended = variant == "embeddable" && platform.platform_type == PlatformType::Windows;

            dists.push(PythonDistribution {
                version: version.clone(),
                url,
                size_bytes: size,
                size_display: format_size(size),
                arch,
                platform: platform.platform_type.clone(),
                variant,
                checksum_sha256: None,
                compatible,
                recommended: is_recommended,
                release_date: release.published_at.clone(),
                notes: String::new(),
            });
        }

        dists.sort_by(|a, b| {
            if a.recommended && !b.recommended { std::cmp::Ordering::Less }
            else if !a.recommended && b.recommended { std::cmp::Ordering::Greater }
            else { b.size_bytes.cmp(&a.size_bytes) }
        });

        dists
    }

    fn get_fallback_versions(&self, platform: &PlatformInfo) -> Vec<PythonVersion> {
        let versions = vec![
            ("3.11.9", "embeddable", "amd64", 11_426_325, "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"),
            ("3.12.4", "embeddable", "amd64", 12_100_000, "https://www.python.org/ftp/python/3.12.4/python-3.12.4-embed-amd64.zip"),
            ("3.10.11", "embeddable", "amd64", 10_800_000, "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"),
            ("3.9.13", "embeddable", "amd64", 10_200_000, "https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip"),
        ];

        versions.into_iter().enumerate().map(|(i, (ver, variant, arch, size, url))| {
            let compatible = platform.arch == arch || variant == "embeddable";
            PythonVersion {
                version: ver.to_string(),
                release_date: String::new(),
                is_latest: i == 0,
                is_security_fix: false,
                end_of_life: None,
                distributions: vec![PythonDistribution {
                    version: ver.to_string(),
                    url: url.to_string(),
                    size_bytes: size,
                    size_display: format_size(size),
                    arch: arch.to_string(),
                    platform: platform.platform_type.clone(),
                    variant: variant.to_string(),
                    checksum_sha256: None,
                    compatible,
                    recommended: i == 0,
                    release_date: String::new(),
                    notes: String::new(),
                }],
                compatibility_score: if compatible { 1.0 } else { 0.0 },
                notes: String::new(),
                recommended: i == 0,
            }
        }).collect()
    }

    // ── Platform Detection ────────────────────────────────────────────────────

    pub fn detect_platform_sync(&self) -> PlatformInfo {
        let os = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        let (platform_type, os_version) = match os {
            "windows" => (PlatformType::Windows, get_windows_version()),
            "linux" => (PlatformType::Linux, get_linux_version()),
            "macos" => (PlatformType::MacOS, get_macos_version()),
            _ => (PlatformType::Unknown, os.to_string()),
        };

        let (compatible_variants, recommended_variant) = match platform_type {
            PlatformType::Windows => {
                let mut v = vec!["embeddable".to_string()];
                if arch == "x86_64" || arch == "aarch64" { v.push("installer".to_string()); }
                (v, "embeddable".to_string())
            }
            PlatformType::Linux => (vec!["tar.xz".to_string()], "tar.xz".to_string()),
            PlatformType::MacOS => (vec!["pkg".to_string(), "brew".to_string()], "pkg".to_string()),
            _ => (vec![], "unknown".to_string()),
        };

        PlatformInfo {
            os: os.to_string(),
            os_version,
            arch: arch.to_string(),
            platform_type,
            kernel_version: None,
            distro_name: None,
            distro_version: None,
            compatible_variants,
            recommended_variant,
        }
    }

    pub async fn detect_platform(&mut self, app: &tauri::AppHandle) -> Result<PlatformInfo, String> {
        self.set_phase(InstallPhase::DetectingPlatform(SinglePhase {
            sub_phase: "detecting_os".into(),
            percent: 0.0,
            detail: "Detecting operating system...".into(),
        }), "Detecting platform...", 8.0);
        self.emit_detailed_progress(app, "Detecting operating system...", None);

        let platform = self.detect_platform_sync();
        self.status.platform_info = Some(platform.clone());

        self.add_log_categorized(
            &format!("OS: {} ({})", platform.os, platform.os_version),
            "info", "platform_detection", Some("monitor".into()), false,
        );
        self.add_log_categorized(
            &format!("Architecture: {}", platform.arch),
            "info", "platform_detection", None, false,
        );
        self.add_log_categorized(
            &format!("Recommended variant: {}", platform.recommended_variant),
            "success", "platform_detection", Some("check-circle".into()), true,
        );

        Ok(platform)
    }

    // ── Prerequisite Validation ───────────────────────────────────────────────

    pub async fn validate_prerequisites(&mut self, app: &tauri::AppHandle) -> Result<Vec<PrereqCheck>, String> {
        self.set_phase(InstallPhase::ValidatingPrereqs(SinglePhase {
            sub_phase: "checking_disk_space".into(),
            percent: 0.0,
            detail: "Running pre-installation checks...".into(),
        }), "Validating prerequisites...", 11.0);
        self.emit_detailed_progress(app, "Running pre-installation checks...", None);

        let mut checks = Vec::new();

        // Disk space check
        let available = get_disk_available(&self.base_dir);
        let required = 1_200_000_000; // 1.2 GB
        checks.push(PrereqCheck {
            name: "Disk Space".into(),
            passed: available >= required,
            message: format!("{} available (required: {})", format_size(available), format_size(required)),
            required: true,
            details: None,
        });

        // Network check
        let network_ok = check_network_connectivity().await;
        checks.push(PrereqCheck {
            name: "Network".into(),
            passed: network_ok,
            message: if network_ok { "Online".into() } else { "Offline - check your internet connection".into() },
            required: true,
            details: None,
        });

        // Port check
        let port_available = !self.is_port_in_use().await;
        checks.push(PrereqCheck {
            name: format!("Port {}", self.port),
            passed: port_available,
            message: if port_available { "Available".into() } else { format!("Port {} is in use", self.port) },
            required: false,
            details: None,
        });

        // Existing Python check
        let existing = self.check_python().await.unwrap_or(None);
        checks.push(PrereqCheck {
            name: "Existing Python".into(),
            passed: true,
            message: match &existing {
                Some(v) => format!("Found: {} (will use bundled)", v),
                None => "None detected (will install fresh)".into(),
            },
            required: false,
            details: existing,
        });

        let all_passed = checks.iter().filter(|c| c.required).all(|c| c.passed);

        for check in &checks {
            let level = if check.passed { "success" } else { if check.required { "error" } else { "warn" } };
            self.add_log_categorized(
                &format!("{}: {}", check.name, check.message),
                level, "validation",
                if check.passed { Some("check-circle".into()) } else { Some("alert-circle".into()) },
                check.passed && check.required,
            );
        }

        if all_passed {
            self.add_log_categorized("All critical checks passed", "success", "validation", Some("check-circle".into()), true);
        } else {
            self.add_log_categorized("Some critical checks failed", "error", "validation", Some("alert-circle".into()), false);
        }

        Ok(checks)
    }

    // ── Pause / Resume ────────────────────────────────────────────────────────

    pub async fn pause(&mut self) -> Result<(), String> {
        if !self.status.installing {
            return Err("No installation in progress".into());
        }
        self.paused = true;
        self.status.paused = true;
        let phase = self.phase_to_string();
        let sub = self.get_sub_phase();
        let overall = self.status.overall_percent;
        self.status.phase = InstallPhase::Paused {
            paused_at_phase: phase.clone(),
            sub_phase: sub.clone(),
            overall_percent: overall,
            can_resume: true,
            reason: "User paused".into(),
        };
        self.add_log_categorized("Installation paused by user", "info", "user_action", Some("pause".into()), false);
        Ok(())
    }

    pub async fn resume(&mut self, app: tauri::AppHandle) -> Result<(), String> {
        if !self.paused {
            return Err("Installation is not paused".into());
        }
        self.paused = false;
        self.status.paused = false;
        self.add_log_categorized("Installation resumed by user", "info", "user_action", Some("play".into()), false);
        // Restore phase - the install_full loop will pick up from here
        Ok(())
    }

    async fn try_python_version(exe: &str) -> Option<String> {
        let output = Command::new(exe).arg("--version").output().await.ok()?;
        if output.status.success() {
            let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if v.starts_with("Python 3.") {
                return Some(v);
            }
        }
        None
    }

    pub async fn check_python(&self) -> Result<Option<String>, String> {
        // Try common commands first
        if let Some(v) = Self::try_python_version("python").await {
            return Ok(Some(v));
        }
        if let Some(v) = Self::try_python_version("python3").await {
            return Ok(Some(v));
        }
        if let Some(v) = Self::try_python_version("py").await {
            return Ok(Some(v));
        }

        // Check common Windows Python paths
        let common_paths = [
            "C:\\Python311\\python.exe",
            "C:\\Python310\\python.exe",
            "C:\\Python39\\python.exe",
        ];

        for path in &common_paths {
            if let Some(v) = Self::try_python_version(path).await {
                return Ok(Some(v));
            }
        }

        // Check user-local Python installations
        if let Some(user_dir) = dirs::home_dir() {
            let user_python_paths = [
                user_dir.join("AppData\\Local\\Programs\\Python\\Python311\\python.exe"),
                user_dir.join("AppData\\Local\\Programs\\Python\\Python310\\python.exe"),
                user_dir.join("AppData\\Local\\Programs\\Python\\Python39\\python.exe"),
                user_dir.join("AppData\\Microsoft\\WindowsApps\\python.exe"),
            ];
            for p in &user_python_paths {
                if let Some(v) = Self::try_python_version(p.to_str().unwrap_or("")).await {
                    return Ok(Some(v));
                }
            }
        }

        // Check bundled Python
        let bundled = self.bundled_python();
        if bundled.exists() {
            if let Some(v) = Self::try_python_version(bundled.to_str().unwrap_or("")).await {
                return Ok(Some(v));
            }
        }
        Ok(None)
    }

    async fn check_system_python(&self) -> Option<SystemPythonInfo> {
        let commands = ["python", "python3", "py"];

        for cmd in &commands {
            if let Some(version) = Self::try_python_version(cmd).await {
                // Check if pip is available
                let pip_check = Command::new(cmd)
                    .args(["-m", "pip", "--version"])
                    .output()
                    .await
                    .ok();
                let pip_available = pip_check.map(|o| o.status.success()).unwrap_or(false);

                // Get full path
                let which_output = Command::new("where")
                    .arg(cmd)
                    .output()
                    .await
                    .ok();
                let path = if let Some(o) = which_output {
                    String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or(cmd).to_string()
                } else {
                    cmd.to_string()
                };

                return Some(SystemPythonInfo {
                    path,
                    version,
                    pip_available,
                });
            }
        }

        // Check common Windows paths
        let common_paths = [
            "C:\\Python311\\python.exe",
            "C:\\Python310\\python.exe",
            "C:\\Python39\\python.exe",
        ];

        for path in &common_paths {
            if let Some(v) = Self::try_python_version(path).await {
                let pip_check = Command::new(path)
                    .args(["-m", "pip", "--version"])
                    .output()
                    .await
                    .ok();
                let pip_available = pip_check.map(|o| o.status.success()).unwrap_or(false);

                return Some(SystemPythonInfo {
                    path: path.to_string(),
                    version: v,
                    pip_available,
                });
            }
        }

        // Check user-local paths
        if let Some(user_dir) = dirs::home_dir() {
            let user_python_paths = [
                user_dir.join("AppData\\Local\\Programs\\Python\\Python311\\python.exe"),
                user_dir.join("AppData\\Local\\Programs\\Python\\Python310\\python.exe"),
                user_dir.join("AppData\\Local\\Programs\\Python\\Python39\\python.exe"),
            ];
            for p in &user_python_paths {
                if let Some(v) = Self::try_python_version(p.to_str().unwrap_or("")).await {
                    let pip_check = Command::new(p)
                        .args(["-m", "pip", "--version"])
                        .output()
                        .await
                        .ok();
                    let pip_available = pip_check.map(|o| o.status.success()).unwrap_or(false);

                    return Some(SystemPythonInfo {
                        path: p.to_string_lossy().to_string(),
                        version: v,
                        pip_available,
                    });
                }
            }
        }

        None
    }

    // ── Open WebUI Detection ──────────────────────────────────────────────────

    pub async fn check_open_webui(&self) -> Result<bool, String> {
        let python = self.bundled_python();
        if !python.exists() {
            return Ok(false);
        }
        let output = Command::new(&python)
            .args(["-m", "pip", "list"])
            .output()
            .await
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_lowercase().contains("open-webui"))
    }

    // ── Full Install Pipeline ─────────────────────────────────────────────────

    pub async fn install_full(&mut self, app: tauri::AppHandle) -> Result<(), String> {
        self.install_start = Some(Instant::now());
        self.phase_start = Some(Instant::now());
        self.logs.clear();
        self.raw_logs.clear();
        self.speed_samples.clear();
        self.retry_count = 0;
        self.paused = false;
        self.status.installing = true;
        self.status.paused = false;
        self.status.error = None;

        // Phase 1: Init
        self.set_phase(InstallPhase::Init(SinglePhase {
            sub_phase: "checking_existing".into(),
            percent: 0.0,
            detail: "Checking for previous installation...".into(),
        }), "Initializing...", 0.0);
        self.emit_detailed_progress(&app, "Initializing installation...", None);

        if self.bundled_python().exists() {
            self.add_log_categorized("Previous installation detected", "info", "validation", Some("info".into()), false);
        } else {
            self.add_log_categorized("Fresh installation", "info", "validation", None, false);
        }

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Phase 2: Detect Platform
        let platform = self.detect_platform(&app).await.unwrap_or_else(|_| self.detect_platform_sync());

        // Phase 3: Validate Prereqs
        let _checks = self.validate_prerequisites(&app).await.unwrap_or_default();

        // Phase 4: Check Python
        self.set_phase(InstallPhase::CheckingPython(SinglePhase {
            sub_phase: "detecting".into(),
            percent: 0.0,
            detail: "Checking for Python installation...".into(),
        }), "Checking Python installation...", 14.0);
        self.emit_detailed_progress(&app, "Checking Python installation...", None);
        tokio::time::sleep(Duration::from_millis(200)).await;

        // Run all phases, catching any error
        let result = async {
            self.download_python_portable(&app).await?;
            self.extract_python_portable(&app).await?;
            self.configure_python(&app).await?;
            self.download_get_pip(&app).await?;
            self.install_pip(&app).await?;
            self.install_open_webui_package(&app).await?;
            self.verify_installation(&app).await?;
            Ok::<(), String>(())
        }.await;

        match result {
            Ok(()) => {
                self.status.installed = true;
                self.status.installing = false;
                self.status.overall_percent = 100.0;
                self.status.elapsed_secs = self.elapsed();
                self.status.phase = InstallPhase::Running;
                self.add_log_categorized("Installation complete!", "success", "system", Some("check-circle".into()), true);
                self.emit_detailed_progress(&app, "Installation complete!", None);
                Ok(())
            }
            Err(e) => {
                let err_msg = e.to_string();
                self.status.installing = false;
                self.status.error = Some(err_msg.clone());
                let recoverable = !err_msg.contains("Insufficient") && !err_msg.contains("Permission denied");
                self.status.phase = InstallPhase::Error {
                    message: err_msg.clone(),
                    phase: self.phase_to_string(),
                    recoverable,
                    retry_count: self.retry_count,
                    max_retries: self.max_retries,
                    suggested_action: "Check logs for details".into(),
                    error_code: "INSTALL_FAILED".into(),
                };
                self.add_log_categorized(&format!("Installation failed: {err_msg}"), "error", "system", Some("alert-circle".into()), false);
                self.emit_detailed_progress(&app, &format!("Error: {err_msg}"), None);
                Err(err_msg)
            }
        }
    }

    // ── Sub-phase: Download Python ────────────────────────────────────────────

    async fn download_python_portable(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        // Determine URL based on selected version or default
        let (url, total_size) = if let Some(ref u) = self.selected_version_url.clone() {
            (u.clone(), 12_000_000) // approximate
        } else {
            let platform = self.detect_platform_sync();
            let fallback = self.get_fallback_versions(&platform);
            let ver = fallback.first()
                .and_then(|v| v.distributions.first())
                .map(|d| (d.url.clone(), d.size_bytes))
                .unwrap_or_else(|| ("https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip".into(), 11_426_325));
            ver
        };

        self.set_phase(InstallPhase::DownloadingPython(DownloadInfo {
            sub_phase: "resolving".into(),
            percent: 0.0,
            bytes_downloaded: 0,
            total_bytes: total_size,
            speed_bps: 0.0,
            eta_secs: 0.0,
        }), "Resolving download URL...", 15.0);
        self.emit_detailed_progress(app, "Resolving download URL...", Some(format!("URL: {}", url)));

        let python_dir = self.base_dir.join("python");
        std::fs::create_dir_all(&python_dir).map_err(|e| e.to_string())?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?;

        // Sub-phase: connecting
        self.status.phase = InstallPhase::DownloadingPython(DownloadInfo {
            sub_phase: "connecting".into(),
            percent: 0.0,
            bytes_downloaded: 0,
            total_bytes: total_size,
            speed_bps: 0.0,
            eta_secs: 0.0,
        });
        self.emit_detailed_progress(app, "Connecting to server...", None);

        let zip_path = self.base_dir.join("python_embed.zip");

        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to download Python: {e}"))?;

        let total = resp.content_length().unwrap_or(total_size);
        let mut stream = resp.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
        let start = Instant::now();
        let mut last_emit = Instant::now();

        use futures::StreamExt;
        use std::io::Write;

        // Sub-phase: downloading
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download error: {e}"))?;
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;

            if last_emit.elapsed() >= Duration::from_millis(500) {
                let elapsed = start.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 { downloaded as f64 / elapsed } else { 0.0 };
                let percent = (downloaded as f64 / total as f64 * 100.0).min(100.0);
                let eta = if speed > 0.0 { (total - downloaded) as f64 / speed } else { 0.0 };

                self.speed_samples.push((self.elapsed(), downloaded));

                let msg = format!("Downloading Python: {:.1}% ({:.1} MB / {:.1} MB) - {:.0} KB/s - ETA: {:.0}s",
                    percent, downloaded as f64 / 1_048_576.0, total as f64 / 1_048_576.0, speed / 1024.0, eta);

                self.status.phase = InstallPhase::DownloadingPython(DownloadInfo {
                    sub_phase: "downloading".into(), percent, bytes_downloaded: downloaded, total_bytes: total, speed_bps: speed, eta_secs: eta,
                });

                self.emit_detailed_progress(app, &msg, None);
                last_emit = Instant::now();
            }
        }

        // Sub-phase: verifying
        self.status.phase = InstallPhase::DownloadingPython(DownloadInfo {
            sub_phase: "verifying".into(),
            percent: 100.0,
            bytes_downloaded: downloaded,
            total_bytes: total,
            speed_bps: 0.0,
            eta_secs: 0.0,
        });
        self.emit_detailed_progress(app, format!("Verifying downloaded file ({} bytes)...", downloaded).as_str(), None);

        self.add_log_categorized(&format!("Python downloaded: {:.1} MB", downloaded as f64 / 1_048_576.0), "success", "network", Some("check-circle".into()), true);
        self.add_log_categorized("File verified successfully", "info", "network", None, false);
        Ok(())
    }

    // ── Sub-phase: Extract Python ─────────────────────────────────────────────

    async fn extract_python_portable(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        self.set_phase(InstallPhase::ExtractingPython(ExtractInfo {
            sub_phase: "reading_archive".into(),
            percent: 0.0,
            files_extracted: 0,
            total_files: 0,
            current_file: "".into(),
        }), "Extracting Python...", 35.0);
        self.emit_detailed_progress(app, "Preparing to extract Python archive...", None);

        let python_dir = self.base_dir.join("python");
        let zip_path = self.base_dir.join("python_embed.zip");

        let zip_file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| format!("Bad zip: {e}"))?;
        let total_files = archive.len();

        self.add_log_categorized(&format!("Archive contains {} files", total_files), "info", "filesystem", None, false);

        let mut extracted = 0;
        for i in 0..total_files {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = python_dir.join(entry.mangled_name());
            let current_file = entry.mangled_name().to_string_lossy().to_string();
            if entry.is_dir() {
                std::fs::create_dir_all(&outpath).ok();
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p).ok();
                }
                let mut f = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
            }
            extracted += 1;

            if extracted % 20 == 0 || extracted == total_files {
                let percent = (extracted as f64 / total_files as f64 * 100.0).min(100.0);

                self.status.phase = InstallPhase::ExtractingPython(ExtractInfo {
                    sub_phase: "extracting".into(),
                    percent,
                    files_extracted: extracted,
                    total_files,
                    current_file: current_file.clone(),
                });

                self.emit_detailed_progress(app, &format!("Extracting: {extracted}/{total_files} files ({percent:.0}%) - {current_file}"), None);
            }
        }

        self.status.phase = InstallPhase::ExtractingPython(ExtractInfo {
            sub_phase: "setting_permissions".into(),
            percent: 100.0,
            files_extracted: total_files,
            total_files,
            current_file: "".into(),
        });
        self.emit_detailed_progress(app, "Setting file permissions...", None);

        std::fs::remove_file(&zip_path).ok();
        self.add_log_categorized(&format!("Python extracted: {total_files} files"), "success", "filesystem", Some("check-circle".into()), true);
        Ok(())
    }

    // ── Sub-phase: Configure Python ───────────────────────────────────────────

    async fn configure_python(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        self.set_phase(InstallPhase::ConfiguringPython(SinglePhase {
            sub_phase: "enabling_site_packages".into(),
            percent: 0.0,
            detail: "Enabling site-packages...".into(),
        }), "Configuring Python...", 42.0);
        self.emit_detailed_progress(app, "Enabling site-packages in python311._pth...", None);

        let pth = self.base_dir.join("python").join("python311._pth");
        if pth.exists() {
            let c = std::fs::read_to_string(&pth).map_err(|e| e.to_string())?;
            std::fs::write(&pth, c.replace("#import site", "import site")).map_err(|e| e.to_string())?;
        }

        self.status.phase = InstallPhase::ConfiguringPython(SinglePhase {
            sub_phase: "creating_pip_ini".into(),
            percent: 50.0,
            detail: "Creating pip.ini...".into(),
        });
        self.emit_detailed_progress(app, "Creating pip.ini (forcing pypi.org)...", None);

        let lib_dir = self.base_dir.join("python").join("Lib");
        std::fs::create_dir_all(&lib_dir).map_err(|e| e.to_string())?;
        let site_pkg = lib_dir.join("site-packages");
        std::fs::create_dir_all(&site_pkg).map_err(|e| e.to_string())?;
        let pip_conf = self.base_dir.join("python").join("pip.ini");
        std::fs::write(&pip_conf, "[global]\nindex-url = https://pypi.org/simple/\ntimeout = 60\nretries = 5\n").map_err(|e| e.to_string())?;

        self.status.phase = InstallPhase::ConfiguringPython(SinglePhase {
            sub_phase: "testing_interpreter".into(),
            percent: 100.0,
            detail: "Testing Python interpreter...".into(),
        });
        self.emit_detailed_progress(app, "Testing Python interpreter...", None);

        let test_out = Command::new(self.bundled_python())
            .args(["--version"])
            .output()
            .await;

        if let Ok(out) = test_out {
            if out.status.success() {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                self.add_log_categorized(&format!("Python {version} is ready"), "success", "configuration", Some("check-circle".into()), true);
                self.emit_detailed_progress(app, &format!("Python {version} is ready"), None);
            } else {
                self.add_log_categorized("Python interpreter test failed", "warn", "configuration", Some("alert-triangle".into()), false);
            }
        } else {
            self.add_log_categorized("Could not test Python interpreter", "warn", "configuration", None, false);
        }

        self.add_log_categorized("Python configured (site-packages enabled, pip.ini created)", "success", "configuration", Some("check-circle".into()), true);
        Ok(())
    }

    // ── Sub-phase: Download get-pip.py ────────────────────────────────────────

    async fn download_get_pip(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        self.set_phase(InstallPhase::DownloadingGetPip(DownloadInfo {
            sub_phase: "connecting".into(),
            percent: 0.0,
            bytes_downloaded: 0,
            total_bytes: 2_500_000,
            speed_bps: 0.0,
            eta_secs: 0.0,
        }), "Downloading get-pip.py...", 48.0);
        self.emit_detailed_progress(app, "Connecting to bootstrap.pypa.io...", Some(GET_PIP_URL.to_string()));

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client.get(GET_PIP_URL).send().await
            .map_err(|e| format!("Failed to download get-pip.py: {e}"))?;

        let total = resp.content_length().unwrap_or(2_500_000);
        let mut stream = resp.bytes_stream();
        let mut downloaded: u64 = 0;
        let get_pip = self.base_dir.join("get-pip.py");
        let mut file = std::fs::File::create(&get_pip).map_err(|e| e.to_string())?;
        let start = Instant::now();
        let mut last_emit = Instant::now();

        use futures::StreamExt;
        use std::io::Write;

        self.status.phase = InstallPhase::DownloadingGetPip(DownloadInfo {
            sub_phase: "downloading".into(),
            percent: 0.0,
            bytes_downloaded: 0,
            total_bytes: total,
            speed_bps: 0.0,
            eta_secs: 0.0,
        });

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download error: {e}"))?;
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;

            if last_emit.elapsed() >= Duration::from_millis(500) {
                let elapsed = start.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 { downloaded as f64 / elapsed } else { 0.0 };
                let percent = (downloaded as f64 / total as f64 * 100.0).min(100.0);
                let eta = if speed > 0.0 { (total - downloaded) as f64 / speed } else { 0.0 };

                self.speed_samples.push((self.elapsed(), downloaded));

                self.status.phase = InstallPhase::DownloadingGetPip(DownloadInfo {
                    sub_phase: "downloading".into(),
                    percent, bytes_downloaded: downloaded, total_bytes: total, speed_bps: speed, eta_secs: eta,
                });

                self.emit_detailed_progress(app, &format!("Downloading get-pip.py: {:.1} KB ({:.0}%) - ETA: {:.0}s", downloaded as f64 / 1024.0, percent, eta), None);
                last_emit = Instant::now();
            }
        }

        self.add_log_categorized(&format!("get-pip.py downloaded: {:.1} KB", downloaded as f64 / 1024.0), "success", "network", Some("check-circle".into()), true);
        Ok(())
    }

    // ── Sub-phase: Install pip ────────────────────────────────────────────────

    async fn install_pip(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        self.set_phase(InstallPhase::InstallingPip(InstallInfo {
            sub_phase: "bootstrap".into(),
            percent: 0.0,
            packages_installed: 0,
            total_packages: 0,
            detail: "Running get-pip.py...".into(),
        }), "Installing pip...", 52.0);
        self.emit_detailed_progress(app, "Bootstrapping pip via get-pip.py...", Some("Running with --no-cache-dir --index-url https://pypi.org/simple/".into()));

        let get_pip = self.base_dir.join("get-pip.py");
        let out = Command::new(self.bundled_python())
            .args([get_pip.to_str().unwrap(), "--no-cache-dir", "--index-url", "https://pypi.org/simple/"])
            .output()
            .await
            .map_err(|e| e.to_string())?;
        std::fs::remove_file(&get_pip).ok();

        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            self.add_log_categorized(&format!("pip install failed: {stderr}"), "error", "process", Some("alert-circle".into()), false);
            self.set_error(&format!("pip install failed: {stderr}"), true, "PIP_FAILED", "Check your network connection and try again");
            return Err(stderr);
        }

        // Sub-phase: verifying
        self.status.phase = InstallPhase::InstallingPip(InstallInfo {
            sub_phase: "verifying".into(),
            percent: 50.0,
            packages_installed: 0,
            total_packages: 0,
            detail: "Verifying pip...".into(),
        });
        self.emit_detailed_progress(app, "Verifying pip installation...", None);

        let verify = Command::new(self.bundled_python())
            .args(["-m", "pip", "--version"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if verify.status.success() {
            let version = String::from_utf8_lossy(&verify.stdout).trim().to_string();
            self.add_log_categorized(&format!("pip verified: {version}"), "success", "process", Some("check-circle".into()), false);
            self.emit_detailed_progress(app, &format!("pip verified: {version}"), None);
        } else {
            self.add_log_categorized("pip verification failed", "warn", "process", Some("alert-triangle".into()), false);
        }

        // Sub-phase: upgrading
        self.status.phase = InstallPhase::InstallingPip(InstallInfo {
            sub_phase: "upgrading".into(),
            percent: 100.0,
            packages_installed: 0,
            total_packages: 0,
            detail: "Upgrading pip...".into(),
        });
        self.emit_detailed_progress(app, "Upgrading pip to latest version...", Some("--no-cache-dir --index-url https://pypi.org/simple/".into()));

        let upgrade_out = Command::new(self.bundled_python())
            .args(["-m", "pip", "install", "--upgrade", "pip", "--no-cache-dir", "--index-url", "https://pypi.org/simple/"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !upgrade_out.status.success() {
            let stderr = String::from_utf8_lossy(&upgrade_out.stderr).to_string();
            self.add_log_categorized(&format!("pip upgrade (non-fatal): {stderr}"), "warn", "process", Some("alert-triangle".into()), false);
        } else {
            self.add_log_categorized("pip upgraded successfully", "success", "process", Some("check-circle".into()), true);
        }

        Ok(())
    }

    // ── Sub-phase: Install Open WebUI ─────────────────────────────────────────

    async fn install_open_webui_package(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        self.set_phase(InstallPhase::InstallingOpenWebUI(InstallInfo {
            sub_phase: "resolving".into(),
            percent: 0.0,
            packages_installed: 0,
            total_packages: 0,
            detail: "Resolving dependencies...".into(),
        }), "Installing Open WebUI...", 58.0);
        self.emit_detailed_progress(app, "Resolving Open WebUI dependencies...", Some("python -m pip install open-webui".into()));

        let python = self.bundled_python();
        let mut child = Command::new(&python)
            .args(["-m", "pip", "install", "open-webui", "--no-cache-dir", "--index-url", "https://pypi.org/simple/"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start pip: {e}"))?;

        let stderr = child.stderr.take().unwrap();
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut total_packages = 0;
        let mut installed_packages = 0;
        let start = Instant::now();

        while let Ok(Some(line)) = lines.next_line().await {
            self.add_log(&line);

            if line.contains("Collecting open-webui") || line.starts_with("Collecting ") {
                total_packages += 1;
            }
            if line.contains("Installing collected packages:") {
                let after = line.split("Installing collected packages:").nth(1).unwrap_or("");
                total_packages = after.matches(',').count() + 1;
                self.status.phase = InstallPhase::InstallingOpenWebUI(InstallInfo {
                    sub_phase: "downloading".into(),
                    percent: 30.0,
                    packages_installed: installed_packages,
                    total_packages,
                    detail: format!("Downloading {total_packages} packages..."),
                });
                self.emit_detailed_progress(app, &format!("Downloading {total_packages} packages..."), None);
            }
            if line.starts_with("  Downloading ") || line.starts_with("Downloading ") {
                let elapsed = start.elapsed().as_secs_f64();
                if elapsed > 0.0 {
                    self.status.phase = InstallPhase::InstallingOpenWebUI(InstallInfo {
                        sub_phase: "downloading".into(),
                        percent: 30.0,
                        packages_installed: installed_packages,
                        total_packages,
                        detail: "Downloading packages...".into(),
                    });
                }
            }
            if line.starts_with("  Building wheel ") || line.contains("Building wheel for") {
                self.status.phase = InstallPhase::InstallingOpenWebUI(InstallInfo {
                    sub_phase: "building".into(),
                    percent: 50.0,
                    packages_installed: installed_packages,
                    total_packages,
                    detail: "Building wheels...".into(),
                });
                self.emit_detailed_progress(app, "Building wheel for package...", None);
            }
            if line.starts_with("  Installed ") || line.contains("Successfully installed") {
                installed_packages += 1;
                let percent = if total_packages > 0 {
                    (installed_packages as f64 / total_packages as f64 * 100.0).min(100.0)
                } else { 50.0 };

                self.status.phase = InstallPhase::InstallingOpenWebUI(InstallInfo {
                    sub_phase: "installing".into(),
                    percent,
                    packages_installed: installed_packages,
                    total_packages,
                    detail: format!("Installed {installed_packages}/{total_packages} packages"),
                });

                self.emit_detailed_progress(app, &format!("Installed {installed_packages}/{total_packages} packages"), None);
            }
            if line.contains("ERROR") || line.contains("error") {
                self.add_log_categorized(&line, "error", "process", Some("alert-circle".into()), false);
            }
            if line.contains("Successfully installed") {
                self.add_log_categorized(&line, "success", "process", Some("check-circle".into()), false);
            }
        }

        let status = child.wait().await.map_err(|e| e.to_string())?;

        self.status.phase = InstallPhase::InstallingOpenWebUI(InstallInfo {
            sub_phase: "verifying".into(),
            percent: 100.0,
            packages_installed: installed_packages,
            total_packages,
            detail: "Verifying installation...".into(),
        });
        self.emit_detailed_progress(app, "Verifying Open WebUI installation...", None);

        if !status.success() {
            self.add_log_categorized("Open WebUI installation failed", "error", "process", Some("alert-circle".into()), false);
            return Err("Open WebUI installation failed. Check logs for details.".into());
        }

        self.add_log_categorized(&format!("Open WebUI installed successfully ({installed_packages} packages)"), "success", "process", Some("check-circle".into()), true);
        Ok(())
    }

    // ── Verify Installation ───────────────────────────────────────────────────

    async fn verify_installation(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        self.set_phase(InstallPhase::Verifying(SinglePhase {
            sub_phase: "checking_python".into(),
            percent: 0.0,
            detail: "Running post-installation verification...".into(),
        }), "Verifying installation...", 88.0);
        self.emit_detailed_progress(app, "Running post-installation verification...", None);

        // Check Python
        let python_ok = Command::new(self.bundled_python())
            .args(["--version"]).output().await
            .map(|o| o.status.success()).unwrap_or(false);
        self.add_log_categorized(
            if python_ok { "Python: OK" } else { "Python: FAILED" },
            if python_ok { "success" } else { "error" },
            "validation", Some("check-circle".into()), python_ok,
        );

        // Check pip
        let pip_ok = Command::new(self.bundled_python())
            .args(["-m", "pip", "--version"]).output().await
            .map(|o| o.status.success()).unwrap_or(false);
        self.add_log_categorized(
            if pip_ok { "pip: OK" } else { "pip: FAILED" },
            if pip_ok { "success" } else { "error" },
            "validation", Some("check-circle".into()), pip_ok,
        );

        // Check Open WebUI
        let owui_ok = Command::new(self.bundled_python())
            .args(["-m", "pip", "list"]).output().await
            .map(|o| {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.to_lowercase().contains("open-webui")
            }).unwrap_or(false);
        self.add_log_categorized(
            if owui_ok { "Open WebUI: OK" } else { "Open WebUI: FAILED" },
            if owui_ok { "success" } else { "error" },
            "validation", Some("check-circle".into()), owui_ok,
        );

        if python_ok && pip_ok && owui_ok {
            self.add_log_categorized("All verification checks passed", "success", "validation", Some("check-circle".into()), true);
        } else {
            let failed = !python_ok || !pip_ok || !owui_ok;
            if failed {
                self.add_log_categorized("Some verification checks failed", "error", "validation", Some("alert-circle".into()), false);
            }
        }

        Ok(())
    }

    // ── Start ─────────────────────────────────────────────────────────────────

    pub async fn start(&mut self, app: tauri::AppHandle) -> Result<String, String> {
        if self.status.running { return Ok(self.status.url.clone()); }
        if self.is_port_in_use().await { return Err(format!("Port {} is already in use", self.port)); }
        let python = self.bundled_python();
        if !python.exists() {
            return Err(format!(
                "Python not found at '{}'. Please reinstall from LLM Settings.",
                python.display()
            ));
        }
        let data_dir = self.base_dir.join("open-webui-data");
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
        self.phase_start = Some(Instant::now());

        self.status.phase = InstallPhase::Starting(SinglePhase {
            sub_phase: "launching".into(), percent: 0.0,
            detail: "Launching Open WebUI process...".into(),
        });
        self.status.installing = true;
        self.emit_detailed_progress(&app, "Launching Open WebUI server process...", None);

        let child = Command::new(&python)
            .args(["-m", "open_webui", "serve"])
            .env("PORT", self.port.to_string())
            .env("HOST", "127.0.0.1")
            .env("WEBUI_AUTH", "false")
            .env("DATA_DIR", data_dir.to_str().unwrap())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to start Open WebUI: {e}"))?;

        self.process = Some(child);
        self.status.pid = self.process.as_ref().and_then(|p| p.id());
        self.status.url = format!("http://127.0.0.1:{}", self.port);
        self.add_log("Open WebUI process started");

        // Sub-phase: waiting_port
        self.status.phase = InstallPhase::Starting(SinglePhase {
            sub_phase: "waiting_port".into(),
            percent: 30.0,
            detail: "Waiting for server to bind to port...".into(),
        });
        self.emit_detailed_progress(&app, "Waiting for server to bind to port...", None);

        self.add_log("Waiting for Open WebUI to be ready...");

        // Sub-phase: health_check
        self.status.phase = InstallPhase::Starting(SinglePhase {
            sub_phase: "health_check".into(),
            percent: 60.0,
            detail: "Performing health check...".into(),
        });
        self.emit_detailed_progress(&app, "Performing health check...", None);

        self.wait_for_ready().await?;

        self.status.phase = InstallPhase::Starting(SinglePhase {
            sub_phase: "ready".into(),
            percent: 100.0,
            detail: "Server is ready!".into(),
        });
        self.status.running = true;
        self.status.installing = false;
        self.status.overall_percent = 100.0;
        self.add_log_level("Open WebUI is ready!", "success");
        self.emit_detailed_progress(&app, "Open WebUI is ready and running!", None);

        let _ = app.emit("open_webui_started", self.status.url.clone());

        Ok(self.status.url.clone())
    }

    // ── Stop ──────────────────────────────────────────────────────────────────

    pub async fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            let _ = child.kill().await;
        }
        self.status.running = false;
        self.status.pid = None;
        self.status.phase = InstallPhase::Idle;
        self.add_log_level("Open WebUI stopped", "info");

        #[cfg(target_os = "windows")]
        {
            self.force_kill_port().await;
        }

        Ok(())
    }

    // ── Settings Helpers ────────────────────────────────────────────────────────

    pub fn get_status(&self) -> OpenWebUIStatus {
        let mut s = self.status.clone();
        s.installed = self.bundled_python().exists();
        s
    }

    pub fn get_logs(&self) -> Vec<String> {
        self.raw_logs.clone()
    }

    pub fn get_disk_usage(&self) -> OpenWebUIDiskInfo {
        let python_dir = self.base_dir.join("python");
        let data_dir = self.base_dir.join("open-webui-data");
        OpenWebUIDiskInfo {
            python_size: dir_size(&python_dir),
            data_size: dir_size(&data_dir),
            total_size: dir_size(&python_dir) + dir_size(&data_dir),
        }
    }

    pub async fn uninstall(&mut self, app: tauri::AppHandle) -> Result<(), String> {
        if self.status.running { self.stop().await?; }
        let python_dir = self.base_dir.join("python");
        let data_dir = self.base_dir.join("open-webui-data");
        if python_dir.exists() { std::fs::remove_dir_all(&python_dir).map_err(|e| e.to_string())?; }
        if data_dir.exists() { std::fs::remove_dir_all(&data_dir).map_err(|e| e.to_string())?; }
        self.status = OpenWebUIStatus::default();
        self.add_log_categorized("Uninstalled Open WebUI and removed all data", "success", "system", Some("check-circle".into()), true);
        let _ = app.emit("open_webui_uninstalled", ());
        Ok(())
    }

    pub async fn check_python_status(&self) -> PythonStatusInfo {
        let python_dir = self.base_dir.join("python");
        let python_exe = python_dir.join("python.exe");
        let pip_installed = python_dir.join("Lib").join("site-packages").join("pip").exists();
        let open_webui_installed = python_dir.join("Lib").join("site-packages").join("open_webui").exists();
        PythonStatusInfo {
            python_dir: python_dir.to_string_lossy().to_string(),
            python_exists: python_exe.exists(),
            pip_installed,
            open_webui_installed,
            version: if python_exe.exists() { Some("3.11.9".into()) } else { None },
            system_python: self.check_system_python().await,
        }
    }

    async fn wait_for_ready(&mut self) -> Result<(), String> {
        let url = format!("http://127.0.0.1:{}/healthz", self.port);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5)).build().map_err(|e| e.to_string())?;
        for i in 0..60 {
            tokio::time::sleep(Duration::from_secs(1)).await;
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() { return Ok(()); }
            }
            if i % 5 == 0 && i > 0 {
                self.add_log(&format!("Waiting for server... ({i}s elapsed)"));
            }
        }
        Err("Open WebUI failed to start within 60 seconds".into())
    }

    // ── Port Management ───────────────────────────────────────────────────────

    async fn is_port_in_use(&self) -> bool {
        #[cfg(target_os = "windows")]
        {
            let out = Command::new("netstat").args(["-ano"]).output().await;
            if let Ok(o) = out {
                let stdout = String::from_utf8_lossy(&o.stdout);
                return stdout.lines().any(|l| l.contains(&format!(":{}", self.port)));
            }
        }
        false
    }

    #[cfg(target_os = "windows")]
    async fn force_kill_port(&self) {
        let Ok(output) = Command::new("netstat").args(["-ano"]).output().await else { return; };
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            if !trimmed.contains(&format!(":{}", self.port)) { continue; }
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() < 5 { continue; }
            let pid_str = parts[parts.len() - 1];
            if let Ok(pid) = pid_str.parse::<u32>() {
                if pid == std::process::id() { continue; }
                let _ = Command::new("taskkill").args(["/F", "/PID", &pid.to_string()]).output().await;
            }
        }
    }
}

// ── GitHub API Types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    published_at: String,
    prerelease: bool,
    draft: bool,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    size: u64,
    browser_download_url: String,
}

// ── Helper Functions ──────────────────────────────────────────────────────────

fn format_size(bytes: u64) -> String {
    if bytes == 0 { return "0 B".into(); }
    let k = 1024u64;
    let sizes = ["B", "KB", "MB", "GB"];
    let i = (bytes as f64).ln() / (k as f64).ln();
    let i = (i.floor() as usize).min(sizes.len() - 1);
    let divisor = k.pow(i as u32);
    format!("{:.1} {}", bytes as f64 / divisor as f64, sizes[i])
}

fn dir_size(path: &std::path::Path) -> u64 {
    if !path.exists() { return 0; }
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() { total += dir_size(&p); }
            else if let Ok(meta) = std::fs::metadata(&p) { total += meta.len(); }
        }
    }
    total
}

fn get_disk_available(path: &std::path::Path) -> u64 {
    #[cfg(target_os = "windows")]
    {
        let path_str = path.to_string_lossy();
        let drive = path_str.chars().take(2).collect::<String>();
        let output = std::process::Command::new("wmic")
            .args(["logicaldisk", &format!("where DeviceID='{}:'", drive), "get", "FreeSpace", "/value"])
            .output();
        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            for line in stdout.lines() {
                if let Some(val) = line.strip_prefix("FreeSpace=") {
                    if let Ok(bytes) = val.trim().parse::<u64>() { return bytes; }
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("df").arg("--output=avail").arg(path).output();
        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            if let Some(line) = stdout.lines().nth(1) {
                if let Ok(kb) = line.trim().parse::<u64>() { return kb * 1024; }
            }
        }
    }
    50_000_000_000 // 50 GB fallback
}

async fn check_network_connectivity() -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5)).build().unwrap_or_default();
    client.get("https://www.google.com").send().await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

fn get_windows_version() -> String {
    let output = std::process::Command::new("cmd")
        .args(["/C", "ver"]).output();
    if let Ok(o) = output {
        let stdout = String::from_utf8_lossy(&o.stdout);
        if let Some(v) = stdout.lines().last() {
            let v = v.trim().trim_start_matches('[').trim_end_matches(']').trim();
            return v.to_string();
        }
    }
    "Windows".to_string()
}

fn get_linux_version() -> String {
    if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
        for line in content.lines() {
            if let Some(val) = line.strip_prefix("PRETTY_NAME=") {
                return val.trim_matches('"').to_string();
            }
        }
    }
    "Linux".to_string()
}

fn get_macos_version() -> String {
    let output = std::process::Command::new("sw_vers")
        .args(["-productVersion"]).output();
    if let Ok(o) = output {
        let stdout = String::from_utf8_lossy(&o.stdout);
        return stdout.trim().to_string();
    }
    "macOS".to_string()
}
