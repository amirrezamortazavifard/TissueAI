/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardItem } from '@/containers/Card'
import HeaderPage from '@/containers/HeaderPage'
import SettingsMenu from '@/containers/SettingsMenu'
import { useModelProvider } from '@/hooks/useModelProvider'
import {
  cn,
  getProviderTitle,
  getModelDisplayName,
  isLocalProvider,
} from '@/lib/utils'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '@/i18n/react-i18next-compat'
import Capabilities from '@/containers/Capabilities'
import { DynamicControllerSetting } from '@/containers/dynamicControllerSetting'
import { RenderMarkdown } from '@/containers/RenderMarkdown'
import { ModelSetting } from '@/containers/ModelSetting'
import { FavoriteModelAction } from '@/containers/FavoriteModelAction'
import { useServiceHub } from '@/hooks/useServiceHub'
import { Button } from '@/components/ui/button'
import { SecretInput } from '@/components/ui/secret-input'
import { Switch } from '@/components/ui/switch'
import {
  IconInfoCircle,
  IconLoader,
  IconRefresh,
  IconTrash,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { predefinedProviders } from '@/constants/providers'
import { useModelLoad } from '@/hooks/useModelLoad'
import { useAppState } from '@/hooks/useAppState'
import { useShallow } from 'zustand/shallow'
import {
  providerHasRemoteApiKeys,
  providerRemoteApiKeyChain,
  API_KEY_FALLBACKS_SETTING_KEY,
  serializeApiKeyFallbacks,
} from '@/lib/provider-api-keys'
import { fetch as httpFetch } from '@tauri-apps/plugin-http'
import type { Model, ModelProvider } from '@/types'

function ProviderDetail() {
  const { t } = useTranslation()
  const serviceHub = useServiceHub()
  const navigate = useNavigate()
  const { setModelLoadError } = useModelLoad()
  const [activeModels, setActiveModels] = useAppState(
    useShallow((state) => [state.activeModels, state.setActiveModels])
  )
  const [loadingModels, setLoadingModels] = useState<string[]>([])
  const [refreshingModels, setRefreshingModels] = useState(false)
  const [apiKeysDraft, setApiKeysDraft] = useState('')
  const [showAdvancedApiKeys, setShowAdvancedApiKeys] = useState(false)
  const [isTestingKeys, setIsTestingKeys] = useState(false)
  const [keyCheckResults, setKeyCheckResults] = useState<
    { index: number; masked: string; status: string; detail: string }[]
  >([])
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState(false)

  const { providerName } = useParams<{ providerName: string }>()
  const { getProviderByName, updateProvider, deleteProvider } = useModelProvider()
  const provider = providerName ? getProviderByName(providerName) : undefined
  const isPredefinedProvider = useMemo(
    () =>
      predefinedProviders.some((p) => p.provider === providerName),
    [providerName]
  )

  const hiddenModels = useMemo(
    () => new Set(provider?.hidden_models ?? []),
    [provider?.hidden_models]
  )
  const visibleCount = provider
    ? provider.models.length - hiddenModels.size
    : 0
  const allVisible =
    provider && provider.models.length > 0 && hiddenModels.size === 0

  const toggleModelVisibility = useCallback(
    (modelId: string) => {
      if (!provider) return
      const current = provider.hidden_models ?? []
      const isHidden = current.includes(modelId)
      const next = isHidden
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
      updateProvider(provider.provider, { hidden_models: next })
    },
    [provider, updateProvider]
  )

  const showAllModels = useCallback(() => {
    if (!provider) return
    updateProvider(provider.provider, { hidden_models: [] })
  }, [provider, updateProvider])

  const hideAllModels = useCallback(() => {
    if (!provider) return
    updateProvider(provider.provider, {
      hidden_models: provider.models.map((m) => m.id),
    })
  }, [provider, updateProvider])

  useEffect(() => {
    if (!provider?.provider) return
    serviceHub
      .models()
      .getActiveModels?.()
      .then((models) => setActiveModels(models || []))
  }, [serviceHub, setActiveModels, provider?.provider])

  useEffect(() => {
    if (!provider) return
    if (provider.provider === 'llamacpp' || provider.provider === 'mlx') return
    setApiKeysDraft(providerRemoteApiKeyChain(provider).join('\n'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    providerName,
    provider?.api_key,
    JSON.stringify(provider?.api_key_fallbacks ?? []),
  ])

  const commitApiKeysDraft = useCallback(async () => {
    if (!provider) return
    const lines = apiKeysDraft
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const nextPrimary = lines[0] ?? ''
    const nextFallbacks = lines.slice(1)

    const prevPrimary = provider.api_key ?? ''
    const prevFallbacks = provider.api_key_fallbacks ?? []
    const changed =
      nextPrimary !== prevPrimary ||
      JSON.stringify(nextFallbacks) !== JSON.stringify(prevFallbacks)
    if (!changed) return

    const newSettings = [...provider.settings]
    const apiKeySettingIndex = newSettings.findIndex((s) => s.key === 'api-key')
    if (apiKeySettingIndex !== -1) {
      const apiKeyProps = newSettings[apiKeySettingIndex].controller_props as {
        value: string | boolean | number
      }
      apiKeyProps.value = nextPrimary
    }

    const fallbacksValue = serializeApiKeyFallbacks(nextFallbacks)
    const fallbacksIndex = newSettings.findIndex(
      (s) => s.key === API_KEY_FALLBACKS_SETTING_KEY
    )
    if (fallbacksIndex !== -1) {
      const props = newSettings[fallbacksIndex].controller_props as {
        value: string | boolean | number
      }
      props.value = fallbacksValue
    } else if (fallbacksValue.length > 0) {
      newSettings.push({
        key: API_KEY_FALLBACKS_SETTING_KEY,
        title: 'API Key Fallbacks',
        description: '',
        controller_type: 'input',
        controller_props: {
          value: fallbacksValue,
          type: 'password',
          placeholder: '',
        },
      } as (typeof newSettings)[number])
    }

    serviceHub.providers().updateSettings(providerName ?? '', newSettings)
    updateProvider(providerName ?? '', {
      ...provider,
      settings: newSettings,
      api_key: nextPrimary,
      api_key_fallbacks: nextFallbacks,
    })

    // Persist the API key to the OS keyring via the Rust backend.
    try {
      await invoke('llm_save_api_provider', {
        provider: {
          id: provider.provider,
          provider_id: provider.provider,
          name: getProviderTitle(provider.provider),
          base_url: provider.base_url ?? '',
          api_key: nextPrimary,
          api_keys: nextFallbacks,
          custom_headers: provider.custom_header ?? [],
          api_type: provider.api_type ?? null,
          selected_model: provider.models?.[0]?.id ?? '',
          created_at: Date.now(),
          is_active: provider.active ?? true,
        },
      })
      toast.success('API key saved securely')
    } catch (e) {
      console.error('Failed to save API key to keyring:', e)
      toast.error('Failed to save API key')
    }
  }, [apiKeysDraft, provider, providerName, serviceHub, updateProvider])

  const rawApiKeyLines = apiKeysDraft.split(/\r?\n/)
  const primaryKeyDraft = (rawApiKeyLines[0] ?? '').trim()
  const setPrimaryKeyDraft = (nextPrimary: string) => {
    const rest = rawApiKeyLines.slice(1)
    setApiKeysDraft([nextPrimary, ...rest].join('\n'))
  }

  const advancedApiKeyLines = apiKeysDraft.split(/\r?\n/).map((l) => l.trim())
  const setKeyAtIndex = (index: number, nextValue: string) => {
    const next = [...advancedApiKeyLines]
    next[index] = nextValue.trim()
    setApiKeysDraft(next.join('\n'))
  }

  const addKeyLine = () => {
    setApiKeysDraft([...advancedApiKeyLines, ''].join('\n'))
  }

  const removeKeyLine = (index: number) => {
    if (index === 0) return
    const next = advancedApiKeyLines.filter((_, i) => i !== index)
    setApiKeysDraft((next.length > 0 ? next : ['']).join('\n'))
  }

  const maskApiKey = useCallback((value: string) => {
    if (value.length <= 8) return `${value.slice(0, 2)}***`
    return `${value.slice(0, 4)}***${value.slice(-4)}`
  }, [])

  const getStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'ok':
        return 'OK'
      case 'unauthorized':
        return 'Invalid / revoked key (401)'
      case 'forbidden':
        return 'Forbidden (403)'
      case 'rate_limited':
        return 'Rate limited / out of credit (429)'
      case 'network_error':
        return 'Network error'
      default:
        return 'Failed'
    }
  }, [])

  const getStatusClass = useCallback((status: string) => {
    switch (status) {
      case 'ok':
        return 'text-green-600'
      case 'unauthorized':
      case 'forbidden':
      case 'http_error':
      case 'network_error':
      case 'rate_limited':
        return 'text-yellow-600'
      default:
        return 'text-destructive'
    }
  }, [])

  const handleTestApiKeys = useCallback(async () => {
    if (!provider?.base_url) {
      toast.error(t('providers:models'), {
        description: t('providers:refreshModelsError'),
      })
      return
    }

    const keyDraftLines = apiKeysDraft.split(/\r?\n/).map((l) => l.trim())
    const nonEmptyKeyCount = keyDraftLines.filter((l) => l.length > 0).length
    if (nonEmptyKeyCount === 0) {
      toast.error(t('providers:models'), {
        description: t('providers:refreshModelsError'),
      })
      return
    }

    setIsTestingKeys(true)
    try {
      const results: {
        index: number
        masked: string
        status: string
        detail: string
      }[] = []

      for (let i = 0; i < keyDraftLines.length; i++) {
        const key = keyDraftLines[i]
        const keyIndex = i + 1
        if (!key) continue
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-api-key': key,
          Authorization: `Bearer ${key}`,
        }
        if (
          provider.base_url.includes('localhost:') ||
          provider.base_url.includes('127.0.0.1:')
        ) {
          headers['Origin'] = 'tauri://localhost'
        }

        try {
          const response = await httpFetch(
            `${provider.base_url.replace(/\/+$/, '')}/models`,
            {
              method: 'GET',
              headers,
            }
          )

          let status = 'http_error'
          if (response.ok) status = 'ok'
          else if (response.status === 401) status = 'unauthorized'
          else if (response.status === 403) status = 'forbidden'
          else if (response.status === 429) status = 'rate_limited'

          results.push({
            index: keyIndex,
            masked: maskApiKey(key),
            status,
            detail: `${response.status} ${response.statusText}`,
          })
        } catch (err) {
          results.push({
            index: keyIndex,
            masked: maskApiKey(key),
            status: 'network_error',
            detail: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      setKeyCheckResults(results)
    } finally {
      setIsTestingKeys(false)
    }
  }, [apiKeysDraft, maskApiKey, provider?.base_url, t])

  const handleRefreshModels = async () => {
    if (!provider || !provider.base_url || !providerHasRemoteApiKeys(provider)) {
      toast.error(t('providers:models'), {
        description: t('providers:refreshModelsError'),
      })
      return
    }

    setRefreshingModels(true)
    try {
      const modelIds = await serviceHub.providers().fetchModelsFromProvider(provider)
      const newModels: Model[] = modelIds.map((id) => ({
        id,
        model: id,
        name: id,
        provider: provider.provider,
        capabilities: ['completion'],
        version: '1.0',
      }))

      const existingModelIds = provider.models.map((m) => m.id)
      const modelsToAdd = newModels.filter(
        (model) => !existingModelIds.includes(model.id)
      )

      if (modelsToAdd.length > 0) {
        const updatedModels = [...provider.models, ...modelsToAdd]
        updateProvider(providerName ?? '', {
          ...provider,
          models: updatedModels,
        })

        toast.success(t('providers:models'), {
          description: t('providers:refreshModelsSuccess', {
            count: modelsToAdd.length,
            provider: provider.provider,
          }),
        })
      } else {
        toast.success(t('providers:models'), {
          description: t('providers:noNewModels'),
        })
      }
    } catch (error) {
      console.error('Failed to refresh models:', error)
      toast.error(t('providers:models'), {
        description: t('providers:refreshModelsFailed', {
          provider: provider.provider,
        }),
      })
    } finally {
      setRefreshingModels(false)
    }
  }

  const handleStartModel = async (modelId: string) => {
    setLoadingModels((prev) => [...prev, modelId])
    if (provider) {
      try {
        await serviceHub.models().startModel(provider, modelId)
        serviceHub
          .models()
          .getActiveModels?.()
          .then((models) => setActiveModels(models || []))
      } catch (error) {
        setModelLoadError({
          message: error instanceof Error ? error.message : String(error),
        })
      } finally {
        setLoadingModels((prev) => prev.filter((id) => id !== modelId))
      }
    }
  }

  const handleStopModel = (modelId: string) => {
    serviceHub
      .models()
      .stopModel(modelId)
      .then(() => {
        serviceHub
          .models()
          .getActiveModels?.()
          .then((models) => setActiveModels(models || []))
      })
      .catch((error) => {
        console.error('Error stopping model:', error)
      })
  }

  const handleDeleteProvider = () => {
    if (!providerName) return
    if (!confirmDeleteProvider) {
      setConfirmDeleteProvider(true)
      setTimeout(() => setConfirmDeleteProvider(false), 3000)
      return
    }
    deleteProvider(providerName)
    toast.success(t('providers:providerDeleted'))
    navigate('/settings')
  }

  const refreshActiveModels = useCallback(() => {
    serviceHub
      .models()
      .getActiveModels?.()
      .then((models) => setActiveModels(models || []))
  }, [serviceHub, setActiveModels])

  useEffect(() => {
    refreshActiveModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerName])

  if (!provider) {
    return (
      <div className="flex flex-col h-svh w-full">
        <HeaderPage>
          <div className="flex items-center gap-2 w-full">
            <span className="font-medium text-base font-studio">
              {t('common:settings')}
            </span>
          </div>
        </HeaderPage>
        <div className="flex h-[calc(100%-60px)]">
          <SettingsMenu />
          <div className="p-4 pt-0 w-full overflow-y-auto">
            <div className="flex flex-col items-start gap-3 p-6">
              <h1 className="font-medium text-base">
                {t('providers:providerNotFound', { providerName })}
              </h1>
              <Link to="/settings" className="text-sm text-primary underline">
                {t('common:backToSettings')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-svh w-full">
      <HeaderPage>
        <div className="flex items-center gap-2 w-full">
          <span className="font-medium text-base font-studio">
            {t('common:settings')}
          </span>
        </div>
      </HeaderPage>
      <div className="flex h-[calc(100%-60px)]">
        <SettingsMenu />
        <div className="p-4 pt-0 w-full overflow-y-auto">
          <div className="flex flex-col justify-between gap-4 gap-y-3 w-full">
            <div className="flex items-center justify-between">
              <h1 className="font-medium text-base">
                {getProviderTitle(provider.provider)}
              </h1>
              <Switch
                checked={provider?.active ?? false}
                onCheckedChange={(checked) =>
                  provider && updateProvider(providerName ?? '', { active: checked })
                }
              />
            </div>

            {!isLocalProvider(provider.provider) && (
              <div className="flex items-start gap-2 rounded-md border border-main-view-fg/10 bg-main-view-fg/5 px-3 py-2 text-xs text-muted-foreground">
                <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {t('providers:limitedSupport', {
                    defaultValue:
                      'This provider may not be fully supported. Capabilities (tools, vision, audio) are not auto-detected - add models manually and configure capabilities per model.',
                  })}
                </span>
              </div>
            )}

            <div
              className={cn(
                'flex flex-col gap-3',
                provider &&
                  (provider.provider === 'llamacpp' ||
                    provider.provider === 'mlx') &&
                  'flex-col-reverse'
              )}
            >
              {/* Settings — hidden for predefined remote providers since
                  api-key + base-url are both surfaced elsewhere / hidden. */}
              {!(
                isPredefinedProvider &&
                provider.provider !== 'llamacpp' &&
                provider.provider !== 'mlx'
              ) && (
                <Card>
                  {provider.settings.map((setting, settingIndex) => {
                    if (
                      setting.key === 'api-key' &&
                      provider.provider !== 'llamacpp' &&
                      provider.provider !== 'mlx'
                    ) {
                      return null
                    }

                    const actionComponent = (
                      <div className="mt-2">
                        <DynamicControllerSetting
                          controllerType={setting.controller_type}
                          controllerProps={setting.controller_props}
                          className={cn(setting.key === 'device' && 'hidden')}
                          onChange={(newValue) => {
                            const newSettings = [...provider.settings]
                            ;(
                              newSettings[settingIndex].controller_props as {
                                value: string | boolean | number
                              }
                            ).value = newValue

                            const updateObj: Partial<ModelProvider> = {
                              settings: newSettings,
                            }
                            const settingKey = setting.key
                            if (
                              settingKey === 'api-key' &&
                              typeof newValue === 'string'
                            ) {
                              updateObj.api_key = newValue
                            } else if (
                              settingKey === 'base-url' &&
                              typeof newValue === 'string'
                            ) {
                              updateObj.base_url = newValue
                            }

                            serviceHub
                              .providers()
                              .updateSettings(
                                provider.provider,
                                updateObj.settings ?? []
                              )
                            updateProvider(provider.provider, {
                              ...provider,
                              ...updateObj,
                            })
                          }}
                        />
                      </div>
                    )

                    return (
                      <CardItem
                        key={settingIndex}
                        title={setting.title}
                        className={cn(setting.key === 'device' && 'hidden')}
                        column={
                          setting.controller_type === 'input' &&
                          setting.controller_props.type !== 'number'
                            ? true
                            : false
                        }
                        description={
                          <RenderMarkdown
                            className="![>p]:text-muted-foreground select-none"
                            content={setting.description ?? ''}
                            components={{
                              a: ({ ...props }) => {
                                return (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                )
                              },
                              p: ({ ...props }) => (
                                <p {...props} className="mb-0!" />
                              ),
                            }}
                          />
                        }
                        actions={actionComponent}
                      />
                    )
                  })}

                  <div className="flex items-center justify-between p-4">
                    <div>
                      <h1 className="font-medium text-base">
                        {t('providers:deleteProvider')}
                      </h1>
                      <p className="text-sm text-muted-foreground leading-normal mt-1">
                        {t('providers:deleteProviderDescription')}
                      </p>
                    </div>
                    <Button
                      variant={confirmDeleteProvider ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={handleDeleteProvider}
                    >
                      <IconTrash size={14} />
                      <span>
                        {confirmDeleteProvider
                          ? t('providers:confirmDeleteProvider')
                          : t('providers:delete')}
                      </span>
                    </Button>
                  </div>
                </Card>
              )}

              {provider.provider !== 'llamacpp' && provider.provider !== 'mlx' && (
                <Card>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <h2 className="font-medium text-foreground text-base">
                        {t('providers:apiKeys.title')}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-normal">
                        {t('providers:apiKeys.description')}
                      </p>
                    </div>
                    {!showAdvancedApiKeys && (
                      <div className="flex flex-col gap-2">
                        <SecretInput
                          className="font-mono"
                          placeholder={t('providers:apiKeys.primaryPlaceholder')}
                          value={primaryKeyDraft}
                          onChange={(e) => setPrimaryKeyDraft(e.target.value)}
                          onBlur={() => commitApiKeysDraft()}
                          spellCheck={false}
                          autoComplete="off"
                        />

                        <div className="flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAdvancedApiKeys(true)
                              setKeyCheckResults([])
                            }}
                          >
                            {t('providers:apiKeys.advanced')}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {t('providers:apiKeys.oneKeyHint')}
                          </span>
                        </div>
                      </div>
                    )}

                    {showAdvancedApiKeys && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {t('providers:apiKeys.testHint')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                commitApiKeysDraft()
                                setShowAdvancedApiKeys(false)
                                setKeyCheckResults([])
                              }}
                            >
                              {t('providers:apiKeys.hideAdvanced')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleTestApiKeys}
                              disabled={isTestingKeys}
                            >
                              {isTestingKeys ? (
                                <>
                                  <IconLoader
                                    size={14}
                                    className="animate-spin"
                                  />
                                  {t('providers:apiKeys.testing')}
                                </>
                              ) : (
                                t('providers:apiKeys.test')
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {t('providers:apiKeys.rotationHint')}
                        </div>

                        <div className="space-y-2">
                          {advancedApiKeyLines.map((keyValue, idx) => {
                            const keyIndex = idx + 1
                            const rowResult = keyCheckResults.find(
                              (r) => r.index === keyIndex
                            )

                            return (
                              <div
                                key={idx}
                                className="grid grid-cols-[2.5rem_1fr_2rem] gap-x-2 gap-y-1 items-center"
                              >
                                <div className="text-right text-xs font-mono text-muted-foreground">
                                  #{keyIndex}
                                </div>

                                <div className="min-w-0">
                                  <SecretInput
                                    className="font-mono w-full"
                                    placeholder={t(
                                      'providers:apiKeys.keyPlaceholder'
                                    )}
                                    value={keyValue}
                                    onChange={(e) => {
                                      setKeyAtIndex(idx, e.target.value)
                                    }}
                                    onBlur={commitApiKeysDraft}
                                    spellCheck={false}
                                    autoComplete="off"
                                  />
                                </div>

                                <div className="flex justify-end">
                                  {idx !== 0 ? (
                                    <Button
                                      size="icon-xs"
                                      variant="outline"
                                      onClick={() => {
                                        setKeyCheckResults([])
                                        removeKeyLine(idx)
                                      }}
                                      title={t('providers:apiKeys.removeKey')}
                                    >
                                      -
                                    </Button>
                                  ) : (
                                    <span aria-hidden>&nbsp;</span>
                                  )}
                                </div>

                                <div aria-hidden />
                                <div className="min-w-0">
                                  {rowResult && (
                                    <div
                                      className={cn(
                                        'text-right text-xs font-medium',
                                        getStatusClass(rowResult.status)
                                      )}
                                      title={rowResult.detail}
                                    >
                                      {getStatusLabel(rowResult.status)}
                                    </div>
                                  )}
                                </div>
                                <div aria-hidden />
                              </div>
                            )
                          })}

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setKeyCheckResults([])
                                addKeyLine()
                              }}
                            >
                              + {t('providers:apiKeys.addKey')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Models */}
              <Card
                header={
                  <div className="flex items-center justify-between mb-4">
                    <h1 className="text-foreground font-medium text-base">
                      {t('providers:models')}
                      {provider && provider.models.length > 0 && (
                        <span className="text-muted-foreground text-xs ml-2">
                          {visibleCount}/{provider.models.length} visible
                        </span>
                      )}
                    </h1>
                    <div className="flex items-center gap-2">
                      {provider && provider.models.length > 0 && (
                        <div className="flex items-center gap-1 mr-2">
                          <Button
                            variant={allVisible ? 'default' : 'secondary'}
                            size="icon-xs"
                            onClick={showAllModels}
                            title="Show all models"
                          >
                            <IconEye size={14} />
                          </Button>
                          <Button
                            variant={!allVisible && hiddenModels.size > 0 ? 'default' : 'secondary'}
                            size="icon-xs"
                            onClick={hideAllModels}
                            title="Hide all models"
                          >
                            <IconEyeOff size={14} />
                          </Button>
                        </div>
                      )}
                      {provider.provider !== 'llamacpp' &&
                        provider.provider !== 'mlx' && (
                          <Button
                            variant="secondary"
                            size="icon-xs"
                            onClick={handleRefreshModels}
                            disabled={refreshingModels}
                          >
                            {refreshingModels ? (
                              <IconLoader
                                size={18}
                                className="text-muted-foreground animate-spin"
                              />
                            ) : (
                              <IconRefresh
                                size={18}
                                className="text-muted-foreground"
                              />
                            )}
                          </Button>
                        )}
                    </div>
                  </div>
                }
              >
                {provider.models.length ? (
                  provider.models.map((model, modelIndex) => {
                    const capabilities = model.capabilities || []
                    const isHidden = hiddenModels.has(model.id)
                    return (
                      <CardItem
                        key={modelIndex}
                        className={isHidden ? 'opacity-40' : ''}
                        title={
                          <div className="flex items-center gap-2">
                            <h1
                              className="font-medium line-clamp-1"
                              title={model.id}
                            >
                              {getModelDisplayName(model)}
                            </h1>
                            <Capabilities capabilities={capabilities} />
                          </div>
                        }
                        actions={
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => toggleModelVisibility(model.id)}
                              className="p-1 rounded-md hover:bg-secondary/60 transition-colors"
                              title={isHidden ? 'Show in chat selector' : 'Hide from chat selector'}
                            >
                              {isHidden ? (
                                <IconEyeOff size={14} className="text-muted-foreground" />
                              ) : (
                                <IconEye size={14} className="text-foreground" />
                              )}
                            </button>
                            {model.settings && provider.provider === 'llamacpp' && (
                              <ModelSetting provider={provider} model={model} />
                            )}
                            {((!predefinedProviders.some(
                              (p) => p.provider === provider.provider
                            ) ||
                              (predefinedProviders.some(
                                (p) => p.provider === provider.provider
                              ) &&
                                providerHasRemoteApiKeys(provider))) && (
                              <FavoriteModelAction model={model} />
                            ))}
                            {provider.provider === 'llamacpp' ||
                              (provider.provider === 'mlx' && (
                                <div className="ml-2">
                                  {activeModels.some(
                                    (activeModel) => activeModel === model.id
                                  ) ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleStopModel(model.id)}
                                    >
                                      {t('providers:stop')}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      disabled={loadingModels.includes(
                                        model.id
                                      )}
                                      onClick={() => handleStartModel(model.id)}
                                    >
                                      {loadingModels.includes(model.id) ? (
                                        <div className="flex items-center gap-2">
                                          <IconLoader
                                            size={16}
                                            className="animate-spin"
                                          />
                                        </div>
                                      ) : (
                                        t('providers:start')
                                      )}
                                    </Button>
                                  )}
                                </div>
                              ))}
                          </div>
                        }
                      />
                    )
                  })
                ) : (
                  <div className="-mt-2">
                    <div className="flex items-center gap-2">
                      <h6 className="font-medium text-base">
                        {t('providers:noModelFound')}
                      </h6>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {!isLocalProvider(provider.provider) ? (
                        t('providers:noModelFoundRemoteDesc')
                      ) : (
                        <>
                          {t('providers:noModelFoundDesc')}
                          &nbsp;
                          <Link to="/llm/models">{t('common:hub')}</Link>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProviderDetail
