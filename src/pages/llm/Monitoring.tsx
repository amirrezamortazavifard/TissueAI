import { useEffect, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity, Users, MessageSquare, Trash2, RefreshCw,
  Zap, Image, Download, Filter, BarChart3, TrendingUp,
  Cpu, HardDrive, Wifi, Search, X,
  ArrowUp, ArrowDown, Globe
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface MonitoringStats {
  total_users: number;
  active_users: number;
  total_sessions: number;
  total_messages: number;
  online_now: number;
  total_tokens: number;
  total_images: number;
  avg_response_time: number;
  messages_last_hour: number;
  messages_last_24h: number;
}

interface UserActivity {
  user_id: string;
  ip_address: string;
  first_seen: string;
  last_seen: string;
  total_messages: number;
  total_sessions: number;
  is_active: boolean;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_images: number;
  avg_response_time_ms: number;
}

interface ActivityLogEntry {
  timestamp: string;
  user_id: string;
  action: string;
  details: string;
}

interface HourlyData {
  hour: string;
  messages: number;
  tokens: number;
  images: number;
  unique_users: number;
}

interface TokenUsage {
  date: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface Session {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface UserDetails {
  user_id: string;
  ip_address: string;
  first_seen: string;
  last_seen: string;
  total_messages: number;
  total_sessions: number;
  is_active: boolean;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_images: number;
  avg_response_time_ms: number;
  user_messages: number;
  assistant_messages: number;
  sessions: Session[];
}

interface ServerMetrics {
  cpu_usage: number;
  memory_usage: number;
  total_memory_mb: number;
  used_memory_mb: number;
  process_count: number;
}

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
  model?: string;
}

interface ModelUsage {
  model: string;
  messages: number;
  tokens: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ── SVG Chart Components ─────────────────────────────────────────────────────

function LineChart({ data, labels, colors, height = 120 }: { data: number[][]; labels: string[]; colors: string[]; height?: number }) {
  const allValues = data.flat();
  const max = Math.max(...allValues, 1);
  const w = 400;
  const h = height;
  const padding = { top: 10, right: 10, bottom: 25, left: 40 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const paths = data.map((series) => {
    if (series.length === 0) return "";
    return series
      .map((v, i) => {
        const x = padding.left + (i / (series.length - 1 || 1)) * chartW;
        const y = padding.top + chartH - (v / max) * chartH;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  });

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    y: padding.top + chartH - pct * chartH,
    label: Math.round(pct * max),
  }));

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {/* Grid lines */}
      {gridLines.map((line, i) => (
        <g key={i}>
          <line x1={padding.left} y1={line.y} x2={w - padding.right} y2={line.y} stroke="var(--border-2)" strokeDasharray="3,3" />
          <text x={padding.left - 5} y={line.y + 3} textAnchor="end" fill="var(--text-4)" fontSize="8">
            {formatNumber(line.label)}
          </text>
        </g>
      ))}
      {/* Data lines */}
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={colors[i]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* X labels */}
      {labels.filter((_, i) => i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1).map((label, i) => (
        <text
          key={i}
          x={padding.left + (labels.indexOf(label) / (labels.length - 1 || 1)) * chartW}
          y={h - 5}
          textAnchor="middle"
          fill="var(--text-4)"
          fontSize="7"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function DonutChart({ segments, size = 100 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const start = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    cumulative += seg.value;
    const end = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    const largeArc = seg.value / total > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    return { ...seg, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => (
        <path key={i} d={arc.path} fill={arc.color} opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--surface)" />
    </svg>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, subValue, color, trend }: {
  icon: any; label: string; value: number | string; subValue?: string; color: string; trend?: "up" | "down";
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[10px]" style={{ color: trend === "up" ? "#22c55e" : "#ef4444" }}>
            {trend === "up" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          </span>
        )}
      </div>
      <p className="hero-number-sm">{value}</p>
      <p className="text-[10px] mt-1 text-hint">{label}</p>
      {subValue && <p className="text-[10px] mt-0.5 text-hint">{subValue}</p>}
    </div>
  );
}

// ── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ active, icon: Icon, label, onClick }: { active: boolean; icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`tab-item ${active ? "active" : ""}`}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Monitoring() {
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics | null>(null);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [errorLog, setErrorLog] = useState<ActivityLogEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activity" | "analytics" | "system">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"messages" | "tokens" | "last_seen" | "images">("last_seen");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activityFilter, setActivityFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const [statsData, usersData, logData, hourly, tokens, metrics, models, errors] = await Promise.all([
        invoke<MonitoringStats>("llm_get_monitoring_stats"),
        invoke<UserActivity[]>("llm_get_all_users"),
        invoke<ActivityLogEntry[]>("llm_get_activity_log"),
        invoke<HourlyData[]>("llm_get_hourly_activity"),
        invoke<TokenUsage[]>("llm_get_token_usage_over_time"),
        invoke<ServerMetrics>("llm_get_server_metrics"),
        invoke<{ models: ModelUsage[] }>("llm_get_model_usage"),
        invoke<ActivityLogEntry[]>("llm_get_error_log"),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setActivityLog(logData);
      setHourlyData(hourly);
      setTokenUsage(tokens);
      setServerMetrics(metrics);
      setModelUsage(models.models ?? []);
      setErrorLog(errors);
    } catch (e) {
      console.error("Failed to fetch monitoring data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const loadUserDetails = async (userId: string) => {
    setSelectedUser(userId);
    setSelectedSession(null);
    setSessionMessages([]);
    try {
      const details = await invoke<UserDetails>("llm_get_user_details", { userId });
      setUserDetails(details);
    } catch (e) {
      console.error("Failed to load user details:", e);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    setSelectedSession(sessionId);
    try {
      const messages = await invoke<ChatMessage[]>("llm_get_session_messages", { sessionId });
      setSessionMessages(messages);
    } catch (e) {
      console.error("Failed to load session messages:", e);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user and all their sessions?")) return;
    try {
      await invoke("llm_admin_delete_user", { userId });
      fetchData();
      if (selectedUser === userId) {
        setSelectedUser(null);
        setUserDetails(null);
      }
    } catch (e) {
      console.error("Failed to delete user:", e);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Delete this session?")) return;
    try {
      await invoke("llm_admin_delete_session", { sessionId });
      fetchData();
      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setSessionMessages([]);
      }
      if (selectedUser) loadUserDetails(selectedUser);
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const exportData = () => {
    const data = {
      stats,
      users,
      activityLog,
      hourlyData,
      tokenUsage,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoring-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) => u.user_id.toLowerCase().includes(q) || u.ip_address.includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "messages": cmp = a.total_messages - b.total_messages; break;
        case "tokens": cmp = a.total_tokens - b.total_tokens; break;
        case "last_seen": cmp = new Date(a.last_seen).getTime() - new Date(b.last_seen).getTime(); break;
        case "images": cmp = a.total_images - b.total_images; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [users, searchQuery, sortBy, sortDir]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activityLog;
    if (activityFilter === "errors") return errorLog;
    return activityLog.filter((e) => e.action === activityFilter);
  }, [activityLog, activityFilter]);

  // Hourly chart data
  const hourlyMessages = hourlyData.map((h) => h.messages);
  const hourlyLabels = hourlyData.map((h) => h.hour);

  // Token chart data
  const tokenInput = tokenUsage.map((t) => t.input_tokens);
  const tokenOutput = tokenUsage.map((t) => t.output_tokens);
  const tokenLabels = tokenUsage.map((t) => t.date);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-hero">Monitoring</h1>
          <p className="text-xs mt-1 text-hint">Real-time dashboard with analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportData} className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]">
            <Download size={11} /> Export
          </button>
          <button onClick={fetchData} className="btn-glass flex items-center gap-2 px-3 py-1.5 text-xs">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? 0} color="#3b82f6" />
        <StatCard icon={Activity} label="Online Now" value={stats?.online_now ?? 0} color="#22c55e" />
        <StatCard icon={MessageSquare} label="Messages (24h)" value={stats?.messages_last_24h ?? 0} subValue={`${stats?.messages_last_hour ?? 0} last hour`} color="#3b82f6" />
        <StatCard icon={Zap} label="Total Tokens" value={formatTokens(stats?.total_tokens ?? 0)} color="#f59e0b" />
        <StatCard icon={Image} label="Images" value={stats?.total_images ?? 0} color="#8b5cf6" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4">
        <TabBtn active={activeTab === "overview"} icon={BarChart3} label="Overview" onClick={() => setActiveTab("overview")} />
        <TabBtn active={activeTab === "users"} icon={Users} label="Users" onClick={() => setActiveTab("users")} />
        <TabBtn active={activeTab === "activity"} icon={Activity} label="Activity" onClick={() => setActiveTab("activity")} />
        <TabBtn active={activeTab === "analytics"} icon={TrendingUp} label="Analytics" onClick={() => setActiveTab("analytics")} />
        <TabBtn active={activeTab === "system"} icon={Cpu} label="System" onClick={() => setActiveTab("system")} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex gap-4">
        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Message Activity (24h) */}
              <div className="glass-card-static p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Message Activity (24h)</span>
                  <span className="text-[10px]">{hourlyData.reduce((s, h) => s + h.messages, 0)} total</span>
                </div>
                <LineChart data={[hourlyMessages]} labels={hourlyLabels} colors={["#3b82f6"]} height={100} />
              </div>
              {/* Token Usage (7d) */}
              <div className="glass-card-static p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Token Usage (7 days)</span>
                  <span className="text-[10px]">{formatTokens(tokenUsage.reduce((s, t) => s + t.total_tokens, 0))} total</span>
                </div>
                <LineChart data={[tokenInput, tokenOutput]} labels={tokenLabels} colors={["#22c55e", "#f59e0b"]} height={100} />
              </div>
            </div>

            {/* System + Top Users */}
            <div className="grid grid-cols-3 gap-4">
              {/* System Resources */}
              <div className="glass-card-static p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">System Resources</span>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>CPU</span>
                      <span>{(serverMetrics?.cpu_usage ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-glass-border">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(serverMetrics?.cpu_usage ?? 0, 100)}%`, background: (serverMetrics?.cpu_usage ?? 0) > 80 ? "#ef4444" : "#3b82f6" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>Memory</span>
                      <span>{(serverMetrics?.memory_usage ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-glass-border">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(serverMetrics?.memory_usage ?? 0, 100)}%`, background: (serverMetrics?.memory_usage ?? 0) > 80 ? "#ef4444" : "#22c55e" }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>RAM: {serverMetrics?.used_memory_mb ?? 0}MB / {serverMetrics?.total_memory_mb ?? 0}MB</span>
                    <span>{serverMetrics?.process_count ?? 0} procs</span>
                  </div>
                </div>
              </div>

              {/* Top Users by Messages */}
              <div className="glass-card-static p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Top Users (Messages)</span>
                <div className="mt-3 space-y-2">
                  {[...users].sort((a, b) => b.total_messages - a.total_messages).slice(0, 5).map((u, i) => (
                    <div key={u.user_id} className="flex items-center gap-2">
                      <span className="text-[10px] w-3 text-center">{i + 1}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: u.is_active ? "#22c55e" : "var(--text-5)" }} />
                      <span className="flex-1 text-[10px] font-mono truncate">{u.user_id.slice(0, 10)}...</span>
                      <span className="text-[10px] font-medium">{u.total_messages}</span>
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-[10px]">No data</p>}
                </div>
              </div>

              {/* Top Users by Tokens */}
              <div className="glass-card-static p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Top Users (Tokens)</span>
                <div className="mt-3 space-y-2">
                  {[...users].sort((a, b) => b.total_tokens - a.total_tokens).slice(0, 5).map((u, i) => (
                    <div key={u.user_id} className="flex items-center gap-2">
                      <span className="text-[10px] w-3 text-center">{i + 1}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: u.is_active ? "#22c55e" : "var(--text-5)" }} />
                      <span className="flex-1 text-[10px] font-mono truncate">{u.user_id.slice(0, 10)}...</span>
                      <span className="text-[10px] font-medium">{formatTokens(u.total_tokens)}</span>
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-[10px]">No data</p>}
                </div>
              </div>
            </div>

            {/* Hourly Breakdown */}
            <div className="glass-card-static p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Hourly Breakdown</span>
              <div className="mt-3 grid grid-cols-24 gap-1">
                {hourlyData.map((h, i) => {
                  const maxMsg = Math.max(...hourlyData.map((x) => x.messages), 1);
                  const intensity = h.messages / maxMsg;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm transition-all duration-300"
                        style={{
                          height: `${Math.max(intensity * 40, 2)}px`,
                          background: `rgba(59,130,246,${0.2 + intensity * 0.8})`,
                        }}
                        title={`${h.hour}: ${h.messages} messages, ${formatTokens(h.tokens)} tokens`}
                      />
                      {i % 4 === 0 && <span className="text-[7px]">{h.hour.split(":")[0]}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ USERS TAB ═══ */}
        {activeTab === "users" && (
          <>
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search and Sort */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-input w-full pl-7 pr-3 py-1.5 text-xs"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X size={10} />
                    </button>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="glass-input px-2 py-1.5 text-[10px] cursor-pointer"
                >
                  <option value="last_seen">Last Seen</option>
                  <option value="messages">Messages</option>
                  <option value="tokens">Tokens</option>
                  <option value="images">Images</option>
                </select>
                <button
                  onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                  className="btn-glass p-1.5"
                >
                  {sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                </button>
              </div>

              {/* Users Table */}
              <div className="flex-1 overflow-y-auto glass-card-static">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-glass-border">
                      <th className="text-left p-2.5 font-medium">Status</th>
                      <th className="text-left p-2.5 font-medium">User ID</th>
                      <th className="text-left p-2.5 font-medium">IP</th>
                      <th className="text-right p-2.5 font-medium">Messages</th>
                      <th className="text-right p-2.5 font-medium">Tokens</th>
                      <th className="text-right p-2.5 font-medium">Images</th>
                      <th className="text-right p-2.5 font-medium">Avg Response</th>
                      <th className="text-left p-2.5 font-medium">Last Seen</th>
                      <th className="text-right p-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.user_id} className="transition-all cursor-pointer" style={{ borderBottom: "1px solid var(--border-1)", background: selectedUser === user.user_id ? "rgba(59,130,246,0.08)" : "transparent" }} onClick={() => loadUserDetails(user.user_id)}>
                        <td className="p-2.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: user.is_active ? "#22c55e" : "var(--text-5)" }} />
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">{user.user_id.slice(0, 12)}...</td>
                        <td className="p-2.5">{user.ip_address}</td>
                        <td className="p-2.5 text-right font-medium">{user.total_messages}</td>
                        <td className="p-2.5 text-right">{formatTokens(user.total_tokens)}</td>
                        <td className="p-2.5 text-right" style={{ color: user.total_images > 0 ? "#8b5cf6" : "var(--text-4)" }}>{user.total_images}</td>
                        <td className="p-2.5 text-right">{user.avg_response_time_ms > 0 ? `${(user.avg_response_time_ms / 1000).toFixed(1)}s` : "-"}</td>
                        <td className="p-2.5">{timeAgo(user.last_seen)}</td>
                        <td className="p-2.5 text-right">
                          <button onClick={(e) => { e.stopPropagation(); deleteUser(user.user_id); }} className="p-1 rounded transition-all hover:bg-red-500/10 text-red-400/60" title="Delete User">
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center">No users found</div>
                )}
              </div>
            </div>

            {/* User Detail Panel */}
            {selectedUser && userDetails && (
              <div className="w-96 overflow-y-auto glass-card-static">
                <div className="p-4 flex items-center justify-between border-b border-glass-border">
                  <div>
                    <span className="text-xs font-medium">User Details</span>
                    <span className="text-[10px] ml-2 font-mono">{userDetails.user_id.slice(0, 12)}...</span>
                  </div>
                  <button onClick={() => { setSelectedUser(null); setUserDetails(null); }} className="text-[10px]">Close</button>
                </div>

                {/* User Stats Grid */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg glass-card-static">
                    <p className="text-[9px] uppercase text-hint">Messages</p>
                    <p className="text-sm font-bold">{userDetails.total_messages}</p>
                    <p className="text-[9px]">{userDetails.user_messages} user / {userDetails.assistant_messages} assistant</p>
                  </div>
                  <div className="p-2 rounded-lg glass-card-static">
                    <p className="text-[9px] uppercase text-hint">Tokens</p>
                    <p className="text-sm font-bold">{formatTokens(userDetails.total_tokens)}</p>
                    <p className="text-[9px]">{formatTokens(userDetails.total_input_tokens)} in / {formatTokens(userDetails.total_output_tokens)} out</p>
                  </div>
                  <div className="p-2 rounded-lg glass-card-static">
                    <p className="text-[9px] uppercase text-hint">Images</p>
                    <p className="text-sm font-bold" style={{ color: "#8b5cf6" }}>{userDetails.total_images}</p>
                  </div>
                  <div className="p-2 rounded-lg glass-card-static">
                    <p className="text-[9px] uppercase text-hint">Avg Response</p>
                    <p className="text-sm font-bold">{userDetails.avg_response_time_ms > 0 ? `${(userDetails.avg_response_time_ms / 1000).toFixed(1)}s` : "-"}</p>
                  </div>
                  <div className="p-2 rounded-lg glass-card-static">
                    <p className="text-[9px] uppercase text-hint">Sessions</p>
                    <p className="text-sm font-bold">{userDetails.total_sessions}</p>
                  </div>
                  <div className="p-2 rounded-lg glass-card-static">
                    <p className="text-[9px] uppercase text-hint">Status</p>
                    <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: userDetails.is_active ? "#22c55e" : "var(--text-4)" }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: userDetails.is_active ? "#22c55e" : "var(--text-5)" }} />
                      {userDetails.is_active ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                {/* Sessions */}
                <div className="px-4 pb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2">Sessions ({userDetails.sessions.length})</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {userDetails.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-2 rounded-lg cursor-pointer transition-all"
                        style={{ background: selectedSession === session.id ? "rgba(59,130,246,0.08)" : "var(--bg-1)", border: "1px solid var(--border-1)" }}
                        onClick={() => loadSessionMessages(session.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium truncate flex-1">{session.title}</span>
                           <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-red-400/50">
                            <Trash2 size={9} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px]">{session.message_count} msgs</span>
                          <span className="text-[9px]">{timeAgo(session.updated_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ ACTIVITY TAB ═══ */}
        {activeTab === "activity" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Activity Filter */}
            <div className="flex items-center gap-2 mb-3">
              <Filter size={12} />
              {["all", "send_message", "create_session", "list_sessions", "delete_session", "errors"].map((f) => (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f)}
                  className={`tab-item ${activityFilter === f ? "active" : ""}`}
                >
                  {f === "all" ? "All" : f === "errors" ? "Errors" : f.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Activity Log */}
            <div className="flex-1 overflow-y-auto glass-card-static">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-glass-border">
                    <th className="text-left p-2.5 font-medium">Time</th>
                    <th className="text-left p-2.5 font-medium">User</th>
                    <th className="text-left p-2.5 font-medium">Action</th>
                    <th className="text-left p-2.5 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.slice(0, 200).map((entry, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-1)" }}>
                      <td className="p-2.5 whitespace-nowrap">{timeAgo(entry.timestamp)}</td>
                      <td className="p-2.5 font-mono text-[10px]">{entry.user_id.slice(0, 10)}...</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{
                          background: entry.action === "send_message" ? "rgba(59,130,246,0.15)" : entry.action === "create_session" ? "rgba(34,197,94,0.15)" : "var(--bg-3)",
                          color: entry.action === "send_message" ? "rgba(96,165,250,0.9)" : entry.action === "create_session" ? "rgba(74,222,128,0.9)" : "var(--text-4)",
                        }}>
                          {entry.action.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-2.5 truncate max-w-xs" style={{ color: "var(--text-4)" }}>{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredActivity.length === 0 && (
                <div className="p-8 text-center">No activity</div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === "analytics" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Response Time Distribution */}
              <div className="glass-card-static p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Response Time</span>
                <div className="mt-3 text-center">
                  <p className="text-3xl font-bold" style={{ color: stats?.avg_response_time ? "var(--text-1)" : "var(--text-4)" }}>
                    {stats?.avg_response_time ? `${(stats.avg_response_time / 1000).toFixed(1)}s` : "-"}
                  </p>
                  <p className="text-[10px] mt-1">Average</p>
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    { label: "< 1s", count: users.filter((u) => u.avg_response_time_ms > 0 && u.avg_response_time_ms < 1000).length, color: "#22c55e" },
                    { label: "1-3s", count: users.filter((u) => u.avg_response_time_ms >= 1000 && u.avg_response_time_ms < 3000).length, color: "#f59e0b" },
                    { label: "3-10s", count: users.filter((u) => u.avg_response_time_ms >= 3000 && u.avg_response_time_ms < 10000).length, color: "#f97316" },
                    { label: "> 10s", count: users.filter((u) => u.avg_response_time_ms >= 10000).length, color: "#ef4444" },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[9px] w-10">{b.label}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${users.length ? (b.count / users.length) * 100 : 0}%`, background: b.color }} />
                      </div>
                      <span className="text-[9px] w-4 text-right">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Type Breakdown */}
              <div className="glass-card-static p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Message Types</span>
                <div className="mt-4 flex justify-center">
                  <DonutChart
                    segments={[
                      { value: users.reduce((s, u) => s + u.total_messages, 0) - users.reduce((s, u) => s + u.total_images, 0), color: "#3b82f6", label: "Text" },
                      { value: users.reduce((s, u) => s + u.total_images, 0), color: "#8b5cf6", label: "Image" },
                    ]}
                    size={100}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
                    <span className="flex-1 text-[10px]">Text Messages</span>
                    <span className="text-[10px] font-medium">{users.reduce((s, u) => s + u.total_messages - u.total_images, 0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#8b5cf6" }} />
                    <span className="flex-1 text-[10px]">Image Messages</span>
                    <span className="text-[10px] font-medium">{users.reduce((s, u) => s + u.total_images, 0)}</span>
                  </div>
                </div>
              </div>

              {/* Token Distribution */}
              <div className="glass-card-static p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Token Distribution</span>
                <div className="mt-3 text-center">
                  <p className="text-xl font-bold" style={{ color: "var(--text-1)" }}>{formatTokens(stats?.total_tokens ?? 0)}</p>
                  <p className="text-[10px] mt-1">Total Tokens</p>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
                    <span className="flex-1 text-[10px]">Input</span>
                    <span className="text-[10px] font-medium">{formatTokens(users.reduce((s, u) => s + u.total_input_tokens, 0))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
                    <span className="flex-1 text-[10px]">Output</span>
                    <span className="text-[10px] font-medium">{formatTokens(users.reduce((s, u) => s + u.total_output_tokens, 0))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Per-User Token Usage Chart */}
            <div className="glass-card-static p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Per-User Token Usage</span>
              <div className="mt-3 space-y-2">
                {[...users].sort((a, b) => b.total_tokens - a.total_tokens).slice(0, 10).map((u) => {
                  const maxTokens = Math.max(...users.map((x) => x.total_tokens), 1);
                  const inputPct = (u.total_input_tokens / maxTokens) * 100;
                  const outputPct = (u.total_output_tokens / maxTokens) * 100;
                  return (
                    <div key={u.user_id} className="flex items-center gap-2">
                      <span className="w-24 text-[9px] font-mono truncate">{u.user_id.slice(0, 12)}...</span>
                      <div className="flex-1 h-3 rounded-sm overflow-hidden flex" style={{ background: "var(--bg-2)" }}>
                        <div className="h-full" style={{ width: `${inputPct}%`, background: "#22c55e", opacity: 0.8 }} />
                        <div className="h-full" style={{ width: `${outputPct}%`, background: "#f59e0b", opacity: 0.8 }} />
                      </div>
                       <span className="text-[9px] w-12 text-right">{formatTokens(u.total_tokens)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Model Usage */}
            <div className="glass-card-static p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Model Usage</span>
              <div className="mt-3 space-y-2">
                {modelUsage.length > 0 ? modelUsage.sort((a, b) => b.messages - a.messages).map((m) => {
                  const maxMsg = Math.max(...modelUsage.map((x) => x.messages), 1);
                  return (
                    <div key={m.model} className="flex items-center gap-2">
                      <span className="w-32 text-[9px] font-mono truncate" title={m.model}>{m.model.length > 18 ? m.model.slice(0, 18) + "..." : m.model}</span>
                      <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: "var(--bg-2)" }}>
                        <div className="h-full rounded-sm" style={{ width: `${(m.messages / maxMsg) * 100}%`, background: "#3b82f6", opacity: 0.8 }} />
                      </div>
                      <span className="text-[9px] w-12 text-right">{m.messages} msgs</span>
                      <span className="text-[9px] w-12 text-right">{formatTokens(m.tokens)}</span>
                    </div>
                  );
                }) : (
                  <p className="text-[10px] text-center py-4">No model data yet — start chatting to track usage</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SYSTEM TAB ═══ */}
        {activeTab === "system" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <StatCard icon={Cpu} label="CPU Usage" value={`${(serverMetrics?.cpu_usage ?? 0).toFixed(1)}%`} color="#3b82f6" />
              <StatCard icon={HardDrive} label="Memory" value={`${(serverMetrics?.memory_usage ?? 0).toFixed(1)}%`} subValue={`${serverMetrics?.used_memory_mb ?? 0}MB / ${serverMetrics?.total_memory_mb ?? 0}MB`} color="#22c55e" />
              <StatCard icon={Wifi} label="Processes" value={serverMetrics?.process_count ?? 0} color="#f59e0b" />
              <StatCard icon={Globe} label="Active Connections" value={stats?.online_now ?? 0} color="#8b5cf6" />
            </div>

            {/* Resource Gauges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card-static p-5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">CPU Usage</span>
                <div className="mt-4 flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg width="128" height="128" viewBox="0 0 128 128">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="var(--border-2)" strokeWidth="8" />
                      <circle
                        cx="64" cy="64" r="56" fill="none"
                        stroke={(serverMetrics?.cpu_usage ?? 0) > 80 ? "#ef4444" : "#3b82f6"}
                        strokeWidth="8"
                        strokeDasharray={`${((serverMetrics?.cpu_usage ?? 0) / 100) * 351.86} 351.86`}
                        strokeLinecap="round"
                        transform="rotate(-90 64 64)"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold" style={{ color: "var(--text-1)" }}>{(serverMetrics?.cpu_usage ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card-static p-5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Memory Usage</span>
                <div className="mt-4 flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg width="128" height="128" viewBox="0 0 128 128">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="var(--border-2)" strokeWidth="8" />
                      <circle
                        cx="64" cy="64" r="56" fill="none"
                        stroke={(serverMetrics?.memory_usage ?? 0) > 80 ? "#ef4444" : "#22c55e"}
                        strokeWidth="8"
                        strokeDasharray={`${((serverMetrics?.memory_usage ?? 0) / 100) * 351.86} 351.86`}
                        strokeLinecap="round"
                        transform="rotate(-90 64 64)"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold" style={{ color: "var(--text-1)" }}>{(serverMetrics?.memory_usage ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection List */}
            <div className="glass-card-static p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">Active Connections</span>
              <div className="mt-3 space-y-1.5">
                {users.filter((u) => u.is_active).map((u) => (
                  <div key={u.user_id} className="flex items-center gap-2 p-2 rounded-lg glass-card-static">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
                    <span className="text-[10px] font-mono flex-1">{u.user_id.slice(0, 12)}...</span>
                    <span className="text-[10px]">{u.ip_address}</span>
                    <span className="text-[10px]">{u.total_messages} msgs</span>
                  </div>
                ))}
                {users.filter((u) => u.is_active).length === 0 && (
                  <p className="text-[10px] text-center py-4">No active connections</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Session Messages Panel */}
        {selectedSession && (
          <div className="w-80 overflow-y-auto glass-card-static">
            <div className="p-3 flex items-center justify-between border-b border-glass-border">
              <span className="text-xs font-medium">Messages ({sessionMessages.length})</span>
              <button onClick={() => { setSelectedSession(null); setSessionMessages([]); }} className="text-[10px]">Close</button>
            </div>
            {sessionMessages.map((msg, i) => (
              <div key={i} className="p-3" style={{ borderBottom: "1px solid var(--border-1)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{
                    background: msg.role === "user" ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.15)",
                    color: msg.role === "user" ? "rgba(96,165,250,0.9)" : "rgba(96,165,250,0.9)",
                  }}>
                    {msg.role}
                  </span>
                  {msg.model && <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: "var(--bg-3)", color: "var(--text-4)" }}>{msg.model.length > 20 ? msg.model.slice(0, 20) + "..." : msg.model}</span>}
                  {msg.timestamp && <span className="text-[9px]">{timeAgo(msg.timestamp)}</span>}
                </div>
                <p className="text-[10px] whitespace-pre-wrap" style={{ color: "var(--text-3)" }}>
                  {msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
