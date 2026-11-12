import type { Model, ModelProvider } from '@/types'

const ROUTER_MODEL_DENY = new RegExp(
  [
    'opus',
    'claude-opus',
    'claude-3-opus',
    '\\bo1\\b',
    'o1-preview',
    '\\bo3\\b',
    'gpt-4-turbo',
    '^gpt-4$',
    'gpt-5(?!.*\\bmini\\b)',
  ].join('|'),
  'i'
)

const ROUTER_MODEL_ALLOW = new RegExp(
  [
    '\\bmini\\b',
    '\\bnano\\b',
    'flash',
    'haiku',
    '\\b8b\\b',
    '\\b7b\\b',
    '\\b3b\\b',
    '\\b2b\\b',
    '\\b1b\\b',
    '\\b1\\.6b\\b',
    '\\bsmall\\b',
    '\\btiny\\b',
    'phi[-_]?3',
    'gemma[-_]2b',
    'gpt-3\\.5',
    'gpt-4o-mini',
    'deepseek',
    '\\brouting\\b',
  ].join('|'),
  'i'
)

export function isLikelyLightweightRouterModel(model: Model): boolean {
  const hay = `${model.id}\n${model.displayName ?? ''}`.toLowerCase()
  if (ROUTER_MODEL_DENY.test(hay)) return false
  if (ROUTER_MODEL_ALLOW.test(hay)) return true

  if (/\b(q4|q5|q6|q8)[-_]?([0-9]+)?k?_[a-z0-9+]*\b/i.test(hay)) {
    if (/\b(1|2|3|7|8)b\b/i.test(hay)) return true
  }
  return false
}

export function isRouterModelSelectable(
  _provider: ModelProvider,
  model: Model
): boolean {
  if (!isLikelyLightweightRouterModel(model)) return false
  return true
}
