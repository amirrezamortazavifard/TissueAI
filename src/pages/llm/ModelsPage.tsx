import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import {
  HardDrive,
  Cloud,
  Download,
  Settings,
  LayoutGrid,
} from "lucide-react"
import type {
  ModelInfo,
  HfFile,
  KnownOwner,
  DownloadProgress,
} from "./types"
import LocalTab from "./tabs/LocalTab"
import RemoteTab from "./tabs/RemoteTab"
import InstalledTab from "./tabs/InstalledTab"
import BrowseTab from "./tabs/BrowseTab"
import SettingsTab from "./tabs/SettingsTab"

type Tab = "local" | "remote" | "installed" | "browse" | "settings"

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "local", label: "Local", icon: HardDrive },
  { id: "remote", label: "Remote", icon: Cloud },
  { id: "installed", label: "Installed", icon: LayoutGrid },
  { id: "browse", label: "Browse HF", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
]

export default function ModelsPage() {
  const [tab, setTab] = useState<Tab>("local")

  const [installed, setInstalled] = useState<ModelInfo[]>([])
  const [owners, setOwners] = useState<KnownOwner[]>([])
  const [preferredOwners, setPreferredOwnersState] = useState<string[]>([])
  const [modelDirs, setModelDirs] = useState<string[]>([])
  const [downloadDir, setDownloadDirState] = useState<string>("")
  const [favorites, setFavorites] = useState<string[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({})

  const loadData = useCallback(async () => {
    try {
      const [mdls, cfg, dirs, ownersList, prefOwners] = await Promise.all([
        invoke<ModelInfo[]>("llm_list_installed_models").catch(() => []),
        invoke<{ favorites: string[]; selected_model?: string }>("llm_get_config").catch(() => ({ favorites: [] as string[] })),
        invoke<{ dirs: string[]; download_dir: string }>("llm_get_model_dirs").catch(() => ({ dirs: [] as string[], download_dir: "" })),
        invoke<KnownOwner[]>("llm_get_known_owners").catch(() => []),
        invoke<string[]>("llm_get_preferred_owners").catch(() => []),
      ])
      setInstalled(mdls)
      setFavorites(cfg.favorites ?? [])
      setModelDirs(dirs.dirs)
      setDownloadDirState(dirs.download_dir)
      setOwners(ownersList)
      setPreferredOwnersState(prefOwners)
    } catch { /* ignored */ }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const unlisten = listen<{
      filename: string
      percent: number
      bytes_downloaded: number
      total_bytes: number
      status: string
    }>("download_progress", (ev) => {
      const p = ev.payload
      setDownloads((prev) => {
        if (p.status === "finished" || p.status === "failed") {
          const next: Record<string, DownloadProgress> = { ...prev }
          delete next[p.filename]
          if (p.status === "finished") {
            loadData()
          }
          return next
        }
        return {
          ...prev,
          [p.filename]: {
            id: p.filename,
            percent: p.percent,
            bytes_downloaded: p.bytes_downloaded,
            total_bytes: p.total_bytes,
            status: p.status,
          },
        }
      })
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [loadData])

  const handleToggleFavorite = useCallback(async (modelId: string) => {
    await invoke("llm_toggle_favorite_model", { modelId })
    const cfg = await invoke<{ favorites: string[] }>("llm_get_config").catch(() => ({ favorites: [] as string[] }))
    setFavorites(cfg.favorites ?? [])
  }, [])

  const handleDeleteModel = useCallback(async (path: string) => {
    await invoke("llm_delete_model", { path })
    await loadData()
  }, [loadData])

  const handleStartDownload = useCallback(async (repoId: string, file: HfFile) => {
    try {
      await invoke("llm_download_model", {
        repoId,
        filename: file.filename,
        downloadUrl: file.download_url,
        sizeBytes: file.size_bytes,
        isSplit: file.is_split,
        splitParts: file.split_parts,
      })
    } catch (e) {
      console.error("Download failed:", e)
    }
  }, [])

  const handleResumeDownload = useCallback(async (filename: string) => {
    setDownloads((prev) => {
      const d = prev[filename]
      if (!d) return prev
      return { ...prev, [filename]: { ...d, status: "downloading" as const } }
    })
  }, [])

  const handleAbortDownload = useCallback(async (filename: string) => {
    await invoke("llm_abort_download", { filename })
    setDownloads((prev) => {
      const next = { ...prev }
      delete next[filename]
      return next
    })
  }, [])

  const handleAddModelDir = useCallback(async (_dir: string) => {
    const dirs = await invoke<{ dirs: string[]; download_dir: string }>("llm_get_model_dirs").catch(() => ({ dirs: [] as string[], download_dir: "" }))
    setModelDirs(dirs.dirs)
    setDownloadDirState(dirs.download_dir)
  }, [])

  const handleRemoveModelDir = useCallback(async (_dir: string) => {
    const dirs = await invoke<{ dirs: string[]; download_dir: string }>("llm_get_model_dirs").catch(() => ({ dirs: [] as string[], download_dir: "" }))
    setModelDirs(dirs.dirs)
    setDownloadDirState(dirs.download_dir)
  }, [])

  const handleSetDownloadDir = useCallback(async (dir: string) => {
    await invoke("llm_set_download_dir", { dir })
    setDownloadDirState(dir)
  }, [])

  const handlePreferredOwnersChange = useCallback(async (owners: string[]) => {
    setPreferredOwnersState(owners)
    await invoke("llm_set_preferred_owners", { owners })
  }, [])

  return (
    <div className="h-full flex flex-col relative overflow-hidden page-enter">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(91,168,245,0.08), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139,92,246,0.05), transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        <div className="px-6 pt-5 pb-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-1)" }}>
            Models
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
            Manage local and remote AI models
          </p>
        </div>

        <div className="px-6">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)" }}>
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background: active ? "var(--bg-1)" : "transparent",
                    color: active ? "var(--text-1)" : "var(--text-4)",
                    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                  }}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "local" && <LocalTab />}
          {tab === "remote" && <RemoteTab />}
          {tab === "installed" && (
            <InstalledTab
              installed={installed}
              favorites={favorites}
              downloads={downloads}
              onToggleFavorite={handleToggleFavorite}
              onDeleteModel={handleDeleteModel}
              onNavigateToBrowse={() => setTab("browse")}
            />
          )}
          {tab === "browse" && (
            <BrowseTab
              installed={installed}
              downloads={downloads}
              favorites={favorites}
              owners={owners}
              preferredOwners={preferredOwners}
              onStartDownload={handleStartDownload}
              onResumeDownload={handleResumeDownload}
              onAbortDownload={handleAbortDownload}
              onNavigateToInstalled={() => setTab("installed")}
            />
          )}
          {tab === "settings" && (
            <SettingsTab
              modelDirs={modelDirs}
              downloadDir={downloadDir}
              preferredOwners={preferredOwners}
              onAddModelDir={handleAddModelDir}
              onRemoveModelDir={handleRemoveModelDir}
              onSetDownloadDir={handleSetDownloadDir}
              onPreferredOwnersChange={handlePreferredOwnersChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
