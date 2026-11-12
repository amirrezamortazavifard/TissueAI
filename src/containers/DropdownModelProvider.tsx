/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useModelProvider } from '@/hooks/useModelProvider'
import { cn, getModelDisplayName } from '@/lib/utils'
import { getProviderTitle, providerMetadata, isLocalProvider } from '@/constants/providers'
import { highlightFzfMatch } from '@/utils/highlight'
import Capabilities from './Capabilities'
import { IconX } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useThreads } from '@/hooks/useThreads'
import { ModelSetting } from '@/containers/ModelSetting'
import { ProvidersAvatar } from '@/containers/ProvidersAvatar'
import { ModelSupportStatus } from '@/containers/ModelSupportStatus'
import { Fzf } from 'fzf'
import { localStorageKey } from '@/constants/localStorage'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useFavoriteModel } from '@/hooks/useFavoriteModel'
import { predefinedProviders } from '@/constants/providers'
import { providerHasRemoteApiKeys } from '@/lib/provider-api-keys'
import { useServiceHub } from '@/hooks/useServiceHub'
import { getLastUsedModel } from '@/utils/getModelToStart'
import { ChevronsUpDown, Settings2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Model, ModelProvider, ThreadModel } from '@/types'

type DropdownModelProviderProps = {
  model?: ThreadModel
  useLastUsedModel?: boolean
}

interface SearchableModel {
  provider: ModelProvider
  model: Model
  searchStr: string
  value: string
  highlightedId?: string
  disabled: boolean
}

const setLastUsedModel = (provider: string, model: string) => {
  try {
    localStorage.setItem(
      localStorageKey.lastUsedModel,
      JSON.stringify({ provider, model })
    )
  } catch (error) {
    console.debug('Failed to set last used model in localStorage:', error)
  }
}

function getProviderColor(providerName: string): string {
  return providerMetadata[providerName]?.color || '#64748b'
}

function providerHasUsableModels(provider: ModelProvider): boolean {
  if (isLocalProvider(provider.provider)) return provider.active === true
  if (!provider.active) return false
  const isPredefined = predefinedProviders.some((e) =>
    e.provider.includes(provider.provider)
  )
  if (isPredefined) return providerHasRemoteApiKeys(provider)
  return provider.models.length > 0
}

const DropdownModelProvider = memo(function DropdownModelProvider({
  model,
  useLastUsedModel = false,
}: DropdownModelProviderProps) {
  const {
    providers,
    getProviderByName,
    selectModelProvider,
    getModelBy,
    selectedProvider,
    selectedModel,
    updateProvider,
  } = useModelProvider()
  const [displayModel, setDisplayModel] = useState<string>('')
  const { updateCurrentThreadModel } = useThreads()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { favoriteModels } = useFavoriteModel()
  const serviceHub = useServiceHub()

  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const checkModelExists = useCallback(
    (providerName: string, modelId: string) => {
      const provider = providers.find(
        (p) => p.provider === providerName && p.active
      )
      return provider?.models.find((m) => m.id === modelId)
    },
    [providers]
  )

  const getContextSize = useCallback((): number => {
    if (!selectedModel?.settings?.ctx_len?.controller_props?.value) {
      return 8192
    }
    return selectedModel.settings.ctx_len.controller_props.value as number
  }, [selectedModel?.settings?.ctx_len?.controller_props?.value])

  const checkAndUpdateModelVisionCapability = useCallback(
    async (modelId: string) => {
      try {
        const hasVision = await serviceHub.models().checkMmprojExists?.(modelId)
        if (hasVision) {
          const provider = getProviderByName('llamacpp')
          if (provider) {
            const modelIndex = provider.models.findIndex(
              (m) => m.id === modelId
            )
            if (modelIndex !== -1) {
              const model = provider.models[modelIndex]
              const capabilities = model.capabilities || []
              const hasUserConfiguredCapabilities =
                (model as any)._userConfiguredCapabilities === true
              if (
                !capabilities.includes('vision') &&
                !hasUserConfiguredCapabilities
              ) {
                const updatedModels = [...provider.models]
                updatedModels[modelIndex] = {
                  ...model,
                  capabilities: [...capabilities, 'vision'],
                  _autoDetectedVision: true,
                } as any
                updateProvider('llamacpp', { models: updatedModels })
              }
            }
          }
        }
      } catch (error) {
        console.debug('Error checking mmproj for model:', modelId, error)
      }
    },
    [getProviderByName, updateProvider, serviceHub]
  )

  useEffect(() => {
    const initializeModel = async () => {
      if (model) {
        selectModelProvider(model?.provider as string, model?.id as string)
        if (!checkModelExists(model.provider, model.id)) {
          selectModelProvider('', '')
        }
        if (model?.provider === 'llamacpp') {
          await serviceHub
            .models()
            .checkMmprojExistsAndUpdateOffloadMMprojSetting?.(
              model.id as string,
              updateProvider,
              getProviderByName
            )
          await checkAndUpdateModelVisionCapability(model.id as string)
        }
      } else if (useLastUsedModel) {
        const lastUsed = getLastUsedModel()
        if (lastUsed && checkModelExists(lastUsed.provider, lastUsed.model)) {
          selectModelProvider(lastUsed.provider, lastUsed.model)
          if (lastUsed.provider === 'llamacpp') {
            await serviceHub
              .models()
              .checkMmprojExistsAndUpdateOffloadMMprojSetting?.(
                lastUsed.model,
                updateProvider,
                getProviderByName
              )
            await checkAndUpdateModelVisionCapability(lastUsed.model)
          }
        } else {
          const llamacppProvider = providers.find(
            (p) => p.provider === 'llamacpp' && p.active && p.models.length > 0
          )
          if (llamacppProvider && llamacppProvider.models.length > 0) {
            const firstModel = llamacppProvider.models[0]
            selectModelProvider('llamacpp', firstModel.id)
            setLastUsedModel('llamacpp', firstModel.id)
          } else {
            selectModelProvider('', '')
          }
        }
      }
    }
    initializeModel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    model,
    selectModelProvider,
    updateCurrentThreadModel,
    providers,
    checkModelExists,
    updateProvider,
    getProviderByName,
    checkAndUpdateModelVisionCapability,
  ])

  useEffect(() => {
    if (selectedProvider && selectedModel) {
      setDisplayModel(getModelDisplayName(selectedModel))
    } else {
      setDisplayModel(t('common:selectAModel'))
    }
  }, [selectedProvider, selectedModel, t])

  useEffect(() => {
    const checkAllLlamacppModelsForVision = async () => {
      const llamacppProvider = providers.find(
        (p) => p.provider === 'llamacpp' && p.active
      )
      if (llamacppProvider) {
        const checkPromises = llamacppProvider.models.map((model) =>
          checkAndUpdateModelVisionCapability(model.id)
        )
        await Promise.allSettled(checkPromises)
      }
    }
    if (open) {
      checkAllLlamacppModelsForVision()
    }
  }, [open, providers, checkAndUpdateModelVisionCapability])

  const onOpenChange = useCallback((open: boolean) => {
    setOpen(open)
    if (!open) {
      requestAnimationFrame(() => setSearchValue(''))
    } else {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [])

  const onClearSearch = useCallback(() => {
    setSearchValue('')
    searchInputRef.current?.focus()
  }, [])

  const usableProviders = useMemo(() => {
    return providers.filter((p) => providerHasUsableModels(p))
  }, [providers])

  const searchableItems = useMemo(() => {
    const items: SearchableModel[] = []
    usableProviders.forEach((provider) => {
      const hiddenSet = new Set(provider.hidden_models ?? [])
      provider.models.forEach((modelItem) => {
        if (modelItem.embedding) return
        if (hiddenSet.has(modelItem.id)) return
        const capabilities = modelItem.capabilities || []
        const capabilitiesString = capabilities.join(' ')
        const providerTitle = getProviderTitle(provider.provider)
        const searchStr =
          `${modelItem.id} ${providerTitle} ${provider.provider} ${capabilitiesString}`.toLowerCase()
        items.push({
          provider,
          model: modelItem,
          searchStr,
          value: `${provider.provider}:${modelItem.id}`,
          disabled: false,
        })
      })
    })
    return items
  }, [usableProviders])

  const fzfInstance = useMemo(() => {
    return new Fzf(searchableItems, {
      selector: (item) =>
        `${getModelDisplayName(item.model)} ${item.model.id}`.toLowerCase(),
    })
  }, [searchableItems])

  const favoriteItems = useMemo(() => {
    return searchableItems.filter((item) =>
      favoriteModels.some((fav) => fav.id === item.model.id)
    )
  }, [searchableItems, favoriteModels])

  const filteredItems = useMemo(() => {
    if (!searchValue) return searchableItems
    return fzfInstance.find(searchValue.toLowerCase()).map((result) => {
      const item = result.item
      const positions = Array.from(result.positions) || []
      const highlightedId = highlightFzfMatch(
        item.model.id,
        positions,
        'text-accent'
      )
      return { ...item, highlightedId }
    })
  }, [searchableItems, searchValue, fzfInstance])

  const localModels = useMemo(() => {
    return filteredItems.filter((item) => isLocalProvider(item.provider.provider))
  }, [filteredItems])

  const remoteGroups = useMemo(() => {
    const groups: Record<string, SearchableModel[]> = {}
    filteredItems
      .filter((item) => !isLocalProvider(item.provider.provider))
      .forEach((item) => {
        const key = item.provider.provider
        if (!groups[key]) groups[key] = []
        groups[key].push(item)
      })
    return groups
  }, [filteredItems])

  const handleSelect = useCallback(
    async (searchableModel: SearchableModel) => {
      if (searchableModel.disabled) return
      setDisplayModel(getModelDisplayName(searchableModel.model))
      setSearchValue('')
      setOpen(false)
      selectModelProvider(
        searchableModel.provider.provider,
        searchableModel.model.id
      )
      updateCurrentThreadModel({
        id: searchableModel.model.id,
        provider: searchableModel.provider.provider,
      })
      setLastUsedModel(
        searchableModel.provider.provider,
        searchableModel.model.id
      )
      if (searchableModel.provider.provider === 'llamacpp') {
        serviceHub
          .models()
          .checkMmprojExistsAndUpdateOffloadMMprojSetting?.(
            searchableModel.model.id,
            updateProvider,
            getProviderByName
          )
          .catch((error) => {
            console.debug(
              'Error checking mmproj for model:',
              searchableModel.model.id,
              error
            )
          })
        checkAndUpdateModelVisionCapability(searchableModel.model.id).catch(
          (error) => {
            console.debug(
              'Error checking vision capability for model:',
              searchableModel.model.id,
              error
            )
          }
        )
      }
    },
    [
      selectModelProvider,
      updateCurrentThreadModel,
      updateProvider,
      getProviderByName,
      checkAndUpdateModelVisionCapability,
      serviceHub,
    ]
  )

  const currentModel = selectedModel?.id
    ? getModelBy(selectedModel?.id)
    : undefined

  if (!providers.length) return null

  const provider = getProviderByName(selectedProvider)

  const hasNoModels = localModels.length === 0 && Object.keys(remoteGroups).length === 0 && !searchValue

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="chat-model-dropdown relative z-20 px-4 py-1.5 flex items-center gap-1.5 rounded-full">
          <button
            type="button"
            className="font-medium cursor-pointer flex items-center gap-1.5 relative z-20 min-w-0"
          >
            {provider && (
              <div className="shrink-0">
                <ProvidersAvatar provider={provider} />
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'text-foreground truncate leading-normal',
                    !selectedModel?.id && 'text-muted-foreground'
                  )}
                >
                  {displayModel}
                </span>
              </TooltipTrigger>
              <TooltipContent>{displayModel}</TooltipContent>
            </Tooltip>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
          {currentModel?.settings &&
            provider &&
            provider.provider === 'llamacpp' && (
              <div onClick={(e) => e.stopPropagation()}>
                <ModelSetting
                  model={currentModel as Model}
                  provider={provider}
                />
              </div>
            )}
          <ModelSupportStatus
            modelId={selectedModel?.id}
            provider={selectedProvider}
            contextSize={getContextSize()}
            className="ml-0.5 shrink-0"
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          'w-[360px] max-w-[90vw] p-0 backdrop-blur-2xl bg-background/95 border border-white/10 shadow-2xl'
        )}
        align="start"
        side="bottom"
        avoidCollisions
      >
        <div className="flex flex-col max-h-[420px]">
          {/* Search */}
          <div className="relative px-3 pt-3 pb-2 border-b border-border/50">
            <input
              ref={searchInputRef}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={t('common:searchModels')}
              className="w-full text-sm font-normal outline-none bg-transparent placeholder:text-muted-foreground/50"
            />
            {searchValue.length > 0 && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                onClick={onClearSearch}
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* Model Manager link */}
          <div className="px-3 py-2 border-b border-border/50">
            <button
              onClick={() => {
                navigate('/llm')
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-150"
            >
              <Settings2 size={14} />
              <span>Model Manager</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50">
                {providers.filter((p) => p.active).length} providers
              </span>
            </button>
          </div>

          {/* Model list */}
          <div className="overflow-y-auto flex-1">
            {hasNoModels ? (
              <div className="py-8 px-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {searchValue
                    ? t('common:noModelsFoundFor', { searchValue })
                    : 'No models available. Add models or configure API keys.'}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {/* Favorites */}
                {!searchValue && favoriteItems.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        Favorites
                      </span>
                    </div>
                    {favoriteItems.map((item) => {
                      const isSelected =
                        selectedModel?.id === item.model.id &&
                        selectedProvider === item.provider.provider
                      const color = getProviderColor(item.provider.provider)
                      return (
                        <div
                          key={`fav-${item.value}`}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            'mx-2 mb-0.5 px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2.5 transition-all duration-150',
                            'hover:bg-secondary/50',
                            isSelected && 'bg-primary/10 ring-1 ring-primary/30'
                          )}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: color }}
                          />
                          <span className="text-sm truncate flex-1 min-w-0">
                            {getModelDisplayName(item.model)}
                          </span>
                          {item.model.capabilities && item.model.capabilities.length > 0 && (
                            <div className="shrink-0">
                              <Capabilities capabilities={item.model.capabilities} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className="mx-3 my-1 border-t border-border/30" />
                  </>
                )}

                {/* Local models */}
                {localModels.length > 0 && (
                  <>
                    {!searchValue && (
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          Local
                        </span>
                      </div>
                    )}
                    {localModels.map((item) => {
                      const isSelected =
                        selectedModel?.id === item.model.id &&
                        selectedProvider === item.provider.provider
                      const capabilities = item.model.capabilities || []
                      return (
                        <Tooltip key={item.value}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => handleSelect(item)}
                              className={cn(
                                'mx-2 mb-0.5 px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all duration-150 cursor-pointer',
                                'hover:bg-secondary/50',
                                isSelected && 'bg-primary/10 ring-1 ring-primary/30'
                              )}
                            >
                              <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: getProviderColor(item.provider.provider) }}
                              />
                              <span className="text-sm truncate flex-1 min-w-0">
                                {getModelDisplayName(item.model)}
                              </span>
                              {capabilities.length > 0 && (
                                <div className="shrink-0">
                                  <Capabilities capabilities={capabilities} />
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{item.model.id}</TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </>
                )}

                {/* Remote providers */}
                {Object.entries(remoteGroups).map(([providerKey, models]) => {
                  const providerInfo = usableProviders.find(
                    (p) => p.provider === providerKey
                  )
                  if (!providerInfo) return null
                  const color = getProviderColor(providerKey)
                  const providerTitle = getProviderTitle(providerKey)

                  return (
                    <div key={providerKey}>
                      {!searchValue && (
                        <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: color }}
                          />
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            {providerTitle}
                          </span>
                        </div>
                      )}
                      {models.map((item) => {
                        const isSelected =
                          selectedModel?.id === item.model.id &&
                          selectedProvider === item.provider.provider
                        const capabilities = item.model.capabilities || []
                        return (
                          <Tooltip key={item.value}>
                            <TooltipTrigger asChild>
                              <div
                                onClick={() => handleSelect(item)}
                                className={cn(
                                  'mx-2 mb-0.5 px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all duration-150 cursor-pointer',
                                  'hover:bg-secondary/50',
                                  isSelected && 'bg-primary/10 ring-1 ring-primary/30'
                                )}
                              >
                                <div
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: color }}
                                />
                                <span className="text-sm truncate flex-1 min-w-0">
                                  {getModelDisplayName(item.model)}
                                </span>
                                {capabilities.length > 0 && (
                                  <div className="shrink-0">
                                    <Capabilities capabilities={capabilities} />
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{item.model.id}</TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Empty search */}
                {searchValue && filteredItems.length === 0 && (
                  <div className="py-8 px-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('common:noModelsFoundFor', { searchValue })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
})

export default DropdownModelProvider
