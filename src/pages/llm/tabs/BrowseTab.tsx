import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  ArrowUpDown,
  Loader,
  X,
  Filter,
  TrendingUp,
  Star,
} from "lucide-react";
import type {
  ModelInfo,
  RecommendedModel,
  HfModel,
  HfFile,
  KnownOwner,
  DownloadProgress,
} from "../types";
import { formatSize } from "../format";

function QuantBadge({ quant }: { quant: string }) {
  return (
    <span className="badge-blue text-[10px] font-medium px-1.5 py-0.5 rounded">
      {quant}
    </span>
  );
}

type SortKey = "downloads" | "likes" | "name";

interface BrowseTabProps {
  installed: ModelInfo[];
  downloads: Record<string, DownloadProgress>;
  favorites: string[];
  owners: KnownOwner[];
  preferredOwners: string[];
  onStartDownload: (repoId: string, file: HfFile) => void;
  onResumeDownload: (filename: string) => void;
  onAbortDownload: (filename: string) => void;
  onNavigateToInstalled?: () => void;
}

export default function BrowseTab({
  installed,
  downloads,
  favorites: _favorites,
  owners,
  preferredOwners: _preferredOwners,
  onStartDownload,
  onResumeDownload,
  onAbortDownload,
  onNavigateToInstalled: _onNavigateToInstalled,
}: BrowseTabProps) {
  const [subTab, setSubTab] = useState<"recommended" | "browse" | "owners">("recommended");
  const [recommended, setRecommended] = useState<RecommendedModel[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<HfModel[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [repoFiles, setRepoFiles] = useState<Record<string, HfFile[]>>({});
  const [repoLoading, setRepoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("downloads");
  const [mmProjPicker, setMmProjPicker] = useState<{
    repoId: string;
    file: HfFile;
    mmProjFiles: HfFile[];
  } | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
  const [ownerModels, setOwnerModels] = useState<HfModel[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [selectedOwnerForBrowse, setSelectedOwnerForBrowse] = useState<string | null>(null);

  const loadRecommended = useCallback(async () => {
    setRecommendedLoading(true);
    setError(null);
    try {
      const rec = await invoke<RecommendedModel[]>("llm_get_recommended_models");
      setRecommended(rec);
    } catch (e) {
      setError(String(e));
    } finally {
      setRecommendedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommended();
  }, [loadRecommended]);

  const doSearch = async () => {
    if (!searchQuery.trim() && !selectedOwner) return;
    setSearching(true);
    setError(null);
    try {
      const results = await invoke<HfModel[]>("llm_search_hf_models", {
        query: searchQuery.trim(),
        owner: selectedOwner || null,
      });
      setSearchResults(results);
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  };

  const loadOwnerModels = async (ownerId: string) => {
    if (selectedOwnerForBrowse === ownerId) {
      setSelectedOwnerForBrowse(null);
      setOwnerModels([]);
      return;
    }
    setSelectedOwnerForBrowse(ownerId);
    setOwnerLoading(true);
    setError(null);
    try {
      const results = await invoke<HfModel[]>("llm_search_hf_models", {
        query: "",
        owner: ownerId,
      });
      setOwnerModels(results);
    } catch (e) {
      setError(String(e));
    } finally {
      setOwnerLoading(false);
    }
  };

  const toggleRepo = async (repoId: string) => {
    if (expandedRepo === repoId) {
      setExpandedRepo(null);
      return;
    }
    setExpandedRepo(repoId);
    if (!repoFiles[repoId]) {
      setRepoLoading(repoId);
      try {
        const files = await invoke<HfFile[]>("llm_get_hf_repo_files", { repoId });
        setRepoFiles((prev) => ({ ...prev, [repoId]: files }));
      } catch (e) {
        setError(String(e));
      } finally {
        setRepoLoading(null);
      }
    }
  };

  const startDownload = async (
    repoId: string,
    file: HfFile,
    companionModel?: string
  ) => {
    onStartDownload(repoId, file);
    try {
      await invoke("llm_download_model", {
        repoId,
        filename: file.filename,
        downloadUrl: file.download_url,
        sizeBytes: file.size_bytes,
        splitParts: file.is_split && file.split_parts.length > 0 ? file.split_parts : null,
        companionModel: companionModel ?? null,
      });
    } catch (e) {
      if (!String(e).includes("failed after")) {
        setError(String(e));
      }
    }
  };

  const handleDownloadClick = (repoId: string, file: HfFile) => {
    const files = repoFiles[repoId] || [];
    const mmProjFiles = files.filter((f) => f.is_mmproj);
    if (mmProjFiles.length > 0 && !file.is_mmproj) {
      setMmProjPicker({ repoId, file, mmProjFiles });
    } else {
      startDownload(repoId, file);
    }
  };

  const handleMmProjChoice = (mmProjFile: HfFile | null) => {
    if (!mmProjPicker) return;
    const { repoId, file } = mmProjPicker;
    setMmProjPicker(null);
    startDownload(repoId, file);
    if (mmProjFile) {
      startDownload(repoId, mmProjFile, file.filename);
    }
  };

  const resumeDownload = async (filename: string) => {
    onResumeDownload(filename);
    try {
      await invoke("llm_download_model", {
        repoId: null,
        filename,
        downloadUrl: null,
        sizeBytes: 0,
        splitParts: null,
        companionModel: null,
      });
    } catch (e) {
      if (!String(e).includes("failed after")) {
        setError(String(e));
      }
    }
  };

  const abortDownload = async (filename: string) => {
    onAbortDownload(filename);
    try {
      await invoke("llm_abort_download", { filename });
    } catch (e) {
      setError(String(e));
    }
  };

  const startRecommendedDownload = (m: RecommendedModel) => {
    startDownload(m.repo_id, {
      filename: m.filename,
      size_bytes: m.estimated_size_mb * 1024 * 1024,
      quant: m.quant,
      download_url: `https://huggingface.co/${m.repo_id}/resolve/main/${m.filename}`,
      is_split: false,
      split_parts: [],
      is_mmproj: false,
    });
  };

  const sortedSearchResults = useMemo(() => {
    const sorted = [...searchResults];
    if (sortKey === "downloads") sorted.sort((a, b) => b.downloads - a.downloads);
    else if (sortKey === "likes") sorted.sort((a, b) => b.likes - a.likes);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [searchResults, sortKey]);

  const filteredOwnerModels = useMemo(() => {
    if (!ownerSearchQuery.trim()) return ownerModels;
    const q = ownerSearchQuery.toLowerCase();
    return ownerModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.repo_id.toLowerCase().includes(q)
    );
  }, [ownerModels, ownerSearchQuery]);

  const filteredOwners = useMemo(() => {
    if (!ownerSearchQuery.trim()) return owners;
    const q = ownerSearchQuery.toLowerCase();
    return owners.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
    );
  }, [owners, ownerSearchQuery]);

  const renderFileList = (repoId: string) => {
    const files = repoFiles[repoId];
    if (!files) return null;
    const ggufFiles = files.filter((f) => !f.is_mmproj);
    if (ggufFiles.length === 0) {
      return (
        <p className="text-xs px-2" style={{ color: "var(--text-5)" }}>
          No GGUF files in this repo.
        </p>
      );
    }
    return ggufFiles.map((f) => {
      const dl = downloads[f.filename];
      const hfBasename = f.filename.includes("/") ? f.filename.split("/").pop()! : f.filename;
      const isInstalled = installed.some((m) => m.filename === hfBasename);
      return (
        <div
          key={f.filename}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-1)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono truncate block" style={{ color: "var(--text-2)" }}>
              {f.filename}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {f.quant && <QuantBadge quant={f.quant} />}
              {f.is_split && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--text-4)" }}>
                  {f.split_parts.length} parts
                </span>
              )}
            </div>
          </div>
          <span className="text-xs shrink-0" style={{ color: "var(--text-5)" }}>
            {formatSize(f.size_bytes)}
          </span>
          {isInstalled ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(34,197,94,0.12)", color: "rgba(34,197,94,0.9)" }}>
              Installed
            </span>
          ) : dl ? (
            <div className="shrink-0 flex items-center gap-2">
              {dl.status === "paused" ? (
                <>
                  <span className="text-[10px]" style={{ color: "rgba(245,158,11,0.9)" }}>Paused {dl.percent.toFixed(0)}%</span>
                  <button className="text-[10px] font-medium px-2 py-0.5 rounded-lg transition-all duration-200 hover:scale-105" style={{ background: "rgba(59,130,246,0.15)", color: "rgba(96,165,250,0.9)" }} onClick={() => resumeDownload(f.filename)}>Resume</button>
                  <button className="text-[10px] font-medium px-2 py-0.5 rounded-lg transition-all duration-200 hover:scale-105" style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.9)" }} onClick={() => abortDownload(f.filename)}>Abort</button>
                </>
              ) : (
                <div className="w-20">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${dl.percent}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }} />
                  </div>
                  {dl.status.startsWith("retrying") && (
                    <span className="text-[10px]" style={{ color: "rgba(245,158,11,0.9)" }}>{dl.status}</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-105 shrink-0"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}
              onClick={() => handleDownloadClick(repoId, f)}
            >
              <Download size={11} />
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="mb-4 glass-card-static p-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p className="text-sm" style={{ color: "rgba(239,68,68,0.9)" }}>{error}</p>
          <button className="text-xs mt-1 transition-all duration-200 hover:scale-105" style={{ color: "rgba(239,68,68,0.6)" }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Active downloads */}
      {Object.keys(downloads).length > 0 && (
        <div className="mb-4 glass-card-static p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(91,168,245,0.1)", border: "1px solid rgba(91,168,245,0.15)" }}>
              <Download size={14} style={{ color: "rgba(91,168,245,0.8)" }} />
            </div>
            <span className="text-primary-label">Downloading</span>
          </div>
          <div className="space-y-3">
            {Object.entries(downloads).map(([filename, dl]) => (
              <div key={filename}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs truncate mr-3" style={{ color: "var(--text-2)" }}>{filename}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {dl.status === "paused" ? (
                      <>
                        <span className="text-[10px]" style={{ color: "rgba(245,158,11,0.9)" }}>Paused</span>
                        <button className="text-[10px] font-medium px-2 py-0.5 rounded-lg transition-all duration-200 hover:scale-105" style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.9)" }} onClick={() => abortDownload(filename)}>Abort</button>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-4)" }}>{dl.percent.toFixed(1)}%</span>
                        <span className="text-[10px]" style={{ color: "var(--text-5)" }}>{formatSize(dl.bytes_downloaded)} / {formatSize(dl.total_bytes)}</span>
                      </>
                    )}
                  </div>
                </div>
                {dl.status !== "paused" && (
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${dl.percent}%`, background: "linear-gradient(90deg, #5BA8F5, #7FBFF8)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex gap-2">
        <button onClick={() => { setSubTab("recommended"); if (recommended.length === 0) loadRecommended(); }} className={`tab-item ${subTab === "recommended" ? "active" : ""}`}>
          <Star size={12} className="inline mr-1" />
          Recommended
        </button>
        <button onClick={() => setSubTab("browse")} className={`tab-item ${subTab === "browse" ? "active" : ""}`}>
          <Search size={12} className="inline mr-1" />
          Search
        </button>
        <button onClick={() => setSubTab("owners")} className={`tab-item ${subTab === "owners" ? "active" : ""}`}>
          <TrendingUp size={12} className="inline mr-1" />
          By Owner
        </button>
      </div>

      {/* ─── Recommended sub-tab ──────────────────────────────── */}
      {subTab === "recommended" && (
        <div className="space-y-3">
          {recommendedLoading ? (
            <div className="text-center py-16">
              <Loader size={24} className="mx-auto mb-3 animate-spin" style={{ color: "var(--text-5)" }} />
              <p className="text-sm text-hint">Loading recommended models...</p>
            </div>
          ) : recommended.length === 0 ? (
            <div className="text-center py-16 glass-card-static">
              <Star size={28} className="mx-auto mb-4 text-hint" />
              <p className="text-sm text-hint">No recommended models available.</p>
              <button className="btn-accent mt-3 !text-[11px]" onClick={loadRecommended}>Retry</button>
            </div>
          ) : (
            recommended.map((m) => {
              const dl = downloads[m.filename];
              const isDownloading = !!dl;
              return (
                <div key={m.filename} className="glass-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{m.name}</span>
                        <QuantBadge quant={m.quant} />
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--text-4)" }}>{m.params_b}B params</span>
                        {m.context != null && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--text-4)" }}>ctx {(m.context / 1024).toFixed(0)}K</span>
                        )}
                        {m.installed && (
                          <span className="badge-green text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle size={9} /> Installed
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "var(--text-4)" }}>{m.description}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs font-mono" style={{ color: "var(--text-5)" }}>{m.repo_id}</p>
                        <a
                          href={`https://huggingface.co/${m.repo_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] flex items-center gap-0.5 transition-colors hover:text-primary"
                          style={{ color: "var(--text-5)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={9} /> HF
                        </a>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-xs" style={{ color: "var(--text-5)" }}>~{formatSize(m.estimated_size_mb * 1024 * 1024)}</span>
                      {!m.installed && !isDownloading && (
                        <button className="btn-accent !px-3 !py-1.5 !text-[11px]" onClick={() => startRecommendedDownload(m)}>
                          <Download size={11} /> Download
                        </button>
                      )}
                      {m.installed && (
                        <span className="text-xs flex items-center gap-1" style={{ color: "rgba(34,197,94,0.9)" }}>
                          <CheckCircle size={11} /> Ready
                        </span>
                      )}
                    </div>
                  </div>
                  {isDownloading && (
                    <div className="mt-3">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span style={{ color: "var(--text-4)" }}>
                          {dl.status === "paused" ? "Paused" : dl.status.startsWith("retrying") ? `Retrying... (${dl.status})` : dl.status === "extracting" ? "Extracting..." : "Downloading..."}
                        </span>
                        <span className="font-mono" style={{ color: "var(--text-4)" }}>{dl.percent.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${dl.percent}%`, background: dl.status === "paused" ? "rgba(245,158,11,0.7)" : "linear-gradient(90deg, #5BA8F5, #7FBFF8)" }} />
                      </div>
                      {dl.status === "paused" && (
                        <div className="flex gap-2 mt-2">
                          <button className="btn-accent !px-3 !py-1.5 !text-[11px]" onClick={() => resumeDownload(m.filename)}>Resume</button>
                          <button className="btn-danger !px-3 !py-1.5 !text-[11px]" onClick={() => abortDownload(m.filename)}>Abort</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Browse (Search) sub-tab ──────────────────────────── */}
      {subTab === "browse" && (
        <div className="space-y-4">
          <div className="flex gap-3 p-4 glass-card-static">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-hint" />
              <input
                className="glass-input !pl-9"
                placeholder="Search GGUF models (e.g. llama 3, mistral, qwen 72b)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
              />
            </div>
            <select
              className="glass-input w-48 cursor-pointer"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
            >
              <option value="" style={{ background: "var(--surface)" }}>Any owner</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id} style={{ background: "var(--surface)" }}>{o.id}</option>
              ))}
            </select>
            <button className="btn-accent" onClick={doSearch} disabled={searching}>
              {searching ? <Loader size={12} className="animate-spin" /> : "Search"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-hint">{searchResults.length} results</span>
              <div className="flex items-center gap-2">
                <Filter size={11} className="text-hint" />
                <button onClick={() => setSortKey("downloads")} className={`text-[10px] px-2 py-0.5 rounded transition-colors ${sortKey === "downloads" ? "bg-primary/10 text-primary" : "text-hint hover:text-secondary"}`}>
                  <TrendingUp size={10} className="inline mr-0.5" /> Downloads
                </button>
                <button onClick={() => setSortKey("likes")} className={`text-[10px] px-2 py-0.5 rounded transition-colors ${sortKey === "likes" ? "bg-primary/10 text-primary" : "text-hint hover:text-secondary"}`}>
                  <Star size={10} className="inline mr-0.5" /> Likes
                </button>
                <button onClick={() => setSortKey("name")} className={`text-[10px] px-2 py-0.5 rounded transition-colors ${sortKey === "name" ? "bg-primary/10 text-primary" : "text-hint hover:text-secondary"}`}>
                  <ArrowUpDown size={10} className="inline mr-0.5" /> Name
                </button>
              </div>
            </div>
          )}

          {searching ? (
            <div className="text-center py-16">
              <Loader size={24} className="mx-auto mb-3 animate-spin" style={{ color: "var(--text-5)" }} />
              <p className="text-sm text-hint">Searching HuggingFace...</p>
            </div>
          ) : sortedSearchResults.length > 0 ? (
            <div className="space-y-2">
              {sortedSearchResults.map((model) => (
                <div key={model.repo_id} className="glass-card-static p-5">
                  <button className="w-full flex items-start gap-4 text-left" onClick={() => toggleRepo(model.repo_id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>{model.name}</span>
                        <span className="text-xs" style={{ color: "var(--text-4)" }}>by {model.author}</span>
                        <a
                          href={`https://huggingface.co/${model.repo_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] flex items-center gap-0.5 transition-colors hover:text-primary"
                          style={{ color: "var(--text-5)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={9} /> HF
                        </a>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs" style={{ color: "var(--text-4)" }}>
                        <span><TrendingUp size={10} className="inline mr-0.5" />{model.downloads >= 1000000 ? `${(model.downloads / 1000000).toFixed(1)}M` : `${(model.downloads / 1000).toFixed(0)}K`}</span>
                        <span><Star size={10} className="inline mr-0.5" />{model.likes}</span>
                        <span>{model.files.length} GGUF files</span>
                      </div>
                    </div>
                    {expandedRepo === model.repo_id ? (
                      <ChevronUp size={14} style={{ color: "var(--text-4)" }} className="mt-0.5 shrink-0" />
                    ) : (
                      <ChevronDown size={14} style={{ color: "var(--text-4)" }} className="mt-0.5 shrink-0" />
                    )}
                  </button>

                  {expandedRepo === model.repo_id && (
                    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--border-2)" }}>
                      {repoLoading === model.repo_id ? (
                        <div className="flex items-center gap-2 px-2 py-3">
                          <Loader size={12} className="animate-spin" style={{ color: "var(--text-5)" }} />
                          <span className="text-xs" style={{ color: "var(--text-5)" }}>Loading files...</span>
                        </div>
                      ) : repoFiles[model.repo_id] ? (
                        renderFileList(model.repo_id)
                      ) : (
                        <p className="text-xs px-2" style={{ color: "var(--text-5)" }}>Loading files...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : searchQuery || selectedOwner ? (
            <div className="text-center py-16 glass-card-static">
              <Search size={28} className="mx-auto mb-4 text-hint" />
              <p className="text-sm text-hint">No results found.</p>
              <p className="text-xs mt-1 text-hint">Try different keywords or another owner.</p>
            </div>
          ) : (
            <div className="text-center py-16 glass-card-static">
              <Search size={28} className="mx-auto mb-4 text-hint" />
              <p className="text-sm text-hint">Search for GGUF models on HuggingFace.</p>
              <p className="text-xs mt-1 text-hint">Try "llama 3", "mistral", or select an owner to browse.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Owners sub-tab ───────────────────────────────────── */}
      {subTab === "owners" && (
        <div className="space-y-4">
          <div className="p-4 glass-card-static">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-hint" />
              <input
                className="glass-input !pl-9"
                placeholder="Filter owners..."
                value={ownerSearchQuery}
                onChange={(e) => setOwnerSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOwners.map((owner) => {
              const isSelected = selectedOwnerForBrowse === owner.id;
              return (
                <button
                  key={owner.id}
                  className={`glass-card-static p-4 text-left transition-all duration-200 hover:scale-[1.01] ${isSelected ? "ring-1 ring-primary/30" : ""}`}
                  onClick={() => loadOwnerModels(owner.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{owner.id}</span>
                    {isSelected && <Loader size={11} className="animate-spin" style={{ color: "var(--text-4)" }} />}
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{owner.description}</p>
                </button>
              );
            })}
          </div>

          {selectedOwnerForBrowse && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium" style={{ color: "var(--text-1)" }}>
                  Models from <span className="text-primary">{selectedOwnerForBrowse}</span>
                </h3>
                <button className="text-xs text-hint hover:text-secondary" onClick={() => { setSelectedOwnerForBrowse(null); setOwnerModels([]); }}>
                  <X size={12} className="inline mr-0.5" /> Clear
                </button>
              </div>
              {ownerLoading ? (
                <div className="text-center py-12">
                  <Loader size={20} className="mx-auto mb-2 animate-spin" style={{ color: "var(--text-5)" }} />
                  <p className="text-xs text-hint">Loading models from {selectedOwnerForBrowse}...</p>
                </div>
              ) : filteredOwnerModels.length > 0 ? (
                filteredOwnerModels.map((model) => (
                  <div key={model.repo_id} className="glass-card-static p-4">
                    <button className="w-full flex items-start gap-3 text-left" onClick={() => toggleRepo(model.repo_id)}>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block" style={{ color: "var(--text-1)" }}>{model.name}</span>
                        <div className="flex gap-3 mt-1 text-[11px]" style={{ color: "var(--text-4)" }}>
                          <span><TrendingUp size={9} className="inline mr-0.5" />{model.downloads >= 1000000 ? `${(model.downloads / 1000000).toFixed(1)}M` : `${(model.downloads / 1000).toFixed(0)}K`}</span>
                          <span><Star size={9} className="inline mr-0.5" />{model.likes}</span>
                          <span>{model.files.length} GGUF files</span>
                        </div>
                      </div>
                      {expandedRepo === model.repo_id ? (
                        <ChevronUp size={13} style={{ color: "var(--text-4)" }} className="shrink-0" />
                      ) : (
                        <ChevronDown size={13} style={{ color: "var(--text-4)" }} className="shrink-0" />
                      )}
                    </button>
                    {expandedRepo === model.repo_id && (
                      <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--border-2)" }}>
                        {repoLoading === model.repo_id ? (
                          <div className="flex items-center gap-2 px-2 py-3">
                            <Loader size={12} className="animate-spin" style={{ color: "var(--text-5)" }} />
                            <span className="text-xs" style={{ color: "var(--text-5)" }}>Loading files...</span>
                          </div>
                        ) : repoFiles[model.repo_id] ? (
                          renderFileList(model.repo_id)
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-hint">No models found for this owner.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* mmproj picker modal */}
      {mmProjPicker && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={() => setMmProjPicker(null)}>
          <div className="max-w-md w-full mx-4 space-y-4 p-6 rounded-2xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-3)", backdropFilter: "blur(24px)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Download options</h3>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>This repo contains vision projection (mmproj) files. Download them alongside the model for vision support.</p>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 hover:scale-[1.01]" style={{ background: "var(--bg-2)", border: "1px solid var(--bg-3)", color: "var(--text-2)" }} onClick={() => handleMmProjChoice(null)}>
                Just the model
                <span className="text-xs ml-2" style={{ color: "var(--text-4)" }}>{formatSize(mmProjPicker.file.size_bytes)}</span>
              </button>
              {mmProjPicker.mmProjFiles.map((mp) => (
                <button key={mp.filename} className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 hover:scale-[1.01]" style={{ background: "var(--bg-2)", border: "1px solid var(--bg-3)", color: "var(--text-2)" }} onClick={() => handleMmProjChoice(mp)}>
                  Model + {mp.filename}
                  <span className="text-xs ml-2" style={{ color: "var(--text-4)" }}>{formatSize(mmProjPicker.file.size_bytes + mp.size_bytes)}</span>
                </button>
              ))}
            </div>
            <button className="w-full text-[11px] font-medium py-2 rounded-xl transition-all duration-200 hover:scale-[1.01]" style={{ background: "var(--bg-2)", color: "var(--text-4)" }} onClick={() => setMmProjPicker(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
