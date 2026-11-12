import { invoke } from '@tauri-apps/api/core'
import { fetch as httpFetch } from '@tauri-apps/plugin-http'
import type { ServerStatus } from '@/pages/llm/types'

/**
 * Mirror of Jan's `SessionInfo` (plugin:llamacpp|find_session_by_model) built
 * from Tissue's own server state. The Rust backend exposes a single llama-server
 * (selected from the LLM dashboard) via `llm_get_server_status`; when it is
 * running we hand back a session-shaped object for the active model.
 */
export type LlamaCppSessionInfo = {
  pid: number
  port: number
  model_id: string
  is_embedding: boolean
  api_key: string
}

/**
 * Probe a running llama-server's actual multimodal (vision) support via its
 * `GET /props` endpoint. The model's `capabilities` metadata is only a hint:
 * it can claim vision from stale settings or GGUF tags even when the server
 * was started without an mmproj (or the mmproj failed to load). The running
 * server is authoritative — without a vision encoder it rejects `image_url`
 * parts with a cryptic "does not support image input" error.
 *
 * Fail-safe: `undefined` when the server is not running, the probe fails, or
 * the fields are absent — callers then keep the metadata-based answer instead
 * of wrongly dropping images. `true`/`false` only reflect an explicit server
 * report.
 */
export async function probeServerVisionSupport(
  modelId: string,
  providerId: string
): Promise<boolean | undefined> {
  if (providerId !== 'llamacpp') return undefined
  try {
    const session = await findLlamacppSession(modelId)
    if (!session) return undefined
    const res = await httpFetch(`http://127.0.0.1:${session.port}/props`, {
      headers: { Origin: 'tauri://localhost' },
    })
    if (!res.ok) return undefined
    const props = (await res.json()) as {
      multimodal?: unknown
      vision?: unknown
    }
    const multimodal = props?.multimodal
    const vision = props?.vision
    if (multimodal === true || vision === true) return true
    if (multimodal === false || vision === false) return false
    return undefined
  } catch {
    return undefined
  }
}

export async function findLlamacppSession(
  modelId: string
): Promise<LlamaCppSessionInfo | null> {
  try {
    const status = await invoke<ServerStatus>('llm_get_server_status')
    if (status.type === 'running') {
      return {
        pid: status.pid,
        port: status.port,
        model_id: modelId,
        is_embedding: false,
        api_key: '',
      }
    }
  } catch {
    // Browser build or backend unavailable — no running session.
  }
  return null
}

/** MLX runs only on Apple Silicon; never available on this platform. */
export async function findMlxSession(
  modelId: string
): Promise<LlamaCppSessionInfo | null> {
  return findLlamacppSession(modelId).then((s) =>
    s ? { ...s, model_id: modelId } : null
  )
}

/**
 * Mirror of Jan's plugin `getLoadedModels()`. Tissue's backend runs a single
 * llama-server; when it is running we report the model that the caller is
 * about to load as already loaded (single-slot server semantics). On web /
 * stopped server this returns `[]`.
 */
export async function getLoadedModels(
  modelId?: string
): Promise<string[]> {
  try {
    const status = await invoke<ServerStatus>('llm_get_server_status')
    if (status.type === 'running') {
      return modelId ? [modelId] : ['loaded']
    }
  } catch {
    // Browser build or backend unavailable.
  }
  return []
}

/**
 * Mirror of Jan's plugin `unloadLlamaModel(modelId)`. The backend has no
 * explicit unload command yet, so this is a best-effort no-op — the model
 * keeps loading in the background and the server stops it on the next load.
 */
export async function unloadLlamaModel(_modelId: string): Promise<void> {
  // No-op until the Rust side exposes llm_stop.
}

