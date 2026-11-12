import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import {
  IconFolder,
  IconFile,
  IconPhoto,
  IconX,
  IconArrowLeft,
  IconSparkles,
  IconFolderOff,
  IconLoader2,
  IconChevronRight,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn, formatBytes } from '@/lib/utils'
import { toast } from 'sonner'
import { useAgentWorkspace } from '@/hooks/useAgentWorkspace'

type DirEntry = {
  name: string
  path: string
  is_dir: boolean
  size: number
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'])

const isImageName = (name: string) => {
  const idx = name.lastIndexOf('.')
  if (idx === -1) return false
  return IMAGE_EXTS.has(name.slice(idx + 1).toLowerCase())
}

const isImageEntry = (entry: DirEntry) => !entry.is_dir && isImageName(entry.name)

/**
 * Loads and displays an image thumbnail from disk via the Tauri backend.
 * Only fetches when actually mounted (keeps large folders responsive).
 */
function ImageThumb({ path }: { path: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    invoke<{ base64: string; mime_type: string }>('read_image_base64', {
      path,
      maxDim: 160,
    })
      .then((res) => {
        if (!cancelled) {
          setDataUrl(`data:${res.mime_type};base64,${res.base64}`)
        }
      })
      .catch(() => {
        /* leave empty thumbnail */
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return dataUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt=""
      className="h-8 w-8 shrink-0 rounded border border-border object-cover"
      loading="lazy"
    />
  ) : (
    <div className="h-8 w-8 shrink-0 rounded border border-border bg-muted" />
  )
}

function imageName(path: string) {
  return path.split(/[\\/]/).pop() ?? path
}

type AgentWorkspacePanelProps = {
  open: boolean
  onClose: () => void
  onInjectImages: (
    images: Array<{ name: string; base64: string; mimeType: string }>
  ) => void | Promise<void>
}

export function AgentWorkspacePanel({
  open,
  onClose,
  onInjectImages,
}: AgentWorkspacePanelProps) {
  const folder = useAgentWorkspace((s) => s.folder)
  const setFolder = useAgentWorkspace((s) => s.setFolder)

  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [currentDir, setCurrentDir] = useState<string | null>(folder)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [injecting, setInjecting] = useState(false)

  useEffect(() => {
    if (folder) setCurrentDir(folder)
    setSelected(new Set())
  }, [folder])

  const loadDir = useCallback(async (dir: string) => {
    setLoading(true)
    setEntries([])
    try {
      const result = await invoke<DirEntry[]>('list_directory', { path: dir })
      setEntries(Array.isArray(result) ? result : [])
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentDir) void loadDir(currentDir)
  }, [currentDir, loadDir])

  const chooseFolder = async () => {
    try {
      const result = await openDialog({ directory: true, multiple: false })
      const selectedDir = Array.isArray(result) ? result[0] : result
      if (selectedDir) setFolder(selectedDir)
    } catch (e) {
      toast.error(String(e))
    }
  }

  const parentDir = useMemo(() => {
    if (!currentDir) return null
    const idx = currentDir.lastIndexOf('/')
    const backIdx = currentDir.lastIndexOf('\\')
    const split = Math.max(idx, backIdx)
    return split <= 0 ? null : currentDir.slice(0, split)
  }, [currentDir])

  const images = entries.filter(isImageEntry)

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const analyzeSelection = async () => {
    const paths = Array.from(selected)
    if (paths.length === 0 || injecting) return
    setInjecting(true)
    try {
      const loaded = await Promise.all(
        paths.map(async (p) => {
          const res = await invoke<{ base64: string; mime_type: string }>(
            'read_image_base64',
            { path: p, maxDim: 4096 }
          )
          return { name: imageName(p), base64: res.base64, mimeType: res.mime_type }
        })
      )
      await onInjectImages(loaded)
      setSelected(new Set())
      toast.success(
        `Sent ${loaded.length} image${loaded.length > 1 ? 's' : ''} to chat`
      )
    } catch (e) {
      toast.error(String(e))
    } finally {
      setInjecting(false)
    }
  }

  if (!open) return null

  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-background/80 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconPhoto size={18} className="shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">
            {folder ? currentDir : 'Agent workspace'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={chooseFolder}
          >
            Choose folder
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </Button>
        </div>
      </div>

      {!folder && (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
          <IconFolderOff size={28} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Pick a folder to give the agent a working context.
          </p>
          <Button variant="outline" size="sm" onClick={chooseFolder}>
            Open folder…
          </Button>
        </div>
      )}

      {folder && (
        <>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!parentDir}
              onClick={() => parentDir && setCurrentDir(parentDir)}
              aria-label="Up one level"
            >
              <IconArrowLeft size={15} />
            </Button>
            {images.length > 0 && <span>{images.length} image(s)</span>}
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <IconLoader2 size={16} className="animate-spin" />
                Loading…
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Empty folder
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map((entry) =>
                  entry.is_dir ? (
                    <li key={entry.path}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                        onClick={() => setCurrentDir(entry.path)}
                      >
                        <IconFolder size={16} className="shrink-0 text-amber-500" />
                        <span className="truncate">{entry.name}</span>
                        <IconChevronRight
                          size={13}
                          className="ml-auto shrink-0 text-muted-foreground"
                        />
                      </button>
                    </li>
                  ) : (
                    <li
                      key={entry.path}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 text-sm',
                        isImageEntry(entry) && 'cursor-pointer hover:bg-muted/60'
                      )}
                      onClick={
                        isImageEntry(entry)
                          ? () => toggleSelect(entry.path)
                          : undefined
                      }
                    >
                      {isImageEntry(entry) ? (
                        <>
                          <input
                            type="checkbox"
                            checked={selected.has(entry.path)}
                            onChange={() => toggleSelect(entry.path)}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 accent-primary"
                            aria-label={entry.name}
                          />
                          <ImageThumb path={entry.path} />
                          <span className="truncate">{entry.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {formatBytes(entry.size)}
                          </span>
                        </>
                      ) : (
                        <>
                          <IconFile size={16} className="shrink-0 text-muted-foreground" />
                          <span className="truncate">{entry.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {formatBytes(entry.size)}
                          </span>
                        </>
                      )}
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {selected.size} selected
            </span>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={selected.size === 0 || injecting}
              onClick={analyzeSelection}
            >
              {injecting ? (
                <IconLoader2 size={15} className="animate-spin" />
              ) : (
                <IconSparkles size={15} />
              )}
              Analyze selection
            </Button>
          </div>
        </>
      )}
    </div>
  )
}