import { invoke } from '@tauri-apps/api/core'
import { useModelProvider } from '@/hooks/useModelProvider'
import { localProviders, predefinedProviders } from '@/constants/providers'
import { getLastUsedModel } from '@/utils/getModelToStart'
import { fetch as httpFetch } from '@tauri-apps/plugin-http'
import type { Model, ModelProvider } from '@/types'
import type { ModelInfo } from '@/pages/llm/types'

type ApiProvidersConfig = {
  providers: Array<{ id: string; api_key?: string }>
}

let syncing = false

async function fetchRemoteModels(
  provider: ModelProvider
): Promise<Model[]> {
  if (!provider.base_url || !provider.api_key) return []
  // KEY_MASK is a sentinel — never send it as a real Bearer token.
  if (provider.api_key.startsWith('\u2022')) return []
  try {
    const url = provider.base_url.replace(/\/+$/, '') + '/models'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.api_key}`,
    }
    const res = await httpFetch(url, { method: 'GET', headers })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: Array<{ id: string }> }
    return (body.data ?? []).map((m) => ({
      id: m.id,
      model: m.id,
      name: m.id,
      provider: provider.provider,
      capabilities: ['completion'],
      version: '1.0',
    }))
  } catch {
    return []
  }
}

/**
 * Seeds the Jan-style provider store (used by the chat page dropdown and the
 * chat transport) from Tissue's own backend: local llama.cpp models listed by
 * Rust plus the predefined remote providers. Safe to call repeatedly — the
 * store's setProviders merge keeps user settings and only re-pushes when the
 * local model list actually changed.
 */
export async function syncProvidersWithBackend(): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    const {
      providers,
      setProviders,
      selectedModel,
      selectModelProvider,
    } = useModelProvider.getState()

    let localModels: Model[] = []
    try {
      const installed = await invoke<ModelInfo[]>('llm_list_installed_models')
      localModels = installed.map((m) => ({
        id: m.id,
        name: m.name,
        provider: 'llamacpp',
        version: '1.0',
        description: [m.params_b, m.quant].filter(Boolean).join(' · ') || '',
        capabilities: ['completion'],
      }))
    } catch {
      // Browser build or backend unavailable — keep local models empty.
    }

    const llamacpp: ModelProvider = {
      ...localProviders[0],
      active: true,
      models: localModels,
    }

    // Fetch API provider key status from Rust (keyring-backed keys).
    const KEY_MASK =
      '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
    let apiProviderKeys: Record<string, string> = {}
    try {
      const apiConfig =
        await invoke<ApiProvidersConfig>('llm_get_api_providers')
      for (const p of apiConfig.providers ?? []) {
        if (p.api_key === KEY_MASK) {
          apiProviderKeys[p.id] = KEY_MASK
        }
      }
    } catch {
      // Backend unavailable or no API providers configured — leave empty.
    }

    // Merge with existing providers to preserve user-fetched models.
    const existingMap = new Map(providers.map((p) => [p.provider, p]))
    const remoteProviders: ModelProvider[] = predefinedProviders.map((p) => {
      const existing = existingMap.get(p.provider)
      const hasKey = !!apiProviderKeys[p.provider]
      return {
        ...p,
        api_key: hasKey
          ? apiProviderKeys[p.provider]
          : existing?.api_key || p.api_key,
        models: existing?.models?.length ? existing.models : p.models,
      }
    })

    const existingLlamacpp = providers.find((p) => p.provider === 'llamacpp')
    const modelCountChanged =
      !existingLlamacpp ||
      (existingLlamacpp.models?.length ?? 0) !== localModels.length

    // Check if any provider's API key status changed (key added or removed).
    const keyStatusChanged = remoteProviders.some((p) => {
      const old = existingMap.get(p.provider)
      const oldHasKey = !!(old?.api_key && old.api_key.trim().length > 0)
      const newHasKey = !!(p.api_key && p.api_key.trim().length > 0)
      return oldHasKey !== newHasKey
    })

    if (!modelCountChanged && !keyStatusChanged) return

    setProviders([llamacpp, ...remoteProviders])

    // Auto-fetch models for providers that have API keys but no models.
    for (const p of remoteProviders) {
      if (
        p.api_key &&
        p.api_key.trim().length > 0 &&
        (!p.models || p.models.length === 0)
      ) {
        fetchRemoteModels(p)
          .then((fetchedModels) => {
            if (fetchedModels.length > 0) {
              const state = useModelProvider.getState()
              const current = state.getProviderByName(p.provider)
              if (current && (!current.models || current.models.length === 0)) {
                state.updateProvider(p.provider, {
                  ...current,
                  models: fetchedModels,
                })
              }
            }
          })
          .catch(() => {
            /* ignore fetch errors silently */
          })
      }
    }

    if (!selectedModel) {
      const last = getLastUsedModel()
      if (last) {
        selectModelProvider(last.provider, last.model)
      } else if (localModels.length > 0) {
        selectModelProvider('llamacpp', localModels[0].id)
      }
    }
  } finally {
    syncing = false
  }
}
