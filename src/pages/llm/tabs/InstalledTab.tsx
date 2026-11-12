import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Download,
  Trash2,
  HardDrive,
  Star,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react";
import type { ModelInfo, DownloadProgress } from "../types";
import { formatSize, quantSortKey, isImatrixFile } from "../format";

type SortCol = "name" | "params" | "quant" | "size" | "ctx";
type SortDir = "asc" | "desc";

function QuantBadge({ quant }: { quant: string }) {
  return (
    <span className="badge-blue text-[10px] font-medium px-1.5 py-0.5 rounded">
      {quant}
    </span>
  );
}

interface InstalledTabProps {
  installed: ModelInfo[];
  favorites: string[];
  downloads: Record<string, DownloadProgress>;
  onToggleFavorite: (id: string) => void;
  onDeleteModel: (path: string) => void;
  onSelectForServer?: (path: string) => void;
  selectedModel?: string | null;
  onNavigateToBrowse?: () => void;
}

export default function InstalledTab({
  installed,
  favorites,
  downloads,
  onToggleFavorite,
  onDeleteModel,
  onSelectForServer: _onSelectForServer,
  selectedModel: _selectedModel,
  onNavigateToBrowse,
}: InstalledTabProps) {
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [explicitSort, setExplicitSort] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [quantFilter, setQuantFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteModel = async (m: ModelInfo) => {
    setDeletingId(m.id);
    try {
      await invoke("llm_delete_model", { path: m.path });
      onDeleteModel(m.path);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = installed
    .filter((m) => !isImatrixFile(m.filename))
    .filter(
      (m) =>
        !nameFilter ||
        m.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
        m.filename.toLowerCase().includes(nameFilter.toLowerCase())
    )
    .filter(
      (m) =>
        !quantFilter ||
        (m.quant ?? "").toLowerCase().includes(quantFilter.toLowerCase())
    );

  const sorted = [...filtered].sort((a, b) => {
    if (!explicitSort) {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
    }
    let cmp = 0;
    switch (sortCol) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "params":
        cmp =
          parseFloat(a.params_b ?? "0") - parseFloat(b.params_b ?? "0");
        break;
      case "quant":
        cmp = quantSortKey(a.quant) - quantSortKey(b.quant);
        break;
      case "size":
        cmp = a.size_bytes - b.size_bytes;
        break;
      case "ctx":
        cmp = (a.context_length ?? 0) - (b.context_length ?? 0);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setExplicitSort(true);
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? (
      sortDir === "asc" ? (
        <ArrowUp size={10} />
      ) : (
        <ArrowDown size={10} />
      )
    ) : (
      <ArrowUp size={10} className="opacity-0 group-hover:opacity-30" />
    );

  return (
    <div>
      {/* Active downloads */}
      {Object.keys(downloads).length > 0 && (
        <div className="mb-4 glass-card-static p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(91,168,245,0.1)",
                border: "1px solid rgba(91,168,245,0.15)",
              }}
            >
              <Download
                size={14}
                style={{ color: "rgba(91,168,245,0.8)" }}
              />
            </div>
            <span className="text-primary-label">Downloading</span>
          </div>
          <div className="space-y-3">
            {Object.entries(downloads).map(([filename, dl]) => (
              <div key={filename}>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xs truncate mr-3"
                    style={{ color: "var(--text-2)" }}
                  >
                    {filename}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {dl.status === "paused" ? (
                      <>
                        <span
                          className="text-[10px]"
                          style={{ color: "rgba(245,158,11,0.9)" }}
                        >
                          Paused
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: "var(--text-4)" }}
                        >
                          {dl.percent.toFixed(1)}%
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--text-5)" }}
                        >
                          {formatSize(dl.bytes_downloaded)} /{" "}
                          {formatSize(dl.total_bytes)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {dl.status !== "paused" && (
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "var(--bg-3)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${dl.percent}%`,
                        background:
                          "linear-gradient(90deg, #5BA8F5, #7FBFF8)",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {installed.length === 0 ? (
        <div className="text-center py-16 glass-card-static">
          <HardDrive size={36} className="mx-auto mb-4 text-hint" />
          <p className="text-sm text-hint">No models installed yet.</p>
          {onNavigateToBrowse && (
            <button
              className="text-sm mt-2 transition-all duration-200 hover:scale-105"
              style={{ color: "rgba(91,168,245,0.9)" }}
              onClick={onNavigateToBrowse}
            >
              Browse recommended models →
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Filter row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <Filter size={12} className="text-hint" />
              <input
                className="glass-input text-xs !py-1.5 !px-3 flex-1"
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <input
              className="glass-input text-xs !py-1.5 !px-3 w-28"
              placeholder="Quant…"
              value={quantFilter}
              onChange={(e) => setQuantFilter(e.target.value)}
            />
            <span className="text-xs" style={{ color: "var(--text-5)" }}>
              {sorted.length} model{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 select-none"
            style={{ borderBottom: "1px solid var(--border-2)" }}
          >
            <button
              className="w-6 flex justify-center"
              title="Reset to favorites-first"
              onClick={() => {
                setSortCol("name");
                setSortDir("asc");
                setExplicitSort(false);
              }}
            >
              <Star
                size={10}
                style={{
                  color: explicitSort
                    ? "var(--text-5)"
                    : "rgba(245,158,11,0.8)",
                }}
              />
            </button>
            <button
              className="flex-1 flex items-center gap-1 group text-left text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-4)" }}
              onClick={() => toggleSort("name")}
            >
              Model <SortIcon col="name" />
            </button>
            <button
              className="w-16 flex items-center gap-1 group justify-end text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-4)" }}
              onClick={() => toggleSort("params")}
            >
              Params <SortIcon col="params" />
            </button>
            <button
              className="w-20 flex items-center gap-1 group justify-end text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-4)" }}
              onClick={() => toggleSort("quant")}
            >
              Quant <SortIcon col="quant" />
            </button>
            <button
              className="w-16 flex items-center gap-1 group justify-end text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-4)" }}
              onClick={() => toggleSort("ctx")}
            >
              Ctx <SortIcon col="ctx" />
            </button>
            <button
              className="w-20 flex items-center gap-1 group justify-end text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-4)" }}
              onClick={() => toggleSort("size")}
            >
              Size <SortIcon col="size" />
            </button>
            <span className="w-8" />
          </div>

          {/* Table rows */}
          <div>
            {sorted.map((m) => {
              const isFav = favorites.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-4 py-2.5 transition-all duration-150"
                  style={{ borderBottom: "1px solid var(--border-1)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <button
                    className="w-6 flex justify-center shrink-0 transition-all duration-200 hover:scale-110"
                    onClick={() => onToggleFavorite(m.id)}
                    title={
                      isFav ? "Remove from favorites" : "Add to favorites"
                    }
                  >
                    <Star
                      size={13}
                      className={isFav ? "fill-accent-yellow" : ""}
                      style={{
                        color: isFav
                          ? "rgba(245,158,11,0.9)"
                          : "var(--text-5)",
                      }}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: "var(--text-1)" }}
                    >
                      {m.name}
                    </p>
                    <p
                      className="text-[10px] truncate font-mono"
                      style={{ color: "var(--text-5)" }}
                    >
                      {m.filename}
                    </p>
                  </div>
                  <span
                    className="w-16 text-right text-xs"
                    style={{ color: "var(--text-4)" }}
                  >
                    {m.params_b ?? "—"}
                  </span>
                  <span className="w-20 text-right">
                    {m.quant ? (
                      <QuantBadge quant={m.quant} />
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-5)" }}
                      >
                        —
                      </span>
                    )}
                  </span>
                  <span
                    className="w-16 text-right text-xs"
                    style={{ color: "var(--text-4)" }}
                  >
                    {m.context_length
                      ? `${(m.context_length / 1024).toFixed(0)}K`
                      : "—"}
                  </span>
                  <span
                    className="w-20 text-right text-xs font-mono"
                    style={{ color: "var(--text-4)" }}
                  >
                    {formatSize(m.size_bytes)}
                  </span>
                  <button
                    className="w-8 flex justify-center transition-all duration-200 hover:scale-110"
                    style={{ color: "var(--text-5)" }}
                    onClick={() => deleteModel(m)}
                    disabled={deletingId === m.id}
                    title="Delete model"
                  >
                    <Trash2
                      size={13}
                      className="hover:!text-accent-red"
                    />
                  </button>
                </div>
              );
            })}
            {sorted.length === 0 &&
              filtered.length === 0 &&
              installed.length > 0 && (
                <p
                  className="text-sm py-8 text-center"
                  style={{ color: "var(--text-5)" }}
                >
                  No models match the filter.
                </p>
              )}
          </div>
        </>
      )}
    </div>
  );
}
