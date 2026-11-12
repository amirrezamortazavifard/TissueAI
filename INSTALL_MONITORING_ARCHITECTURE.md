# TissueAI - Installation Monitoring Architecture (v2)

## Table of Contents
1. [State Machine](#1-state-machine)
2. [Real-time Metrics](#2-real-time-metrics)
3. [Human-readable Logs](#3-human-readable-logs)
4. [Event Payload Structure](#4-event-payload-structure)
5. [Edge Cases & Degradation](#5-edge-cases--degradation)
6. [UI/UX Mapping](#6-uiux-mapping)

---

## 1. State Machine

### 1.1 Main Phases Flow

```
INIT
  → DISCOVER_VERSIONS (GitHub API: python/cpython releases + python.org releases)
  → VERSION_SELECT (User chooses version)
  → DETECT_PLATFORM (OS/Arch/Distribution matching)
  → VALIDATE_PREREQS (Disk, Network, Permissions, Port)
  → DOWNLOAD_PYTHON (Platform-specific: embeddable ZIP / tar.xz / brew)
  → EXTRACT_PYTHON
  → CONFIGURE_PYTHON (site-packages, pip.ini, env vars, interpreter test)
  → DOWNLOAD_GET_PIP
  → INSTALL_PIP (bootstrap → verify → upgrade)
  → INSTALL_OPEN_WEBUI (pip install open-webui)
  → VERIFY_INSTALLATION (python, pip, open-webui checks)
  → START_SERVER (launch → port binding → health check)
  → RUNNING

Each phase can transition to:
  → ERROR → RETRY (with backoff, max 3 retries)
  → PAUSED → RESUME (only during download phases)
  → DEGRADED (network issues, resource constraints)
```

### 1.2 Phase Enum (Rust Backend)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InstallPhase {
    // ── Idle / Terminal States ──
    Idle,
    Running { port: u16, url: String, pid: Option<u32>, uptime_secs: f64 },

    // ── Phase 1: Initialization ──
    Init {
        sub_phase: InitSubPhase,
        percent: f64,
        detail: String,
    },

    // ── Phase 2: Version Discovery ──
    DiscoveringVersions {
        sub_phase: DiscoverySubPhase,
        percent: f64,
        platform: PlatformType,
        source: String,
    },

    // ── Phase 3: Version Selection (Waiting for User) ──
    VersionSelect {
        available_versions: Vec<PythonVersion>,
        recommended: String,
        reason: String,
    },

    // ── Phase 4: Platform Detection ──
    DetectingPlatform {
        sub_phase: PlatformSubPhase,
        percent: f64,
        os: String,
        arch: String,
        compatible_distributions: Vec<PythonDistribution>,
    },

    // ── Phase 5: Prerequisite Validation ──
    ValidatingPrereqs {
        sub_phase: ValidationSubPhase,
        percent: f64,
        checks: Vec<PrereqCheck>,
    },

    // ── Phase 6: Download Python ──
    DownloadingPython {
        sub_phase: DownloadSubPhase,
        percent: f64,
        resource_type: ResourceType,
        bytes_downloaded: u64,
        total_bytes: u64,
        speed_bps: f64,
        eta_secs: f64,
        url: String,
        checksum_verified: bool,
    },

    // ── Phase 7: Extract Python ──
    ExtractingPython {
        sub_phase: ExtractionSubPhase,
        percent: f64,
        files_extracted: usize,
        total_files: usize,
        current_file: String,
    },

    // ── Phase 8: Configure Python ──
    ConfiguringPython {
        sub_phase: ConfigSubPhase,
        percent: f64,
        actions_completed: Vec<String>,
        current_action: String,
    },

    // ── Phase 9: Download get-pip.py ──
    DownloadingGetPip {
        sub_phase: DownloadSubPhase,
        percent: f64,
        bytes_downloaded: u64,
        total_bytes: u64,
        speed_bps: f64,
        eta_secs: f64,
    },

    // ── Phase 10: Install pip ──
    InstallingPip {
        sub_phase: PipSubPhase,
        percent: f64,
        version: Option<String>,
        detail: String,
    },

    // ── Phase 11: Install Open WebUI ──
    InstallingOpenWebUI {
        sub_phase: OpenWebUISubPhase,
        percent: f64,
        packages_installed: usize,
        total_packages: usize,
        current_package: String,
        download_speed: f64,
    },

    // ── Phase 12: Verify ──
    Verifying {
        sub_phase: VerifySubPhase,
        percent: f64,
        checks: Vec<VerificationCheck>,
    },

    // ── Phase 13: Server Start ──
    StartingServer {
        sub_phase: ServerStartSubPhase,
        percent: f64,
        port: u16,
        detail: String,
    },

    // ── Error / Pause ──
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
```

### 1.3 Sub-phase Enums

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InitSubPhase {
    CheckingExistingInstall,
    LoadingConfig,
    CheckingNetwork,
    DetectingPlatform,
    Ready,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DiscoverySubPhase {
    FetchingFromGitHub,
    CheckingLocalCache,
    ScanningSystemPaths,
    ComparingVersions,
    BuildingVersionList,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlatformSubPhase {
    DetectingOS,
    DetectingArchitecture,
    CheckingCompatibility,
    SelectingDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationSubPhase {
    CheckingDiskSpace,
    CheckingPermissions,
    CheckingNetworkConnectivity,
    CheckingPortAvailability,
    CheckingExistingPython,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DownloadSubPhase {
    ResolvingURL,
    Connecting,
    Downloading,
    Pausing,
    Resuming,
    VerifyingChecksum,
    RetryAttempt,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExtractionSubPhase {
    ReadingArchive,
    ExtractingFiles,
    SettingPermissions,
    CleanupTemp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConfigSubPhase {
    EnablingSitePackages,
    CreatingDirectories,
    CreatingPipIni,
    SettingEnvironmentVars,
    TestingInterpreter,
    ConfiguringPaths,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PipSubPhase {
    Bootstrap,
    Verifying,
    Upgrading,
    TestingConnection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OpenWebUISubPhase {
    ResolvingDependencies,
    DownloadingPackages,
    BuildingWheels,
    InstallingPackages,
    PostInstallSetup,
    Verifying,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VerifySubPhase {
    CheckingPython,
    CheckingPip,
    CheckingOpenWebUI,
    TestingServerStart,
    HealthCheck,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ServerStartSubPhase {
    Launching,
    WaitingForPort,
    HealthCheck,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResourceType {
    PythonZip,
    GetPip,
    OpenWebUI,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlatformType {
    Windows,
    Linux,
    MacOS,
    Unknown,
}
```

### 1.4 Data Structures for Version Discovery

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonVersion {
    pub version: String,
    pub release_date: String,
    pub is_latest: bool,
    pub is_security_fix: bool,
    pub end_of_life: Option<String>,
    pub distributions: Vec<PythonDistribution>,
    pub compatibility_score: f64,  // 0.0-1.0, higher = more compatible
    pub notes: String,
    pub recommended: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonDistribution {
    pub version: String,
    pub url: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub arch: String,            // "x86_64", "aarch64", "universal2"
    pub platform: PlatformType,
    pub variant: String,         // "embeddable" | "installer" | "tar.xz" | "pkg" | "brew"
    pub checksum_sha256: Option<String>,
    pub compatible: bool,
    pub recommended: bool,
    pub release_date: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,               // "windows", "linux", "macos"
    pub os_version: String,       // "10.0.22631", "22.04", "14.5"
    pub arch: String,             // "x86_64", "aarch64"
    pub platform_type: PlatformType,
    pub kernel_version: Option<String>,
    pub distro_name: Option<String>,  // Linux only
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
```

### 1.5 Phase Weight Table

| Phase | Weight% | Sub-phase | Sub-weight |
|-------|---------|-----------|------------|
| Init | 0-2% | Checking existing install | 40% |
| | | Loading config | 20% |
| | | Checking network | 20% |
| | | Detecting platform | 20% |
| Discovering Versions | 2-8% | Fetching from GitHub | 40% |
| | | Checking local cache | 15% |
| | | Scanning system paths | 20% |
| | | Comparing versions | 10% |
| | | Building version list | 15% |
| Version Select | 8% | (static, waiting for user) | - |
| Detecting Platform | 8-11% | Detecting OS | 25% |
| | | Detecting arch | 25% |
| | | Checking compatibility | 25% |
| | | Selecting distribution | 25% |
| Validating Prereqs | 11-15% | Checking disk space | 25% |
| | | Checking permissions | 20% |
| | | Network connectivity | 25% |
| | | Port availability | 15% |
| | | Checking existing Python | 15% |
| Downloading Python | 15-35% | Resolving URL | 5% |
| | | Connecting | 10% |
| | | Downloading | 70% |
| | | Verifying checksum | 15% |
| Extracting Python | 35-42% | Reading archive | 10% |
| | | Extracting files | 70% |
| | | Setting permissions | 15% |
| | | Cleanup temp | 5% |
| Configuring Python | 42-48% | Enabling site-packages | 20% |
| | | Creating directories | 15% |
| | | Creating pip.ini | 20% |
| | | Setting env vars | 15% |
| | | Testing interpreter | 30% |
| Downloading get-pip | 48-52% | Same as download phases | - |
| Installing pip | 52-58% | Bootstrap | 45% |
| | | Verifying | 25% |
| | | Upgrading | 20% |
| | | Testing connection | 10% |
| Installing Open WebUI | 58-85% | Resolving deps | 10% |
| | | Downloading packages | 35% |
| | | Building wheels | 20% |
| | | Installing packages | 25% |
| | | Post-install setup | 5% |
| | | Verifying | 5% |
| Verifying | 85-92% | Each check | 20% |
| Server Start | 92-95% | Launching | 30% |
| | | Waiting for port | 30% |
| | | Health check | 40% |

### 1.6 GitHub Version Discovery Strategy

```rust
pub struct VersionDiscovery {
    // Primary: GitHub API for python/cpython releases
    pub github_releases_url: String,  // "https://api.github.com/repos/python/cpython/releases"
    // Fallback: python.org downloads page
    pub python_org_url: String,       // "https://www.python.org/downloads/"
    // Cache: local JSON file with TTL (1 hour)
    pub cache_path: PathBuf,
    pub cache_ttl_secs: u64,          // 3600
}

impl VersionDiscovery {
    /// Fetch available versions from GitHub API
    /// Filters: only 3.x releases, only stable (not pre-release)
    /// Maps each release to platform-specific distributions
    pub async fn fetch_versions(&self) -> Result<Vec<PythonVersion>, String> {
        // 1. Check local cache first
        // 2. If cache miss/expired, fetch from GitHub API
        // 3. Filter releases: stable, 3.x, not pre-release
        // 4. For each release, map to compatible distributions
        // 5. Score compatibility based on platform/arch
        // 6. Mark recommended version (latest stable with best Open WebUI compat)
        // 7. Cache result
    }

    /// Map a release to platform-specific distributions
    fn map_distributions(&self, release: &GitHubRelease, platform: &PlatformInfo) -> Vec<PythonDistribution> {
        match platform.platform_type {
            PlatformType::Windows => {
                // Filter for: *-amd64.zip (embeddable), *-amd64.exe (installer)
                // Only include if arch matches
            }
            PlatformType::Linux => {
                // Filter for: *.tar.xz (source/build)
                // Note: Linux typically uses system package manager
                // We recommend using system Python on Linux
            }
            PlatformType::MacOS => {
                // Filter for: *.pkg (installer), *-macos11.pkg
                // Also suggest: brew install python@3.11
            }
            _ => {}
        }
    }
}
```

---

## 2. Real-time Metrics

### 2.1 Main Metrics Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealTimeMetrics {
    // ── Core Progress ──
    pub overall_percent: f64,
    pub phase_percent: f64,
    pub current_phase: String,
    pub current_phase_label: String,
    pub current_sub_phase: String,

    // ── Timing ──
    pub elapsed_total_secs: f64,
    pub elapsed_phase_secs: f64,
    pub eta_total_secs: Option<f64>,
    pub eta_phase_secs: Option<f64>,
    pub estimated_completion_time: Option<String>,  // "14:33:10"
    pub total_estimated_duration: Option<f64>,

    // ── Phase-Specific Metrics ──
    pub download: Option<DownloadMetrics>,
    pub extraction: Option<ExtractionMetrics>,
    pub installation: Option<InstallationMetrics>,
    pub verification: Option<VerificationMetrics>,
    pub server_start: Option<ServerStartMetrics>,

    // ── System Metrics ──
    pub system: SystemMetrics,
    pub network: NetworkMetrics,
    pub resources: ResourceMetrics,

    // ── Version Info ──
    pub version_info: Option<VersionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadMetrics {
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percent: f64,
    pub speed_bytes_per_sec: f64,
    pub speed_display: String,           // "256 KB/s"
    pub average_speed_bytes_per_sec: f64,
    pub peak_speed_bytes_per_sec: f64,
    pub eta_secs: f64,
    pub eta_display: String,             // "42s"
    pub eta_human_display: String,       // "about 42 seconds"
    pub chunks_received: u64,
    pub retried_count: u32,
    pub current_url: String,
    pub content_length: Option<u64>,
    pub content_type: Option<String>,
    pub supports_resume: bool,
    pub resumable_from_byte: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionMetrics {
    pub files_extracted: usize,
    pub total_files: usize,
    pub percent: f64,
    pub current_file: String,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub speed_files_per_sec: f64,
    pub directories_created: usize,
    pub archive_format: String,          // "zip", "tar.xz"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallationMetrics {
    pub packages_installed: usize,
    pub total_packages: usize,
    pub percent: f64,
    pub current_package: String,
    pub packages_downloading: usize,
    pub packages_building: usize,
    pub wheels_built: usize,
    pub wheels_total: usize,
    pub pip_version: Option<String>,
    pub python_version: String,
    pub download_speed: f64,
    pub installation_speed: f64,         // packages per second
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationMetrics {
    pub checks_passed: usize,
    pub total_checks: usize,
    pub current_check: String,
    pub check_result: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStartMetrics {
    pub port: u16,
    pub pid: Option<u32>,
    pub url: String,
    pub startup_phase: String,           // "launching", "waiting_port", "health_check"
    pub health_check_passed: bool,
    pub response_time_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage_percent: Option<f64>,
    pub memory_usage_mb: Option<f64>,
    pub memory_total_mb: Option<f64>,
    pub memory_usage_percent: Option<f64>,
    pub disk_space_available_bytes: u64,
    pub disk_space_total_bytes: u64,
    pub disk_usage_percent: f64,
    pub disk_write_speed_bps: Option<f64>,
    pub process_count: u32,
    pub platform: String,
    pub arch: String,
    pub os_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub status: NetworkStatus,
    pub latency_ms: Option<f64>,
    pub dns_resolution_ms: Option<f64>,
    pub connection_type: Option<String>,
    pub bandwidth_estimate_bps: Option<f64>,
    pub packets_lost: u32,
    pub reconnect_count: u32,
    pub last_speed_samples: Vec<f64>,    // last 10 speed samples for graph
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NetworkStatus {
    Online,       // > 100 KB/s
    Good,         // 50-100 KB/s
    Slow,         // 10-50 KB/s
    VerySlow,     // 1-10 KB/s
    Offline,      // < 1 B/s
    Reconnecting,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceMetrics {
    pub python_size_bytes: u64,
    pub pip_size_bytes: u64,
    pub open_webui_size_bytes: u64,
    pub total_install_size_bytes: u64,
    pub cache_size_bytes: u64,
    pub temp_files_size_bytes: u64,
    pub estimated_final_size_bytes: u64,
    pub disk_write_speed_bps: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub python_version: String,
    pub python_arch: String,
    pub python_variant: String,
    pub platform: String,
    pub distribution_url: String,
    pub checksum: Option<String>,
}
```

### 2.2 ETA Calculation (Exponential Moving Average)

```rust
impl RealTimeMetrics {
    /// Calculate ETA using Exponential Moving Average (EMA)
    /// Alpha = 0.3 gives more weight to recent samples
    pub fn calculate_eta(&mut self, speed_samples: &[(f64, u64)]) {
        if speed_samples.len() < 2 {
            if let Some(download) = &mut self.download {
                download.eta_secs = 0.0;
                download.eta_display = "calculating...".into();
                download.eta_human_display = "calculating time remaining...".into();
            }
            return;
        }

        let alpha = 0.3;
        let mut ema_speed = speed_samples[0].1 as f64;
        for (i, (_, bytes)) in speed_samples.iter().enumerate().skip(1) {
            if i > 0 {
                let dt = speed_samples[i].0 - speed_samples[i - 1].0;
                if dt > 0.0 {
                    let instant_speed = *bytes as f64 / dt;
                    ema_speed = alpha * instant_speed + (1.0 - alpha) * ema_speed;
                }
            }
        }

        // Update download metrics
        if let Some(download) = &mut self.download {
            if ema_speed > 0.0 {
                let remaining = download.total_bytes.saturating_sub(download.bytes_downloaded);
                download.eta_secs = remaining as f64 / ema_speed;
                download.eta_display = format_eta_compact(download.eta_secs);
                download.eta_human_display = format_eta_human(download.eta_secs);
                download.average_speed_bytes_per_sec = ema_speed;
            }
        }

        // Update overall ETA
        let remaining_weight = 100.0 - self.overall_percent;
        if remaining_weight > 0.0 && self.elapsed_total_secs > 0.0 {
            let current_speed = self.overall_percent / self.elapsed_total_secs;
            if current_speed > 0.0 {
                self.eta_total_secs = Some(remaining_weight / current_speed);
            }
        }
    }

    /// Track peak speed
    pub fn update_peak_speed(&mut self, current_speed: f64) {
        if let Some(download) = &mut self.download {
            if current_speed > download.peak_speed_bytes_per_sec {
                download.peak_speed_bytes_per_sec = current_speed;
            }
        }
    }
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
    if secs < 10 { return "a few seconds".into(); }
    if secs < 30 { return "less than a minute".into(); }
    if secs < 90 { return "about a minute".into(); }
    if secs < 300 { return format!("{} minutes", (secs / 60.0).round() as u64); }
    if secs < 1800 { return format!("about {} minutes", (secs / 60.0).round() as u64); }
    format!("about {} hours", (secs / 3600.0).round() as u64)
}
```

### 2.3 Overall Progress Calculation

```rust
pub fn calculate_overall_percent(phase: &InstallPhase) -> f64 {
    let weights = [
        ("init",                      2.0),
        ("discovering_versions",      6.0),
        ("version_select",            0.0),  // paused, no weight
        ("detecting_platform",        3.0),
        ("validating_prereqs",        4.0),
        ("downloading_python",       20.0),
        ("extracting_python",         7.0),
        ("configuring_python",        6.0),
        ("downloading_get_pip",       4.0),
        ("installing_pip",            6.0),
        ("installing_open_webui",    30.0),
        ("verifying",                 7.0),
        ("starting_server",           5.0),
        ("running",                 100.0),
    ];

    let phase_name = phase_to_string(phase);
    let phase_percent = get_phase_percent(phase);
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
```

### 2.4 Network Degradation Detection

```rust
pub struct NetworkDegradationTracker {
    samples: Vec<(f64, f64)>,  // (timestamp, speed_bps)
    last_emit: Instant,
    degradation_level: DegradationLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DegradationLevel {
    None,       // > 100 KB/s
    Mild,       // 50-100 KB/s
    Moderate,   // 10-50 KB/s
    Severe,     // 1-10 KB/s
    Critical,   // < 1 B/s for > 30s
}

impl NetworkDegradationTracker {
    pub fn update(&mut self, speed_bps: f64) -> DegradationLevel {
        self.samples.push((self.elapsed(), speed_bps));
        if self.samples.len() > 60 { self.samples.remove(0); }

        let recent_avg = self.samples.iter().rev().take(5)
            .map(|(_, s)| s).sum::<f64>() / 5.0;

        self.degradation_level = if recent_avg < 1.0 {
            // Check if offline for > 30 seconds
            let offline_duration = self.samples.iter().rev()
                .take_while(|(_, s)| *s < 1.0)
                .count() as f64 * 0.5;  // 500ms intervals
            if offline_duration > 30.0 { DegradationLevel::Critical }
            else { DegradationLevel::Severe }
        } else if recent_avg < 10_240.0 { DegradationLevel::Severe }
        else if recent_avg < 51_200.0 { DegradationLevel::Moderate }
        else if recent_avg < 102_400.0 { DegradationLevel::Mild }
        else { DegradationLevel::None };

        self.degradation_level.clone()
    }

    pub fn should_auto_pause(&self) -> bool {
        self.degradation_level == DegradationLevel::Critical
    }

    pub fn should_reduce_emit_frequency(&self) -> bool {
        matches!(self.degradation_level, DegradationLevel::Moderate | DegradationLevel::Severe)
    }
}
```

---

## 3. Human-readable Logs

### 3.1 Log Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HumanReadableLog {
    pub timestamp: f64,
    pub wall_clock: String,          // "14:30:22"
    pub level: LogLevel,
    pub category: LogCategory,
    pub phase: String,
    pub sub_phase: Option<String>,
    pub message: String,
    pub detail: Option<String>,
    pub metadata: Option<LogMetadata>,
    pub is_user_action: bool,
    pub is_milestone: bool,
    pub is_phase_transition: bool,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
    Success,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogCategory {
    Network,
    FileSystem,
    Process,
    Configuration,
    Validation,
    Progress,
    UserAction,
    SystemEvent,
    VersionDiscovery,
    PlatformDetection,
}
```

### 3.2 Complete Log Messages Per Phase

#### Phase 1: Init
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 0.0s | INFO | SystemEvent | Starting TissueAI installation wizard |
| 0.1s | INFO | SystemEvent | System: Windows x86_64 (10.0.22631) detected |
| 0.2s | DEBUG | SystemEvent | Application version: 1.0.0 |
| 0.3s | DEBUG | SystemEvent | Installation directory: C:\Users\{user}\Documents\TissueAI\python |
| 0.4s | INFO | Validation | Checking for previous installation... |
| 0.5s | SUCCESS | Validation | No previous installation found | OR Previous installation detected at {path} |
| 0.6s | INFO | Network | Checking network connectivity... |
| 0.8s | SUCCESS | Network | Network available (latency: {ms}ms) | OR Network unavailable |
| 1.0s | SUCCESS | SystemEvent | Initialization complete |

#### Phase 2: Discovering Versions
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 1.1s | INFO | VersionDiscovery | Fetching available Python versions from GitHub... |
| 1.2s | DEBUG | Network | Request: GET https://api.github.com/repos/python/cpython/releases |
| 2.0s | DEBUG | Network | Response: 200 OK ({ms}ms, {size} bytes) |
| 2.1s | INFO | VersionDiscovery | Found {count} Python releases |
| 2.2s | INFO | VersionDiscovery | Latest stable version: Python {version} |
| 2.3s | DEBUG | VersionDiscovery | Scanning system for existing Python installations... |
| 2.5s | INFO | VersionDiscovery | System Python detected: {version} at {path} |
| 2.6s | INFO | VersionDiscovery | Building version compatibility matrix... |
| 2.8s | DEBUG | VersionDiscovery | Platform: {os} {arch} → compatible variants: {variants} |
| 3.0s | SUCCESS | VersionDiscovery | Version list ready: {compatible} compatible, {total} total |

#### Phase 3: Version Select
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| - | INFO | UserAction | User selected Python {version} ({variant}) |
| - | INFO | Validation | Validating selection: Python {version} for {platform}/{arch} |
| - | SUCCESS | Validation | Selection validated - compatible with this system |

#### Phase 4: Detecting Platform
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 3.1s | INFO | PlatformDetection | Detecting operating system... |
| 3.2s | INFO | PlatformDetection | OS: {os} ({os_version}) |
| 3.3s | INFO | PlatformDetection | Architecture: {arch} |
| 3.4s | DEBUG | PlatformDetection | Kernel: {kernel_version} |
| 3.5s | DEBUG | PlatformDetection | Distribution: {distro_name} {distro_version} |
| 3.6s | INFO | PlatformDetection | Checking compatible Python distributions... |
| 3.8s | SUCCESS | PlatformDetection | Found {count} compatible distributions |
| 3.9s | INFO | PlatformDetection | Recommended: {variant} ({reason}) |

#### Phase 5: Validating Prereqs
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 4.0s | INFO | Validation | Running pre-installation checks... |
| 4.1s | SUCCESS | Validation | Disk space: {available} available (required: {required}) |
| 4.2s | SUCCESS | Validation | Permissions: User level OK |
| 4.3s | SUCCESS | Validation | Network: Online (latency: {ms}ms) |
| 4.4s | SUCCESS | Validation | Port {port}: Available |
| 4.5s | INFO | Validation | Existing Python: {status} |
| 4.6s | SUCCESS | Validation | All critical checks passed | OR Some checks failed: {details} |

#### Phase 6: Downloading Python
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 5.0s | INFO | Network | Preparing to download Python {version} ({variant}) |
| 5.1s | DEBUG | Network | URL: {url} |
| 5.2s | INFO | Network | Resolving hostname... |
| 5.3s | DEBUG | Network | DNS resolved in {ms}ms |
| 5.4s | INFO | Network | Establishing connection to python.org... |
| 5.5s | DEBUG | Network | TLS handshake completed ({ms}ms) |
| 5.6s | INFO | Network | Connection established |
| 5.7s | INFO | Network | Content-Length: {size} bytes ({size_human}) |
| 5.8s | INFO | Network | Starting download... |
| 6.3s | PROGRESS | Network | Downloaded: {downloaded_human} / {total_human} ({percent}%) - {speed_human} - ETA: {eta} |
| 6.8s | PROGRESS | Network | Downloaded: {downloaded_human} / {total_human} ({percent}%) - {speed_human} - ETA: {eta} |
| ... | PROGRESS | Network | (every 500ms during download) |
| 12.0s | SUCCESS | Network | Download complete: {total_human} in {duration}s (avg: {avg_speed}) |
| 12.1s | INFO | Network | Verifying checksum... |
| 12.2s | SUCCESS | Network | Checksum verified: SHA256 matches |

#### Phase 7: Extracting Python
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 12.5s | INFO | FileSystem | Extracting Python archive... |
| 12.6s | DEBUG | FileSystem | Archive contains {total_files} files |
| 12.7s | DEBUG | FileSystem | Target directory: {target_dir} |
| 13.0s | PROGRESS | FileSystem | Extracting: {extracted}/{total} files ({percent}%) - {current_file} |
| ... | PROGRESS | FileSystem | (every 20 files) |
| 15.0s | SUCCESS | FileSystem | Extracted {total_files} files successfully |
| 15.1s | INFO | FileSystem | Setting file permissions... |
| 15.2s | SUCCESS | FileSystem | Permissions set |
| 15.3s | DEBUG | FileSystem | Cleaning up temporary files... |
| 15.4s | DEBUG | FileSystem | Removed: python_embed.zip ({size_human}) |

#### Phase 8: Configuring Python
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 15.5s | INFO | Configuration | Configuring Python environment... |
| 15.6s | DEBUG | Configuration | Reading python311._pth... |
| 15.7s | INFO | Configuration | Enabling site-packages (uncommenting 'import site') |
| 15.8s | SUCCESS | Configuration | site-packages enabled |
| 15.9s | DEBUG | Configuration | Creating directory: Lib/ |
| 16.0s | DEBUG | Configuration | Creating directory: Lib/site-packages/ |
| 16.1s | INFO | Configuration | Creating pip.ini with PyPI configuration... |
| 16.2s | SUCCESS | Configuration | pip.ini created |
| 16.3s | INFO | Configuration | Testing Python interpreter... |
| 16.5s | SUCCESS | Configuration | Python {version} interpreter test passed |
| 16.6s | SUCCESS | Configuration | Environment configured successfully |

#### Phase 9: Downloading get-pip.py
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 16.7s | INFO | Network | Downloading get-pip.py... |
| 16.8s | DEBUG | Network | URL: https://bootstrap.pypa.io/get-pip.py |
| 16.9s | INFO | Network | Connecting to bootstrap.pypa.io... |
| 17.0s | INFO | Network | Starting download... |
| 17.5s | PROGRESS | Network | Downloaded: {size_human} ({percent}%) - {speed_human} - ETA: {eta} |
| 18.0s | SUCCESS | Network | get-pip.py downloaded: {size_human} |

#### Phase 10: Installing pip
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 18.1s | INFO | Process | Installing pip package manager... |
| 18.2s | DEBUG | Process | Running: python get-pip.py --no-cache-dir --index-url https://pypi.org/simple/ |
| 18.5s | INFO | Process | Bootstrapping pip from get-pip.py... |
| 20.0s | SUCCESS | Process | pip {version} installed successfully |
| 20.1s | INFO | Process | Verifying pip installation... |
| 20.2s | DEBUG | Process | pip --version: {version} |
| 20.3s | SUCCESS | Process | pip verified: {version} |
| 20.4s | INFO | Process | Upgrading pip to latest version... |
| 22.0s | SUCCESS | Process | pip upgraded to {new_version} |
| 22.1s | DEBUG | Process | Testing pip connectivity to PyPI... |
| 22.3s | SUCCESS | Process | pip connectivity verified |

#### Phase 11: Installing Open WebUI
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 22.4s | INFO | Process | Installing Open WebUI... |
| 22.5s | DEBUG | Process | Running: python -m pip install open-webui --no-cache-dir |
| 23.0s | INFO | Process | Resolving dependencies... |
| 25.0s | INFO | Process | Found {total_packages} packages to install |
| 25.5s | INFO | Process | Downloading packages... |
| 26.0s | PROGRESS | Process | Downloading: {package_name} ({size_human}) |
| 30.0s | PROGRESS | Process | Building wheel for {package_name}... |
| 35.0s | PROGRESS | Process | Installed {installed}/{total} packages |
| 60.0s | SUCCESS | Process | Open WebUI installed ({total_packages} packages) |
| 60.1s | INFO | Process | Verifying installation... |
| 60.3s | SUCCESS | Process | Open WebUI verified successfully |

#### Phase 12: Verifying
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 60.4s | INFO | Validation | Running post-installation verification... |
| 60.5s | INFO | Validation | Checking Python installation... |
| 60.6s | SUCCESS | Validation | Python: OK |
| 60.7s | INFO | Validation | Checking pip installation... |
| 60.8s | SUCCESS | Validation | pip: OK |
| 60.9s | INFO | Validation | Checking Open WebUI installation... |
| 61.0s | SUCCESS | Validation | Open WebUI: OK |
| 61.1s | SUCCESS | Validation | All verification checks passed - installation complete! |

#### Phase 13: Server Start
| Timestamp | Level | Category | Message |
|-----------|-------|----------|---------|
| 61.2s | INFO | Process | Starting Open WebUI server... |
| 61.3s | DEBUG | Process | Launching: python -m open_webui serve --port {port} |
| 62.0s | INFO | Process | Waiting for port {port} to become available... |
| 63.0s | INFO | Process | Port {port} is now listening |
| 63.5s | INFO | Process | Running health check... |
| 64.0s | SUCCESS | Process | Health check passed ({ms}ms) |
| 64.1s | SUCCESS | Process | Open WebUI is running at {url} |

#### Error Messages
| Level | Category | Message |
|-------|----------|---------|
| ERROR | Network | Error: {error_message} |
| WARN | SystemEvent | This error is recoverable - will retry ({count}/{max}) |
| INFO | SystemEvent | Waiting {wait_secs}s before retry... |
| INFO | SystemEvent | Retrying... (attempt {count}/{max}) |
| ERROR | SystemEvent | Fatal error: {error_message} |
| ERROR | SystemEvent | Installation cannot continue |
| INFO | SystemEvent | Suggested action: {suggestion} |
| INFO | SystemEvent | You may retry the installation or check the logs for details |

---

## 4. Event Payload Structure

### 4.1 Main Event Payload (JSON)

```json
{
  "event_id": "evt_1722432622456_abc123",
  "event_type": "installation_progress",
  "timestamp": 1722432622.456,
  "wall_clock": "14:30:22",
  "schema_version": "2.0",

  "phase": {
    "current": "downloading_python",
    "label": "Downloading Python",
    "sub_phase": "downloading",
    "sub_phase_label": "Downloading from python.org",
    "percent": 45.2,
    "total_phases": 13,
    "completed_phases": 5,
    "is_terminal": false,
    "is_error": false,
    "is_paused": false,
    "is_user_waiting": false
  },

  "progress": {
    "overall_percent": 32.7,
    "overall_eta_secs": 187.5,
    "overall_eta_display": "3m 7s",
    "overall_eta_human": "about 3 minutes",
    "phase_percent": 45.2,
    "phase_eta_secs": 42.3,
    "phase_eta_display": "42s",
    "estimated_completion_time": "14:33:10",
    "total_estimated_duration": 245.7
  },

  "metrics": {
    "elapsed": {
      "total_secs": 89.2,
      "phase_secs": 23.1,
      "format_total": "1m 29s",
      "format_phase": "23s"
    },
    "download": {
      "bytes_downloaded": 5167104,
      "total_bytes": 11426325,
      "percent": 45.2,
      "speed_bps": 262144,
      "speed_display": "256 KB/s",
      "average_speed_bps": 245760,
      "peak_speed_bps": 524288,
      "eta_secs": 42.3,
      "eta_display": "42s",
      "eta_human": "about 42 seconds",
      "retried_count": 0,
      "chunks_received": 156,
      "supports_resume": true
    },
    "extraction": null,
    "installation": null,
    "verification": null,
    "server_start": null,
    "system": {
      "cpu_usage_percent": 23.4,
      "memory_usage_mb": 156.2,
      "memory_total_mb": 8192.0,
      "memory_usage_percent": 1.9,
      "disk_available_bytes": 53687091200,
      "disk_total_bytes": 107374182400,
      "disk_usage_percent": 50.0,
      "platform": "windows",
      "arch": "x86_64",
      "os_version": "10.0.22631"
    },
    "network": {
      "status": "online",
      "latency_ms": 12.5,
      "dns_resolution_ms": 8.2,
      "last_speed_samples": [262144, 245760, 278528, 256000, 270336]
    },
    "resources": {
      "python_size_bytes": 0,
      "pip_size_bytes": 0,
      "open_webui_size_bytes": 0,
      "total_install_size_bytes": 0,
      "estimated_final_size_bytes": 892416000
    },
    "version_info": {
      "python_version": "3.11.9",
      "python_arch": "amd64",
      "python_variant": "embeddable",
      "platform": "windows",
      "distribution_url": "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
    }
  },

  "message": "Downloading Python: 5.2 MB / 11.4 MB (45.2%) - 256 KB/s - ETA: 42s",
  "detail": "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip",

  "logs": [
    {
      "timestamp": 89.2,
      "wall_clock": "14:31:51",
      "level": "info",
      "category": "network",
      "message": "Downloaded: 5.2 MB / 11.4 MB (45.2%) - 256 KB/s - ETA: 42s",
      "icon": "trending-up",
      "is_milestone": false,
      "is_phase_transition": false
    }
  ],

  "warnings": [],
  "errors": [],

  "context": {
    "platform": "windows",
    "arch": "x86_64",
    "python_version": "3.11.9",
    "python_variant": "embeddable",
    "install_path": "C:\\Users\\User\\Documents\\TissueAI\\python",
    "target_url": "http://127.0.0.1:8082",
    "selected_by_user": true
  }
}
```

### 4.2 Special Events

```json
// ── Installation Started ──
{
  "event_type": "installation_started",
  "phase": { "current": "init", "label": "Initializing", "is_terminal": false },
  "message": "Installation started by user",
  "context": {
    "selected_version": "3.11.9",
    "selected_variant": "embeddable",
    "platform": "windows",
    "arch": "x86_64",
    "install_path": "C:\\Users\\User\\Documents\\TissueAI\\python"
  }
}

// ── Version Discovery Complete ──
{
  "event_type": "versions_discovered",
  "phase": { "current": "version_select", "label": "Select Version", "is_user_waiting": true },
  "message": "Found 4 compatible Python versions",
  "context": {
    "available_versions": ["3.9.13", "3.10.11", "3.11.9", "3.12.4"],
    "recommended": "3.11.9",
    "reason": "Latest stable with best Open WebUI compatibility",
    "compatible_count": 4,
    "total_count": 8
  }
}

// ── Version Selected ──
{
  "event_type": "version_selected",
  "phase": { "current": "detecting_platform", "label": "Detecting Platform" },
  "message": "User selected Python 3.11.9 (embeddable for Windows x64)",
  "context": {
    "selected_version": "3.11.9",
    "variant": "embeddable",
    "url": "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip",
    "size_bytes": 11426325
  }
}

// ── Prerequisite Check Result ──
{
  "event_type": "prereq_check_complete",
  "phase": { "current": "validating_prereqs", "label": "Validating Prerequisites" },
  "message": "All prerequisite checks passed",
  "context": {
    "checks": [
      { "name": "Disk Space", "passed": true, "message": "45.2 GB available (required: 1.2 GB)" },
      { "name": "Network", "passed": true, "message": "Online (latency: 12ms)" },
      { "name": "Port 8082", "passed": true, "message": "Available" },
      { "name": "Permissions", "passed": true, "message": "User level OK" }
    ],
    "all_passed": true
  }
}

// ── Download Progress (every 500ms) ──
{
  "event_type": "download_progress",
  "phase": { "current": "downloading_python", "label": "Downloading Python" },
  "message": "Downloaded: 5.2 MB / 11.4 MB (45.2%) - 256 KB/s - ETA: 42s",
  "metrics": {
    "download": {
      "bytes_downloaded": 5167104,
      "total_bytes": 11426325,
      "percent": 45.2,
      "speed_bps": 262144,
      "eta_secs": 42.3
    }
  }
}

// ── Paused ──
{
  "event_type": "installation_paused",
  "phase": { "current": "downloading_python", "label": "Downloading Python", "is_paused": true },
  "message": "Installation paused by user",
  "context": {
    "paused_at_percent": 45.2,
    "paused_at_bytes": 5167104,
    "can_resume": true,
    "resume_from_phase": "downloading_python"
  }
}

// ── Retry Attempt ──
{
  "event_type": "retry_attempt",
  "phase": { "current": "downloading_python", "label": "Downloading Python" },
  "message": "Retrying download (attempt 2/3)...",
  "context": {
    "retry_count": 2,
    "max_retries": 3,
    "wait_secs": 5,
    "backoff_secs": 10,
    "error": "Connection timeout",
    "error_code": "NETWORK_TIMEOUT",
    "will_resume_from_bytes": 2097152
  }
}

// ── Network Degraded ──
{
  "event_type": "network_degraded",
  "phase": { "current": "downloading_python", "label": "Downloading Python" },
  "message": "Network connection is slow - download speed dropped below 50 KB/s",
  "context": {
    "current_speed_bps": 5120,
    "threshold_bps": 51200,
    "degradation_level": "severe",
    "eta_impact": "ETA increased from 2m to 8m",
    "suggestion": "Check your network connection or try a wired connection"
  }
}

// ── Completed ──
{
  "event_type": "installation_completed",
  "phase": { "current": "running", "label": "Running", "is_terminal": true },
  "message": "Installation completed successfully!",
  "context": {
    "total_duration_secs": 245.7,
    "python_version": "3.11.9",
    "pip_version": "24.0",
    "open_webui_version": "0.3.0",
    "total_packages": 127,
    "server_url": "http://127.0.0.1:8082",
    "final_disk_usage_bytes": 892416000,
    "final_disk_usage_display": "851.2 MB"
  }
}

// ── Error ──
{
  "event_type": "installation_error",
  "phase": { "current": "downloading_python", "label": "Downloading Python", "is_error": true },
  "message": "Failed to download Python: Connection refused",
  "context": {
    "error_code": "NETWORK_REFUSED",
    "error_message": "Connection refused",
    "recoverable": true,
    "retry_count": 1,
    "max_retries": 3,
    "suggested_action": "Check your internet connection and firewall settings",
    "last_successful_bytes": 0,
    "failed_url": "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
  }
}
```

### 4.3 New Tauri Commands

```rust
// ── Version Discovery ──
#[tauri::command]
async fn llm_discover_python_versions(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<Vec<PythonVersion>, String> {
    state.manager.lock().await.discover_versions().await
}

#[tauri::command]
async fn llm_select_python_version(
    version: String,
    variant: String,
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<(), String> {
    state.manager.lock().await.select_version(&version, &variant).await
}

// ── Platform Detection ──
#[tauri::command]
async fn llm_detect_platform(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<PlatformInfo, String> {
    state.manager.lock().await.detect_platform().await
}

// ── Prerequisite Validation ──
#[tauri::command]
async fn llm_validate_prereqs(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<Vec<PrereqCheck>, String> {
    state.manager.lock().await.validate_prerequisites().await
}

// ── Installation Control ──
#[tauri::command]
async fn llm_pause_installation(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<(), String> {
    state.manager.lock().await.pause().await
}

#[tauri::command]
async fn llm_resume_installation(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<(), String> {
    state.manager.lock().await.resume().await
}

// ── System Info ──
#[tauri::command]
async fn llm_get_system_info(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<SystemMetrics, String> {
    state.manager.lock().await.get_system_info().await
}

#[tauri::command]
async fn llm_get_network_info(
    state: tauri::State<'_, OpenWebUIState>,
) -> Result<NetworkMetrics, String> {
    state.manager.lock().await.get_network_info().await
}
```

### 4.4 TypeScript Types for Frontend

```typescript
// ── InstallPhase (Discriminated Union) ──
export type InstallPhase =
  | { type: "idle" }
  | { type: "init"; sub_phase: string; percent: number; detail: string }
  | { type: "discovering_versions"; sub_phase: string; percent: number; platform: string; source: string }
  | { type: "version_select"; available_versions: PythonVersion[]; recommended: string; reason: string }
  | { type: "detecting_platform"; sub_phase: string; percent: number; os: string; arch: string; compatible_distributions: PythonDistribution[] }
  | { type: "validating_prereqs"; sub_phase: string; percent: number; checks: PrereqCheck[] }
  | { type: "downloading_python"; sub_phase: string; percent: number; resource_type: string; bytes_downloaded: number; total_bytes: number; speed_bps: number; eta_secs: number; url: string; checksum_verified: boolean }
  | { type: "extracting_python"; sub_phase: string; percent: number; files_extracted: number; total_files: number; current_file: string }
  | { type: "configuring_python"; sub_phase: string; percent: number; actions_completed: string[]; current_action: string }
  | { type: "downloading_get_pip"; sub_phase: string; percent: number; bytes_downloaded: number; total_bytes: number; speed_bps: number; eta_secs: number }
  | { type: "installing_pip"; sub_phase: string; percent: number; version: string | null; detail: string }
  | { type: "installing_open_webui"; sub_phase: string; percent: number; packages_installed: number; total_packages: number; current_package: string; download_speed: number }
  | { type: "verifying"; sub_phase: string; percent: number; checks: VerificationCheck[] }
  | { type: "starting_server"; sub_phase: string; percent: number; port: number; detail: string }
  | { type: "running"; port: number; url: string; pid: number | null; uptime_secs: number }
  | { type: "error"; message: string; phase: string; recoverable: boolean; retry_count: number; max_retries: number; suggested_action: string; error_code: string }
  | { type: "paused"; paused_at_phase: string; sub_phase: string; overall_percent: number; can_resume: boolean; reason: string };

// ── PythonVersion ──
export interface PythonVersion {
  version: string;
  release_date: string;
  is_latest: boolean;
  is_security_fix: boolean;
  end_of_life: string | null;
  distributions: PythonDistribution[];
  compatibility_score: number;
  notes: string;
  recommended: boolean;
}

// ── PythonDistribution ──
export interface PythonDistribution {
  version: string;
  url: string;
  size_bytes: number;
  size_display: string;
  arch: string;
  platform: string;
  variant: string;
  checksum_sha256: string | null;
  compatible: boolean;
  recommended: boolean;
  release_date: string;
  notes: string;
}

// ── PrereqCheck ──
export interface PrereqCheck {
  name: string;
  passed: boolean;
  message: string;
  required: boolean;
  details: string | null;
}

// ── VerificationCheck ──
export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
  details: string | null;
}

// ── ProgressPayload ──
export interface ProgressPayload {
  event_id: string;
  event_type: string;
  timestamp: number;
  wall_clock: string;
  schema_version: string;
  phase: {
    current: string;
    label: string;
    sub_phase: string;
    sub_phase_label: string;
    percent: number;
    total_phases: number;
    completed_phases: number;
    is_terminal: boolean;
    is_error: boolean;
    is_paused: boolean;
    is_user_waiting: boolean;
  };
  progress: {
    overall_percent: number;
    overall_eta_secs: number | null;
    overall_eta_display: string;
    overall_eta_human: string;
    phase_percent: number;
    phase_eta_secs: number | null;
    phase_eta_display: string;
    estimated_completion_time: string | null;
    total_estimated_duration: number | null;
  };
  metrics: RealTimeMetrics;
  message: string;
  detail: string | null;
  logs: HumanReadableLog[];
  warnings: string[];
  errors: string[];
  context: Record<string, any>;
}

// ── RealTimeMetrics ──
export interface RealTimeMetrics {
  elapsed: { total_secs: number; phase_secs: number; format_total: string; format_phase: string };
  download: DownloadMetrics | null;
  extraction: ExtractionMetrics | null;
  installation: InstallationMetrics | null;
  verification: VerificationMetrics | null;
  server_start: ServerStartMetrics | null;
  system: SystemMetrics;
  network: NetworkMetrics;
  resources: ResourceMetrics;
  version_info: VersionInfo | null;
}

// ── HumanReadableLog ──
export interface HumanReadableLog {
  timestamp: number;
  wall_clock: string;
  level: "debug" | "info" | "warn" | "error" | "success" | "system";
  category: string;
  message: string;
  detail: string | null;
  icon: string | null;
  is_milestone: boolean;
  is_phase_transition: boolean;
}
```

---

## 5. Edge Cases & Degradation

### 5.1 Error Classification Matrix

| Error Type | Error Code | Recoverable | Max Retries | Backoff | User Action |
|------------|------------|-------------|-------------|---------|-------------|
| Network timeout | NETWORK_TIMEOUT | Yes | 3 | 5s, 10s, 20s | Check internet |
| Connection refused | NETWORK_REFUSED | Yes | 3 | 5s, 10s, 20s | Check firewall/proxy |
| DNS resolution failed | DNS_FAILED | Yes | 3 | 5s, 10s, 20s | Check DNS settings |
| Download interrupted | DOWNLOAD_INTERRUPTED | Yes | 3 | 0s (resume) | - |
| Checksum mismatch | CHECKSUM_MISMATCH | Yes | 2 | 0s (re-download) | - |
| Insufficient disk space | DISK_SPACE | No | 0 | - | Free disk space |
| Permission denied | PERMISSION_DENIED | No | 0 | - | Run as admin |
| Port in use | PORT_IN_USE | Yes | 1 | 0s | Stop conflicting process |
| Python binary corrupt | PYTHON_CORRUPT | Yes | 2 | 0s (re-download) | - |
| pip install failed | PIP_FAILED | Yes | 2 | 5s | Check PyPI status |
| Open WebUI install failed | OWUI_FAILED | Yes | 2 | 5s | Check PyPI status |
| Server start failed | SERVER_FAILED | Yes | 2 | 5s | Check port, permissions |
| Health check timeout | HEALTH_TIMEOUT | Yes | 2 | 10s | Wait for server |
| Archive corrupt | ARCHIVE_CORRUPT | Yes | 2 | 0s (re-download) | - |
| Extraction failed | EXTRACTION_FAILED | Yes | 1 | 0s | Check disk space |
| GitHub API rate limit | GH_RATE_LIMIT | Yes | 2 | 60s | Wait or use cache |
| Python version incompatible | VERSION_INCOMPATIBLE | No | 0 | - | Select different version |
| Unknown error | UNKNOWN | No | 0 | - | Check logs |

### 5.2 Network Degradation Handling

```rust
pub fn handle_degradation(level: DegradationLevel) -> DegradationAction {
    match level {
        DegradationLevel::None => DegradationAction::Continue,
        DegradationLevel::Mild => {
            // Update ETA display, show warning in logs
            DegradationAction::UpdateETA
        }
        DegradationLevel::Moderate => {
            // Reduce emit frequency to every 2s instead of 500ms
            // Show "slow connection" warning
            DegradationAction::ReduceUpdateFrequency
        }
        DegradationLevel::Severe => {
            // Reduce emit frequency to every 5s
            // Show "very slow connection" warning
            // Suggest user action
            DegradationAction::ShowSlowWarning
        }
        DegradationLevel::Critical => {
            // Auto-pause after 30s of no progress
            // Suggest checking connection
            DegradationAction::AutoPause
        }
    }
}
```

### 5.3 User-visible Messages for Edge Cases

```rust
pub fn degradation_messages(level: DegradationLevel, context: &str) -> Vec<HumanReadableLog> {
    match level {
        DegradationLevel::Mild => vec![
            Log { level: Warn, category: Network, message: "Download speed is below normal ({speed}/s)".into(), icon: "alert-triangle" },
        ],
        DegradationLevel::Moderate => vec![
            Log { level: Warn, category: Network, message: "Slow network connection detected. ETA may be inaccurate.".into(), icon: "alert-triangle" },
            Log { level: Info, category: Network, message: "Tip: Use a wired connection for faster downloads".into(), icon: "lightbulb" },
        ],
        DegradationLevel::Severe => vec![
            Log { level: Error, category: Network, message: "Very slow connection ({speed}/s). Download may take a long time.".into(), icon: "alert-circle" },
            Log { level: Info, category: Network, message: "The download will continue but ETA is unreliable.".into(), icon: "info" },
        ],
        DegradationLevel::Critical => vec![
            Log { level: Error, category: Network, message: "Network connection appears to be offline.".into(), icon: "wifi-off" },
            Log { level: Info, category: Network, message: "Please check your internet connection and try again.".into(), icon: "lightbulb" },
            Log { level: Info, category: SystemEvent, message: "Installation will be paused automatically if no data is received for 30 seconds.".into(), icon: "pause" },
        ],
        DegradationLevel::None => vec![],
    }
}

pub fn pause_messages(reason: &str, can_resume: bool) -> Vec<HumanReadableLog> {
    let mut msgs = vec![
        Log { level: Info, category: UserAction, message: "Installation paused by user".into(), icon: "pause" },
        Log { level: Info, category: SystemEvent, message: "Reason: {reason}".into(), icon: "info" },
    ];
    if can_resume {
        msgs.push(Log { level: Info, category: SystemEvent, message: "Click Resume to continue from where you left off".into(), icon: "play" });
    } else {
        msgs.push(Log { level: Warn, category: SystemEvent, message: "Resume not available for this phase. Click Retry to start over.".into(), icon: "alert-triangle" });
    }
    msgs
}

pub fn retry_messages(count: u32, max: u32, error: &str, wait_secs: u64) -> Vec<HumanReadableLog> {
    vec![
        Log { level: Warn, category: SystemEvent, message: "Error: {error}".into(), icon: "alert-triangle" },
        Log { level: Info, category: SystemEvent, message: "Attempt {count}/{max} - retrying in {wait_secs}s...".into(), icon: "refresh-cw" },
        Log { level: Info, category: SystemEvent, message: "Waiting before retry...".into(), icon: "clock" },
        Log { level: Info, category: SystemEvent, message: "Retrying...".into(), icon: "rotate-cw" },
    ]
}

pub fn resource_exhaustion_messages(resource: &str, available: u64, required: u64) -> Vec<HumanReadableLog> {
    vec![
        Log { level: Error, category: SystemEvent, message: "Insufficient {resource}: need {required_human}, have {available_human}".into(), icon: "hard-drive" },
        Log { level: Info, category: SystemEvent, message: "Free up at least {deficit_human} of {resource} and try again".into(), icon: "lightbulb" },
    ]
}
```

### 5.4 Pause/Resume State Persistence

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PauseState {
    pub phase: String,
    pub sub_phase: String,
    pub overall_percent: f64,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub elapsed_secs: f64,
    pub logs: Vec<HumanReadableLog>,
    pub paused_at: f64,
    pub reason: String,
    pub version_info: Option<VersionInfo>,
    pub speed_samples: Vec<(f64, u64)>,
}

impl PauseState {
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load(path: &Path) -> Option<Self> {
        let content = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }
}
```

---

## 6. UI/UX Mapping

### 6.1 Unified Settings Page Structure (API Tab)

The API tab in Settings (`/settings` → API tab) should contain ALL of these sections in order:

```
+------------------------------------------------------------------+
|  [Tab: API]                                                       |
+------------------------------------------------------------------+
|                                                                    |
|  +-- Section 1: API Provider Selection -------------------------+  |
|  |  Cloud providers grid (OpenAI, Gemini, Anthropic, etc.)      |  |
|  |  API key input, model selection, test connection button       |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 2: Python Version Selector ------------------------+  |
|  |  [Loading spinner] Fetching versions from GitHub...          |  |
|  |                                                               |  |
|  |  OR (after loading):                                          |  |
|  |                                                               |  |
|  |  Platform detected: Windows x64                               |  |
|  |  Source: GitHub Releases (python/cpython)                     |  |
|  |                                                               |  |
|  |  [Radio] Python 3.12.4 (Latest) - 12.1 MB                    |  |
|  |           ⚠ Newer version, may have compatibility issues      |  |
|  |                                                               |  |
|  |  [Radio] Python 3.11.9 (Recommended) - 11.4 MB  ← SELECTED   |  |
|  |           ✓ Best compatibility with Open WebUI                |  |
|  |                                                               |  |
|  |  [Radio] Python 3.10.11 - 10.8 MB                             |  |
|  |           ✓ Compatible, older but stable                      |  |
|  |                                                               |  |
|  |  [Radio] Python 3.9.13 - 10.2 MB                              |  |
|  |           ✓ Compatible, oldest supported                      |  |
|  |                                                               |  |
|  |  Variant: embeddable (auto-selected for Windows)              |  |
|  |  SHA256: {checksum}                                            |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 3: Pre-installation Checks ------------------------+  |
|  |  [✓] Disk space: 45.2 GB available (required: 1.2 GB)       |  |
|  |  [✓] Network: Online (latency: 12ms)                          |  |
|  |  [✓] Port 8082: Available                                     |  |
|  |  [✓] Permissions: User level OK                                |  |
|  |  [✓] Existing Python: None detected (will install fresh)     |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 4: Installation Progress --------------------------+  |
|  |                                                               |  |
|  |  [============ Overall Progress ============] 32.7%           |  |
|  |  [======= Phase Progress (Download) =======] 45.2%           |  |
|  |                                                               |  |
|  |  ┌─ Step Indicator ──────────────────────────────────┐       |  |
|  |  │  1. Initialize .............. ✓ Done              │       |  |
|  |  │  2. Discover Versions ....... ✓ Done              │       |  |
|  |  │  3. Select Version .......... ✓ Done              │       |  |
|  |  │  4. Detect Platform ......... ✓ Done              │       |  |
|  |  │  5. Validate Prereqs ........ ✓ Done              │       |  |
|  |  │  6. Download Python ......... ● In Progress 45%   │       |  |
|  |  │  7. Extract Python .......... ○ Pending            │       |  |
|  |  │  8. Configure Python ........ ○ Pending            │       |  |
|  |  │  9. Install pip ............. ○ Pending            │       |  |
|  |  │ 10. Install Open WebUI ...... ○ Pending            │       |  |
|  |  │ 11. Verify .................. ○ Pending            │       |  |
|  |  │ 12. Server Start ............ ○ Pending            │       |  |
|  |  └──────────────────────────────────────────────────┘       |  |
|  |                                                               |  |
|  |  ┌─ Metrics Grid ────────────────────────────────────┐       |  |
|  |  │  Speed: 256 KB/s    ETA: 42s    Elapsed: 1m 29s  │       |  |
|  |  │  Downloaded: 5.2/11.4 MB    Peak: 512 KB/s        │       |  |
|  |  │  Memory: 156/8192 MB (1.9%)    Disk: 50% used     │       |  |
|  |  │  Network: ● Online     Retry: 0/3                  │       |  |
|  |  └──────────────────────────────────────────────────┘       |  |
|  |                                                               |  |
|  |  [⏸ Pause]  [✕ Cancel]                                       |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 5: Server Status ----------------------------------+  |
|  |  Status: ● Running on http://127.0.0.1:8082                  |  |
|  |  [Start] [Stop] [Open in Browser]                             |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 6: Python Environment Info -----------------------+  |
|  |  ┌─────────┬─────────┬──────────┬──────────┐               |  |
|  |  │ Python  │   pip   │ OpenWebUI│   Disk   │               |  |
|  |  │ ✓ 3.11.9│ ✓ 24.0  │ ✓ 0.3.0  │ 851 MB  │               |  |
|  |  └─────────┴─────────┴──────────┴──────────┘               |  |
|  |  Path: C:\Users\...\TissueAI\python [Copy]                   |  |
|  |  System Python: v3.12.0 at C:\Python312\python.exe          |  |
|  |  Breakdown: Python 245 MB | pip 12 MB | Open WebUI 594 MB   |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 7: Logs ------------------------------------------+  |
|  |  [Collapsible, scrollable terminal]                           |  |
|  |  [14:30:22] [INFO] Starting installation...                  |  |
|  |  [14:30:23] [SUCCESS] Python 3.11.9 selected                 |  |
|  |  ...                                                          |  |
|  |  [Clear Logs]                                                  |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +-- Section 8: Tools -----------------------------------------+  |
|  |  [Refresh Status]  [Uninstall & Remove All]                   |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

### 6.2 Chat Page → Settings Navigation

When API is not configured and user navigates to Chat page in API mode:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Local] [API]  ← mode toggle                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ☁️                                            │
│                                                                  │
│            Open WebUI is not installed                           │
│                                                                  │
│   To use API chat with cloud providers                           │
│   (OpenAI, Gemini, Claude, DeepSeek, and more),                  │
│   you need to install Python and Open WebUI first.               │
│                                                                  │
│   This will download Python 3.11.9 (~11 MB) and                 │
│   install Open WebUI (~600 MB).                                  │
│                                                                  │
│   ┌──────────────────────────────────────────────────┐          │
│   │ ⚙ Configure API & Install Python                  │          │
│   │   → Opens Settings > API tab                      │          │
│   └──────────────────────────────────────────────────┘          │
│                                                                  │
│   Or configure a cloud API provider directly:                    │
│   ┌──────────────────────────────────────────────────┐          │
│   │ 🔑 Configure API Provider                        │          │
│   │   → Opens Settings > API > Provider Selection    │          │
│   └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
// In Chat.tsx - API mode, not installed state
// Navigation logic:
const handleConfigureAndInstall = () => {
  navigate('/settings', {
    state: {
      tab: 'api',
      action: 'install',
      autoStartInstall: true
    }
  });
};

const handleConfigureProvider = () => {
  navigate('/settings', {
    state: {
      tab: 'api',
      section: 'providers'
    }
  });
};

// In Settings.tsx - handle deep link
useEffect(() => {
  const state = location.state as {
    tab?: string;
    action?: string;
    section?: string;
    autoStartInstall?: boolean;
  } | null;

  if (state?.tab === 'api') {
    setActiveTab('api');
    if (state?.action === 'install' && state?.autoStartInstall) {
      // Auto-trigger installation flow
      handleInstall();
    }
    if (state?.section === 'providers') {
      // Scroll to provider section
      providerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }
}, [location.state]);
```

### 6.3 UI Component Mapping

| Data | Component | Format | Location |
|------|-----------|--------|----------|
| Overall progress | Large progress bar | Animated gradient bar with % label | Top of progress section |
| Phase progress | Small progress bar | Solid color bar with phase name | Below overall bar |
| Phase steps | Step indicator list | Numbered list with icons (✓/●/○) | Left side of progress section |
| Download speed | Metric badge | "256 KB/s" with ⚡ icon | Metrics grid |
| Download ETA | Metric badge | "42s" or "about 42 seconds" | Metrics grid |
| Elapsed time | Metric badge | "1m 29s" with ⏱ icon | Metrics grid |
| Downloaded size | Metric badge | "5.2 / 11.4 MB" | Metrics grid |
| Peak speed | Metric badge | "512 KB/s" | Metrics grid |
| Memory usage | Metric badge | "156 / 8192 MB (1.9%)" | Metrics grid |
| Disk usage | Metric badge | "50% used" with pie icon | Metrics grid |
| Network status | Status indicator dot | ● Green/Yellow/Red + label | Metrics grid |
| Retry count | Metric badge | "0/3" with refresh icon | Metrics grid |
| Current file/package | Text label | Truncated filename | Below phase progress |
| Sub-phase detail | Text label | e.g., "Building wheel for package..." | Below phase progress |
| Python version | Card | Version + arch + variant | Version selector section |
| Pre-install checks | Checklist | ✓/✗ items with messages | Validation section |
| Log entries | Scrollable terminal | Timestamped, color-coded lines | Bottom section |
| Pause/Resume | Button | ⏸ Pause / ▶ Resume | Bottom of progress section |
| Cancel | Button | ✕ Cancel with confirmation | Bottom of progress section |
| Warnings | Alert banner | Yellow/orange banner with icon | Below progress section |
| Errors | Alert banner | Red banner with icon + suggestion | Below progress section |
| Milestones | Toast notification | Brief success message | Top-right corner |
| Server URL | Clickable link | http://127.0.0.1:8082 | Server status section |
| Python dir | Copyable path | Mono font + copy button | Environment section |

### 6.4 Color Coding

| Level | Color | CSS Variable | Usage |
|-------|-------|--------------|-------|
| Info | `var(--text-3)` (gray) | - | Normal progress messages |
| Success | `#22c55e` (green) | `--green` | Completed steps, milestones |
| Warn | `#f59e0b` (amber) | `--amber` | Slow connection, non-critical issues |
| Error | `#ef4444` (red) | `--red` | Failures, critical issues |
| Debug | `var(--text-5)` (dim) | - | Technical details (collapsible) |
| Milestone | `#5BA8F5` (blue) | `--primary` | Phase transitions, major completions |
| User Action | `#8b5cf6` (purple) | `--purple` | User-initiated events |
| Paused | `#a78bfa` (violet) | - | Paused state |

### 6.5 Animation Specifications

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Progress bar fill | Smooth width transition | 500ms | ease-out |
| Phase step icon | Scale + color transition | 300ms | ease-in-out |
| Log entry | Fade-in from bottom | 200ms | ease-out |
| Error banner | Shake + fade-in | 400ms | ease-in-out |
| Success toast | Slide-in from right | 300ms | ease-out |
| Warning banner | Pulse opacity | 2s | ease-in-out infinite |
| Speed indicator | Number counter animation | 300ms | linear |
| Spinner (installing) | Rotate 360deg | 1s | linear infinite |
| Status dot pulse | Scale pulse | 2s | ease-in-out infinite |

### 6.6 Responsive Breakpoints

| Width | Layout |
|-------|--------|
| > 800px | Two-column: steps left, metrics right |
| 600-800px | Single column, full-width |
| < 600px | Collapsible sections, compact metrics, hidden detail rows |

### 6.7 Phase-to-UI Mapping Table

| Backend Phase | UI Phase Label | Step # | Icon | Progress Bar Color |
|---------------|----------------|--------|------|-------------------|
| `init` | Initializing | 1 | ⚙️ | `var(--primary)` |
| `discovering_versions` | Discovering Versions | 2 | 🔍 | `var(--primary)` |
| `version_select` | Select Version | 3 | 📋 | `var(--amber)` (waiting) |
| `detecting_platform` | Detecting Platform | 4 | 🖥️ | `var(--primary)` |
| `validating_prereqs` | Validating | 5 | ✅ | `var(--primary)` |
| `downloading_python` | Downloading Python | 6 | 📥 | `var(--primary)` animated |
| `extracting_python` | Extracting Python | 7 | 📦 | `var(--primary)` |
| `configuring_python` | Configuring Python | 8 | ⚙️ | `var(--primary)` |
| `downloading_get_pip` | Downloading pip | 9 | 📥 | `var(--primary)` animated |
| `installing_pip` | Installing pip | 9 | 📦 | `var(--primary)` |
| `installing_open_webui` | Installing Open WebUI | 10 | 📦 | `var(--primary)` animated |
| `verifying` | Verifying | 11 | ✅ | `var(--primary)` |
| `starting_server` | Starting Server | 12 | 🚀 | `var(--primary)` |
| `running` | Running | 13 | ✅ | `var(--green)` 100% |
| `error` | Error | - | ❌ | `var(--red)` |
| `paused` | Paused | - | ⏸ | `var(--amber)` |
