import type { ModelProvider } from '@/types'

export function ProvidersAvatar({ provider }: { provider: ModelProvider }) {
  const label =
    provider.provider === 'llama.cpp'
      ? 'L'
      : (provider.provider.charAt(0).toUpperCase() || '?')
  return (
    <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs">
      {label}
    </div>
  )
}
