import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  HardDrive,
  FolderPlus,
  FolderOpen,
  Star,
  Trash2,
} from "lucide-react";
import PreferredOwners from "../PreferredOwners";

interface SettingsTabProps {
  modelDirs: string[];
  downloadDir: string;
  preferredOwners: string[];
  onAddModelDir: (dir: string) => void;
  onRemoveModelDir: (dir: string) => void;
  onSetDownloadDir: (dir: string) => void;
  onPreferredOwnersChange: (owners: string[]) => void;
}

export default function SettingsTab({
  modelDirs,
  downloadDir,
  preferredOwners,
  onAddModelDir,
  onRemoveModelDir,
  onSetDownloadDir,
  onPreferredOwnersChange,
}: SettingsTabProps) {
  const [error, setError] = useState<string | null>(null);

  const addModelDir = async () => {
    const result = await open({ directory: true, title: "Add GGUF storage directory" });
    const selected = Array.isArray(result) ? result[0] : result;
    if (selected) {
      try {
        await invoke("llm_add_model_dir", { path: selected });
        onAddModelDir(selected);
      } catch (e) {
        setError(String(e));
      }
    }
  };

  const removeModelDir = async (path: string) => {
    try {
      await invoke("llm_remove_model_dir", { path });
      onRemoveModelDir(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const changeDownloadDir = async (path: string) => {
    try {
      await invoke("llm_set_download_dir", { path });
      onSetDownloadDir(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const browseNewDownloadDir = async () => {
    const result = await open({ directory: true, title: "Select default download directory" });
    const selected = Array.isArray(result) ? result[0] : result;
    if (selected) {
      await changeDownloadDir(selected);
    }
  };

  const handlePreferredOwnersChange = async (newOwners: string[]) => {
    try {
      await invoke("llm_set_preferred_owners", { owners: newOwners });
      onPreferredOwnersChange(newOwners);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="glass-card-static p-4"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <p className="text-sm" style={{ color: "rgba(239,68,68,0.9)" }}>{error}</p>
          <button
            className="text-xs mt-1 transition-all duration-200 hover:scale-105"
            style={{ color: "rgba(239,68,68,0.6)" }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Download directory */}
      <div className="glass-card-static p-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(91,168,245,0.1)", border: "1px solid rgba(91,168,245,0.15)" }}
          >
            <FolderOpen size={16} style={{ color: "rgba(91,168,245,0.8)" }} />
          </div>
          <span className="text-primary-label">
            Download Directory
          </span>
        </div>
        <p className="text-xs mb-3 text-hint">
          New models are downloaded to this directory.
        </p>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm font-mono truncate" style={{ color: "var(--text-2)" }}>
            {downloadDir}
          </span>
          <button
            className="btn-glass"
            onClick={browseNewDownloadDir}
          >
            <FolderOpen size={12} /> Change
          </button>
        </div>
      </div>

      {/* GGUF Storage Directories */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(91,168,245,0.1)", border: "1px solid rgba(91,168,245,0.15)" }}
            >
              <HardDrive size={16} style={{ color: "rgba(91,168,245,0.8)" }} />
            </div>
            <div>
              <span className="text-primary-label block">
                GGUF Storage Directories
              </span>
              <span className="text-[10px] text-hint">
                All directories scanned recursively for .gguf files
              </span>
            </div>
          </div>
          <button
            className="btn-glass"
            onClick={addModelDir}
          >
            <FolderPlus size={13} /> Add Directory
          </button>
        </div>

        <div className="space-y-2">
          {modelDirs.map((dir) => {
            const isDownload = dir === downloadDir;
            return (
              <div
                key={dir}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  background: isDownload ? "rgba(59,130,246,0.06)" : "var(--bg-1)",
                  border: `1px solid ${isDownload ? "rgba(59,130,246,0.2)" : "var(--border-1)"}`,
                }}
              >
                <FolderOpen size={14} style={{ color: "var(--text-5)" }} className="shrink-0" />
                <span className="flex-1 text-sm font-mono truncate" style={{ color: "var(--text-2)" }}>
                  {dir}
                </span>
                {isDownload ? (
                  <span
                    className="badge-blue text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-0.5 shrink-0"
                  >
                    <Star size={9} /> Download
                  </span>
                ) : (
                  <button
                    className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 shrink-0"
                    style={{ background: "var(--bg-2)", color: "var(--text-4)" }}
                    onClick={() => changeDownloadDir(dir)}
                    title="Set as download directory"
                  >
                    <Star size={11} />
                  </button>
                )}
                {modelDirs.length > 1 && (
                  <button
                    className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 shrink-0"
                    style={{ color: "var(--text-5)" }}
                    onClick={() => removeModelDir(dir)}
                    title="Remove directory"
                  >
                    <Trash2 size={13} className="hover:!text-accent-red" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Preferred quant sources */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border-2)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.15)" }}
          >
            <Star size={16} style={{ color: "rgba(6,182,212,0.8)" }} />
          </div>
          <span className="text-[10px] font-medium tracking-[0.2em] uppercase" style={{ color: "var(--text-4)" }}>
            Preferred Quant Sources
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--text-5)" }}>
          HuggingFace users/orgs shown in the Browse tab owner filter, in your preferred order.
        </p>
        <PreferredOwners
          owners={preferredOwners}
          onChange={handlePreferredOwnersChange}
        />
      </div>
    </div>
  );
}
