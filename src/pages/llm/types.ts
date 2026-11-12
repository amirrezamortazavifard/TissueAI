// ── Hardware ──────────────────────────────────────────────────────────────────

export interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_threads: number;
  total_ram_mb: number;
  available_ram_mb: number;
  gpus: GpuInfo[];
  os: string;
  arch: string;
  available_backends: BackendInfo[];
  recommended_backend: string;
}

export interface GpuInfo {
  name: string;
  vram_mb: number;
  vendor: "nvidia" | "amd" | "intel" | "apple" | "unknown";
}

export interface BackendInfo {
  id: string;
  name: string;
  available: boolean;
  description: string;
}

export interface SuggestedConfig {
  n_gpu_layers: number;
  n_ctx: number;
  can_fit_fully_in_vram: boolean;
  total_usable_mb: number;
  notes: string[];
}

// ── Runtime ───────────────────────────────────────────────────────────────────

export interface RuntimeInfo {
  installed: boolean;
  build: number | null;
  backend: string | null;
  path: string | null;
  server_binary: string | null;
  runtime_type: "managed" | "custom" | "none";
}

export interface ManagedRuntimeInfo {
  build: number;
  tag_name: string;
  backend_id: string;
  backend_label: string;
  asset_name: string;
  dir_name: string;
  installed_at: number;
}

export interface CustomRuntimeInfo {
  label: string;
  binary_path: string;
}

export interface ReleaseInfo {
  tag_name: string;
  build: number;
  published_at: string;
  available_assets: AssetOption[];
}

export interface AssetOption {
  name: string;
  backend_id: string;
  backend_label: string;
  platform: string;
  download_url: string;
  size_mb: number;
  score: number;
}

export interface CustomBuild {
  binary_path: string;
  label: string;
}

export interface ScanResult {
  builds: CustomBuild[];
  is_source_distribution: boolean;
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  repo_id: string;
  filename: string;
  path: string;
  size_bytes: number;
  quant: string | null;
  params_b: string | null;
  context_length: number | null;
  is_vision: boolean;
  mmproj_path: string | null;
  split_files: string[];
}

export interface RecommendedModel {
  repo_id: string;
  filename: string;
  name: string;
  description: string;
  params_b: number;
  family: string;
  quant: string;
  context: number | null;
  estimated_size_mb: number;
  installed: boolean;
  installed_path: string | null;
}

export interface HfModel {
  repo_id: string;
  name: string;
  author: string;
  tags: string[];
  files: HfFile[];
  downloads: number;
  likes: number;
}

export interface HfFile {
  filename: string;
  size_bytes: number;
  quant: string | null;
  download_url: string;
  is_split: boolean;
  split_parts: HfFilePart[];
  is_mmproj: boolean;
}

export interface HfFilePart {
  filename: string;
  size_bytes: number;
  download_url: string;
}

export interface KnownOwner {
  id: string;
  description: string;
}

// ── Server ────────────────────────────────────────────────────────────────────

export interface ServerConfig {
  model_path: string;
  mmproj_path: string | null;
  host: string;
  port: number;
  n_ctx: number;
  n_gpu_layers: number;
  n_threads: number | null;
  flash_attn: string;
  cache_type_k: string;
  cache_type_v: string;
  temperature: number;
  top_k: number;
  min_p: number;
  top_p: number;
  n_predict: number;
  n_batch: number;
  n_ubatch: number;
  cont_batching: boolean;
  mlock: boolean;
  no_mmap: boolean;
  seed: number | null;
  rope_freq_scale: number | null;
  rope_freq_base: number | null;
  grp_attn_n: number | null;
  grp_attn_w: number | null;
  parallel: number;
  no_mmproj_offload: boolean;
  extra_params: Record<string, string>;
}

export type ServerStatus =
  | { type: "stopped" }
  | { type: "starting" }
  | { type: "running"; port: number; pid: number; host: string }
  | { type: "error"; message: string };

// ── Downloads ─────────────────────────────────────────────────────────────────

export interface DownloadProgress {
  id: string;
  bytes_downloaded: number;
  total_bytes: number;
  percent: number;
  status: string; // "downloading" | "extracting" | "done" | "error" | "paused" | "retrying (N/3)"
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface AppConfig {
  managed_runtimes: ManagedRuntimeInfo[];
  custom_runtimes: CustomRuntimeInfo[];
  active_runtime: { type: "managed"; build: number; backend_id: string } | { type: "custom"; index: number } | { type: "none" };
  auto_delete_old_runtimes: boolean;
  models_dir: string | null;
  model_dirs: string[];
  download_dir: string | null;
  last_update_check: number | null;
  latest_known_build: number | null;
  auto_check_updates: boolean;
  favorite_models: string[];
  selected_model: string | null;
  wizard_completed: boolean;
  /** Maps model file path → last-used preset name */
  model_presets: Record<string, string>;
  preferred_owners: string[];
}

// ── API Providers ─────────────────────────────────────────────────────────────

export type ApiProviderId =
  | "openai"
  | "gemini"
  | "anthropic"
  | "deepseek"
  | "openrouter"
  | "groq"
  | "mistral"
  | "xai"
  | "together"
  | "fireworks"
  | "cerebras"
  | "perplexity"
  | "deepinfra"
  | "cohere"
  | "huggingface"
  | "qwen"
  | "zhipu"
  | "moonshot"
  | "nebius"
  | "custom";

export interface ApiProviderPreset {
  id: ApiProviderId;
  name: string;
  base_url: string;
  default_models: string[];
  key_prefix: string;
  key_placeholder: string;
  icon_color: string;
}

export interface ApiProviderConfig {
  id: string;
  provider_id: ApiProviderId;
  name: string;
  base_url: string;
  api_key: string;
  selected_model: string;
  created_at: number;
  is_active: boolean;
}

export interface ApiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ApiChatSession {
  id: string;
  title: string;
  provider_id: string;
  model: string;
  messages: ApiChatMessage[];
  created_at: number;
  updated_at: number;
}

export interface ApiChatRequest {
  provider_id: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ApiChatResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: string;
}

export interface ApiTestResult {
  success: boolean;
  model: string | null;
  latency_ms: number;
  error: string | null;
}

export interface ApiProvidersConfig {
  providers: ApiProviderConfig[];
}

// ── Open WebUI ────────────────────────────────────────────────────────────────

export type InstallPhase =
  | { type: "idle" }
  | { type: "init"; sub_phase: string; percent: number; detail: string }
  | { type: "discovering_versions"; sub_phase: string; percent: number; detail: string }
  | { type: "version_select"; available_versions: PythonVersion[]; recommended: string; reason: string }
  | { type: "detecting_platform"; sub_phase: string; percent: number; detail: string }
  | { type: "validating_prereqs"; sub_phase: string; percent: number; detail: string }
  | { type: "checking_python"; sub_phase: string; percent: number; detail: string }
  | { type: "downloading_python"; sub_phase: string; percent: number; bytes_downloaded: number; total_bytes: number; speed_bps: number; eta_secs: number }
  | { type: "extracting_python"; sub_phase: string; percent: number; files_extracted: number; total_files: number; current_file: string }
  | { type: "configuring_python"; sub_phase: string; percent: number; detail: string }
  | { type: "downloading_get_pip"; sub_phase: string; percent: number; bytes_downloaded: number; total_bytes: number; speed_bps: number; eta_secs: number }
  | { type: "installing_pip"; sub_phase: string; percent: number; packages_installed: number; total_packages: number; detail: string }
  | { type: "installing_open_webui"; sub_phase: string; percent: number; packages_installed: number; total_packages: number; detail: string }
  | { type: "verifying"; sub_phase: string; percent: number; detail: string }
  | { type: "starting"; sub_phase: string; percent: number; detail: string }
  | { type: "running" }
  | { type: "error"; message: string; phase: string; recoverable: boolean; retry_count: number; max_retries: number; suggested_action: string; error_code: string }
  | { type: "paused"; paused_at_phase: string; sub_phase: string; overall_percent: number; can_resume: boolean; reason: string };

export type SubPhase =
  | "ready"
  | "detecting"
  | "resolving"
  | "connecting"
  | "downloading"
  | "verifying"
  | "read_archive"
  | "extracting"
  | "setting_permissions"
  | "enabling_site_packages"
  | "creating_pip_ini"
  | "testing_interpreter"
  | "bootstrap"
  | "upgrading"
  | "resolving_deps"
  | "building_wheels"
  | "installing"
  | "launching"
  | "waiting_port"
  | "health_check"
  | "done"
  | "error"
  | "fetching_from_github"
  | "checking_local_cache"
  | "scanning_system_paths"
  | "checking_disk_space"
  | "checking_permissions"
  | "checking_network_connectivity"
  | "checking_port_availability"
  | "checking_existing_python"
  | "detecting_os"
  | "detecting_architecture"
  | string;

export interface LogEntry {
  time_secs: number;
  level: "info" | "warn" | "error" | "success";
  text: string;
  category: string;
  icon: string | null;
  is_milestone: boolean;
}

export interface ProgressMetrics {
  overall_percent: number;
  overall_eta_secs: number | null;
  overall_eta_display: string;
  overall_eta_human: string;
  phase_percent: number;
  phase_eta_secs: number | null;
  phase_eta_display: string;
  estimated_completion_time: string | null;
}

export interface DetailedMetrics {
  elapsed_secs: number;
  phase_elapsed_secs: number;
  speed_bytes_per_sec: number | null;
  average_speed_bytes_per_sec: number | null;
  peak_speed_bytes_per_sec: number | null;
  bytes_downloaded: number;
  total_bytes: number;
  files_processed: number | null;
  total_files: number | null;
  packages_installed: number | null;
  total_packages: number | null;
  memory_usage_mb: number | null;
  memory_total_mb: number | null;
  network_status: "online" | "slow" | "offline";
  retried_count: number;
  chunks_received: number;
}

export interface PhaseInfo {
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
}

export interface ProgressPayload {
  event_id: string;
  event_type: string;
  timestamp: number;
  wall_clock: string;
  schema_version: string;
  phase: PhaseInfo;
  progress: ProgressMetrics;
  metrics: DetailedMetrics;
  message: string;
  detail: string | null;
  logs: LogEntry[];
  warnings: string[];
  errors: string[];
  context: Record<string, string>;
}

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

export interface PlatformInfo {
  os: string;
  os_version: string;
  arch: string;
  platform_type: string;
  kernel_version: string | null;
  distro_name: string | null;
  distro_version: string | null;
  compatible_variants: string[];
  recommended_variant: string;
}

export interface PrereqCheck {
  name: string;
  passed: boolean;
  message: string;
  required: boolean;
  details: string | null;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
  details: string | null;
}

export interface OpenWebUIStatus {
  installed: boolean;
  running: boolean;
  installing: boolean;
  paused: boolean;
  port: number;
  url: string;
  pid: number | null;
  data_dir: string;
  venv_dir: string;
  python_dir: string;
  error: string | null;
  progress: string | null;
  phase: InstallPhase;
  overall_percent: number;
  elapsed_secs: number;
  logs: string[];
  selected_version: string | null;
  selected_variant: string | null;
  platform_info: PlatformInfo | null;
}
