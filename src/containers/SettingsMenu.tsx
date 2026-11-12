import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useState, useEffect, useCallback } from 'react'
import {
  IconAdjustmentsHorizontal,
  IconCircles,
  IconChevronDown,
  IconChevronRight,
  IconCommand,
  IconFeather,
  IconPalette,
  IconPlus,
  IconTopologyStar3,
  IconLock,
  IconCpu,
  IconWorld,
  IconWorldSearch,
  IconPaperclip,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { useModelProvider } from '@/hooks/useModelProvider'
import { getProviderTitle, isLocalProvider } from '@/constants/providers'
import { ProvidersAvatar } from '@/containers/ProvidersAvatar'
import { AddProviderDialog } from '@/containers/dialogs'
import {
  openAIProviderSettings,
  anthropicProviderSettings,
} from '@/constants/providers'
import cloneDeep from 'lodash.clonedeep'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type {
  ModelProvider,
  ProviderApiType,
  ProviderSetting,
} from '@/types'

const IS_MACOS =
  typeof navigator !== 'undefined' &&
  navigator.platform.toUpperCase().indexOf('MAC') >= 0

const SettingsMenu = () => {
  const { t } = useTranslation()
  const [expandedProviders, setExpandedProviders] = useState(true)

  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { providers, addProvider } = useModelProvider()

  const createProvider = useCallback(
    (
      name: string,
      baseUrl: string,
      apiKey: string,
      apiType: ProviderApiType
    ) => {
      if (
        providers.some((e) => e.provider.toLowerCase() === name.toLowerCase())
      ) {
        toast.error(t('provider:providerAlreadyExists', { name }))
        return
      }
      const template =
        apiType === 'anthropic'
          ? anthropicProviderSettings
          : openAIProviderSettings
      const settings = cloneDeep(template) as ProviderSetting[]
      for (const s of settings) {
        if (s.key === 'base-url') {
          (s.controller_props as { value: string }).value = baseUrl
        } else if (s.key === 'api-key') {
          (s.controller_props as { value: string }).value = apiKey
        }
      }
      const newProvider: ModelProvider = {
        provider: name,
        active: true,
        models: [],
        settings,
        api_key: apiKey,
        base_url: baseUrl,
        ...(apiType === 'anthropic' ? { api_type: 'anthropic' as const } : {}),
      }
      addProvider(newProvider)
      setTimeout(() => {
        navigate(`/settings/providers/${name}`)
      }, 0)
    },
    [providers, addProvider, t, navigate]
  )

  const activeProviders = providers.filter((provider) => {
    if (!provider.active) return false
    if (!IS_MACOS && provider.provider === 'mlx') return false
    return true
  })

  const activeLocalProviders = activeProviders.filter((p) =>
    isLocalProvider(p.provider)
  )
  const activeRemoteProviders = activeProviders.filter(
    (p) => !isLocalProvider(p.provider)
  )

  const hiddenProviders = providers.filter((provider) => {
    if (provider.active) return false
    if (!IS_MACOS && provider.provider === 'mlx') return false
    return true
  })

  const isProviderRouteActive = (providerName: string) => {
    return location.pathname === `/settings/providers/${providerName}`
  }

  const renderActiveProvider = (provider: ModelProvider) => {
    const isRouteActive = isProviderRouteActive(provider.provider)
    return (
      <div
        key={provider.provider}
        className={cn(
          'flex px-2 items-center gap-1.5 cursor-pointer hover:bg-secondary/60 py-1 w-full rounded-sm text-foreground',
          isRouteActive && 'bg-secondary',
          provider.provider === 'llama.cpp' && stepSetupRemoteProvider && 'hidden'
        )}
        onClick={() =>
          navigate(
            stepSetupRemoteProvider
              ? `/settings/providers/${provider.provider}?step=setup_remote_provider`
              : `/settings/providers/${provider.provider}`
          )
        }
      >
        <ProvidersAvatar provider={provider} />
        <div className="truncate flex-1">
          <span>{getProviderTitle(provider.provider)}</span>
        </div>
      </div>
    )
  }

  useEffect(() => {
    const hasProviderName =
      location.pathname.startsWith('/settings/providers/')
    if (hasProviderName) {
      setExpandedProviders(true)
    }
  }, [location.pathname])

  const stepSetupRemoteProvider =
    searchParams.get('step') === 'setup_remote_provider'

  const coreSettings = [
    {
      title: 'common:general',
      route: '/settings',
      icon: IconAdjustmentsHorizontal,
    },
    {
      title: 'common:appearance',
      route: '/settings',
      icon: IconPalette,
    },
    {
      title: 'common:assistants',
      route: '/settings',
      icon: IconFeather,
    },
    {
      title: 'common:attachments',
      route: '/settings',
      icon: IconPaperclip,
    },
    {
      title: 'common:local_api_server',
      route: '/settings',
      icon: IconCircles,
    },
    {
      title: 'common:https_proxy',
      route: '/settings',
      icon: IconWorld,
    },
    {
      title: 'common:web_search',
      route: '/settings',
      icon: IconWorldSearch,
    },
    {
      title: 'common:keyboardShortcuts',
      route: '/settings',
      icon: IconCommand,
    },
    {
      title: 'common:hardware',
      route: '/settings',
      hasSubMenu: false,
      isEnabled: true,
      icon: IconCpu,
    },
    { title: 'common:privacy', route: '/settings', icon: IconLock },
  ]

  const integrationSettings = [
    {
      title: 'common:mcp-servers',
      route: '/mcp-settings',
      icon: IconTopologyStar3,
    },
  ]

  return (
    <>
      <div className="h-full w-58 shrink-0 px-1.5 flex overflow-auto">
        <div className="flex flex-col gap-1 w-full font-medium">
          {coreSettings.map((menu) => (
            <div key={menu.title}>
              <Link
                to={menu.route}
                className="block px-2 gap-1.5 cursor-pointer hover:dark:bg-secondary/60 hover:bg-secondary py-1 w-full rounded-sm [&.active]:dark:bg-secondary/80 [&.active]:bg-secondary"
              >
                <div className="flex items-center gap-2">
                  <menu.icon
                    size={18}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span>{t(menu.title)}</span>
                </div>
              </Link>
            </div>
          ))}

          <div className="mt-4">
            <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('common:integrations')}
              <span className="text-[11px] capitalize ml-2 font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {t('common:experimental')}
              </span>
            </span>
            <div className="mt-1 flex flex-col gap-1">
              {integrationSettings.map((menu) => (
                <Link
                  key={menu.title}
                  to={menu.route}
                  className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:dark:bg-secondary/60 hover:bg-secondary rounded-sm [&.active]:dark:bg-secondary/80 [&.active]:bg-secondary"
                >
                  <menu.icon
                    size={18}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span>{t(menu.title)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between pl-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('common:modelProviders')}
              </span>
              <AddProviderDialog onCreateProvider={createProvider}>
                <Button variant="ghost" size="icon-xs">
                  <IconPlus size={12} />
                </Button>
              </AddProviderDialog>
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {activeLocalProviders.length > 0 && (
                <>
                  <span className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {t('common:localProviders')}
                  </span>
                  {activeLocalProviders.map(renderActiveProvider)}
                </>
              )}

              {activeRemoteProviders.length > 0 && (
                <>
                  <span
                    className={cn(
                      'px-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70',
                      activeLocalProviders.length > 0 && 'mt-2'
                    )}
                  >
                    {t('common:remoteProviders')}
                  </span>
                  {activeRemoteProviders.map(renderActiveProvider)}
                </>
              )}

              {hiddenProviders.length > 0 && (
                <>
                  <button
                    className="flex items-center justify-between px-2 py-1 w-full rounded-sm text-muted-foreground hover:bg-secondary/60"
                    onClick={() => setExpandedProviders(!expandedProviders)}
                  >
                    <span className="text-sm">
                      {t('common:hiddenProviders', {
                        count: hiddenProviders.length,
                      })}
                    </span>
                    {expandedProviders ? (
                      <IconChevronDown size={14} />
                    ) : (
                      <IconChevronRight size={14} />
                    )}
                  </button>
                  {expandedProviders &&
                    hiddenProviders.map((provider) => {
                      const isRouteActive = isProviderRouteActive(
                        provider.provider
                      )
                      return (
                        <div
                          key={provider.provider}
                          className={cn(
                            'flex px-2 items-center gap-1.5 cursor-pointer hover:bg-secondary/60 py-1 w-full rounded-sm text-muted-foreground',
                            isRouteActive && 'bg-secondary'
                          )}
                          onClick={() =>
                            navigate(
                              `/settings/providers/${provider.provider}`
                            )
                          }
                        >
                          <ProvidersAvatar provider={provider} />
                          <div className="truncate flex-1">
                            <span>{getProviderTitle(provider.provider)}</span>
                          </div>
                        </div>
                      )
                    })}
                </>
              )}
            </div>
            <div className="m-3" />
          </div>
        </div>
      </div>
    </>
  )
}

export default SettingsMenu
