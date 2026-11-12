import { localStorageKey } from '@/constants/localStorage'
import type { ModelProvider } from '@/types'

export const getLastUsedModel = (): {
  provider: string
  model: string
} | null => {
  try {
    const stored = localStorage.getItem(localStorageKey.lastUsedModel)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.debug('Failed to get last used model from localStorage:', error)
    return null
  }
}

export const getModelToStart = (params: {
  selectedModel?: { id: string } | null
  selectedProvider?: string | null
  getProviderByName: (name: string) => ModelProvider | undefined
}): { model: string; provider: ModelProvider } | null => {
  const { selectedModel, selectedProvider, getProviderByName } = params

  const lastUsedModel = getLastUsedModel()
  if (lastUsedModel) {
    const provider = getProviderByName(lastUsedModel.provider)
    if (provider && provider.models.some((m) => m.id === lastUsedModel.model)) {
      return { model: lastUsedModel.model, provider }
    } else {
      const llamacppProvider = getProviderByName('llamacpp')
      if (
        llamacppProvider &&
        llamacppProvider.models &&
        llamacppProvider.models.length > 0
      ) {
        return {
          model: llamacppProvider.models[0].id,
          provider: llamacppProvider,
        }
      }
    }
  }

  if (selectedModel && selectedProvider) {
    const provider = getProviderByName(selectedProvider)
    if (provider) {
      return { model: selectedModel.id, provider }
    }
  }

  const llamacppProvider = getProviderByName('llamacpp')
  if (
    llamacppProvider &&
    llamacppProvider.models &&
    llamacppProvider.models.length > 0
  ) {
    return {
      model: llamacppProvider.models[0].id,
      provider: llamacppProvider,
    }
  }

  return null
}
