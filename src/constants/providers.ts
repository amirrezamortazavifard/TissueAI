import type { ModelProvider, ProviderSetting } from '@/types'

export const anthropicProviderSettings: ProviderSetting[] = [
  {
    key: 'api-key',
    title: 'API Key',
    description:
      "The Anthropic API uses API keys for authentication. Visit your [API Keys](https://console.anthropic.com/settings/keys) page to retrieve the API key you'll use in your requests.",
    controller_type: 'input',
    controller_props: {
      placeholder: 'Insert API Key',
      value: '',
      type: 'password',
      input_actions: ['unobscure', 'copy'],
    },
  },
  {
    key: 'base-url',
    title: 'Base URL',
    description:
      'The base endpoint to use. See the [Anthropic API documentation](https://docs.anthropic.com/en/api/getting-started) for more information.',
    controller_type: 'input',
    controller_props: {
      placeholder: 'https://api.anthropic.com/v1',
      value: 'https://api.anthropic.com/v1',
    },
  },
]

export const openAIProviderSettings: ProviderSetting[] = [
  {
    key: 'api-key',
    title: 'API Key',
    description:
      "The OpenAI API uses API keys for authentication. Visit your [API Keys](https://platform.openai.com/account/api-keys) page to retrieve the API key you'll use in your requests.",
    controller_type: 'input',
    controller_props: {
      placeholder: 'Insert API Key',
      value: '',
      type: 'password',
      input_actions: ['unobscure', 'copy'],
    },
  },
  {
    key: 'base-url',
    title: 'Base URL',
    description:
      'The base endpoint to use. See the [OpenAI API documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.',
    controller_type: 'input',
    controller_props: {
      placeholder: 'https://api.openai.com/v1',
      value: 'https://api.openai.com/v1',
    },
  },
]

// ═══════════════════════════════════════════════════════════════════
// Provider Metadata (display info, avatars, colors)
// ═══════════════════════════════════════════════════════════════════

export const providerMetadata: Record<string, { name: string; icon?: string; color?: string }> = {
  openai: { name: 'OpenAI', color: '#10a37f' },
  azure: { name: 'Azure OpenAI', color: '#0078d4' },
  anthropic: { name: 'Anthropic', color: '#d4a574' },
  openrouter: { name: 'OpenRouter', color: '#6366f1' },
  mistral: { name: 'Mistral', color: '#ff7000' },
  groq: { name: 'Groq', color: '#f55036' },
  xai: { name: 'xAI', color: '#1d9bf0' },
  gemini: { name: 'Google Gemini', color: '#4285f4' },
  minimax: { name: 'MiniMax', color: '#8b5cf6' },
  huggingface: { name: 'Hugging Face', color: '#ffd21e' },
  nvidia: { name: 'NVIDIA NIM', color: '#76b900' },
  ollama: { name: 'Ollama', color: '#8b5cf6' },
  llamacpp: { name: 'llama.cpp', color: '#64748b' },
}

// ═══════════════════════════════════════════════════════════════════
// Helper: API Key Setting Template
// ═══════════════════════════════════════════════════════════════════

function apiKeySetting(providerName: string, docsUrl: string): ProviderSetting {
  return {
    key: 'api-key',
    title: 'API Key',
    description: `The ${providerName} API uses API keys for authentication. Visit your [API Keys](${docsUrl}) page to retrieve the API key you'll use in your requests.`,
    controller_type: 'input',
    controller_props: {
      placeholder: 'Insert API Key',
      value: '',
      type: 'password',
      input_actions: ['unobscure', 'copy'],
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// Predefined Remote Providers (Jan-compatible)
// ═══════════════════════════════════════════════════════════════════

export const predefinedProviders: ModelProvider[] = [
  // ── OpenAI ──────────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://api.openai.com/v1',
    explore_models_url: 'https://platform.openai.com/docs/models',
    provider: 'openai',
    settings: [
      apiKeySetting('OpenAI', 'https://platform.openai.com/account/api-keys'),
    ],
    models: [],
  },

  // ── Azure OpenAI ────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1',
    explore_models_url: 'https://oai.azure.com/deployments',
    provider: 'azure',
    settings: [
      {
        key: 'api-key',
        title: 'API Key',
        description:
          'The Azure OpenAI API uses API keys for authentication. Visit your [Azure OpenAI Studio](https://oai.azure.com/) to retrieve the API key from your resource.',
        controller_type: 'input',
        controller_props: {
          placeholder: 'Insert API Key',
          value: '',
          type: 'password',
          input_actions: ['unobscure', 'copy'],
        },
      },
      {
        key: 'base-url',
        title: 'Base URL',
        description:
          'Your Azure OpenAI resource endpoint, e.g. https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1',
        controller_type: 'input',
        controller_props: {
          placeholder: 'https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1',
          value: 'https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1',
        },
      },
    ],
    models: [],
  },

  // ── Anthropic ───────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://api.anthropic.com/v1',
    provider: 'anthropic',
    api_type: 'anthropic',
    explore_models_url: 'https://docs.anthropic.com/en/docs/about-claude/models',
    settings: [
      apiKeySetting('Anthropic', 'https://console.anthropic.com/settings/keys'),
    ],
    models: [],
    custom_header: [
      { header: 'anthropic-version', value: '2023-06-01' },
      { header: 'anthropic-dangerous-direct-browser-access', value: 'true' },
    ],
  },

  // ── OpenRouter ──────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://openrouter.ai/api/v1',
    explore_models_url: 'https://openrouter.ai/models',
    provider: 'openrouter',
    settings: [
      apiKeySetting('OpenRouter', 'https://openrouter.ai/settings/keys'),
    ],
    models: [
      {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek-R1 (free)',
        provider: 'openrouter',
        version: '1.0',
        description: '',
        capabilities: ['completion'],
      },
      {
        id: 'qwen/qwen3-30b-a3b:free',
        name: 'Qwen3 30B A3B (free)',
        provider: 'openrouter',
        version: '1.0',
        description: '',
        capabilities: ['completion'],
      },
    ],
  },

  // ── Mistral ─────────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://api.mistral.ai/v1',
    explore_models_url: 'https://docs.mistral.ai/getting-started/models/models_overview/',
    provider: 'mistral',
    settings: [
      apiKeySetting('Mistral', 'https://console.mistral.ai/api-keys/'),
    ],
    models: [],
  },

  // ── Groq ────────────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://api.groq.com/openai/v1',
    explore_models_url: 'https://console.groq.com/docs/models',
    provider: 'groq',
    settings: [
      apiKeySetting('Groq', 'https://console.groq.com/keys'),
    ],
    models: [],
  },

  // ── xAI (Grok) ─────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://api.x.ai/v1',
    explore_models_url: 'https://docs.x.ai/overview',
    provider: 'xai',
    settings: [
      apiKeySetting('xAI', 'https://console.x.ai/'),
    ],
    models: [],
  },

  // ── Google Gemini ───────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    explore_models_url: 'https://ai.google.dev/gemini-api/docs/models/gemini',
    provider: 'gemini',
    settings: [
      apiKeySetting('Google', 'https://aistudio.google.com/apikey'),
    ],
    models: [],
  },

  // ── MiniMax ─────────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://api.minimax.io/v1',
    explore_models_url: 'https://platform.minimax.io/docs/api-reference/text-openai-api',
    provider: 'minimax',
    settings: [
      apiKeySetting('MiniMax', 'https://platform.minimax.io/user-center/basic-information/interface-key'),
    ],
    models: [
      {
        id: 'MiniMax-M2.7',
        name: 'MiniMax-M2.7',
        provider: 'minimax',
        version: '1.0',
        description: 'Latest flagship model with enhanced reasoning and coding.',
        capabilities: ['completion', 'tools'],
      },
      {
        id: 'MiniMax-M2.7-highspeed',
        name: 'MiniMax-M2.7-highspeed',
        provider: 'minimax',
        version: '1.0',
        description: 'High-speed version of M2.7 for low-latency scenarios.',
        capabilities: ['completion', 'tools'],
      },
      {
        id: 'MiniMax-M2.5',
        name: 'MiniMax-M2.5',
        provider: 'minimax',
        version: '1.0',
        description: 'Peak Performance. Ultimate Value. Master the Complex. 204K context window.',
        capabilities: ['completion', 'tools'],
      },
      {
        id: 'MiniMax-M2.5-highspeed',
        name: 'MiniMax-M2.5-highspeed',
        provider: 'minimax',
        version: '1.0',
        description: 'Same performance, faster and more agile. 204K context window.',
        capabilities: ['completion', 'tools'],
      },
    ],
  },

  // ── Hugging Face ────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://router.huggingface.co/v1',
    explore_models_url: 'https://huggingface.co/models?pipeline_tag=text-generation&inference_provider=all',
    provider: 'huggingface',
    settings: [
      apiKeySetting('Hugging Face', 'https://huggingface.co/settings/tokens'),
    ],
    models: [
      {
        id: 'moonshotai/Kimi-K2-Instruct:groq',
        name: 'Kimi-K2-Instruct',
        provider: 'huggingface',
        version: '1.0',
        description: '1T parameters Moonshot chat model tuned for tool-aware, nuanced responses.',
        capabilities: ['completion', 'tools'],
      },
      {
        id: 'deepseek-ai/DeepSeek-R1-0528',
        name: 'DeepSeek-R1-0528',
        provider: 'huggingface',
        version: '1.0',
        description: "DeepSeek's flagship reasoning engine with open weights and advanced tool control.",
        capabilities: ['completion', 'tools'],
      },
      {
        id: 'deepseek-ai/DeepSeek-V3-0324',
        name: 'DeepSeek-V3-0324',
        provider: 'huggingface',
        version: '1.0',
        description: 'Streamlined DeepSeek model focused on fast, high-quality completions and tool use.',
        capabilities: ['completion', 'tools'],
      },
    ],
  },

  // ── NVIDIA NIM ──────────────────────────────────────────────────
  {
    active: true,
    api_key: '',
    base_url: 'https://integrate.api.nvidia.com/v1',
    explore_models_url: 'https://build.nvidia.com/models',
    provider: 'nvidia',
    settings: [
      apiKeySetting('NVIDIA NIM', 'https://org.ngc.nvidia.com/setup/api-keys'),
    ],
    models: [],
  },
]

// ═══════════════════════════════════════════════════════════════════
// Local Providers (always present)
// ═══════════════════════════════════════════════════════════════════

export const localProviders: ModelProvider[] = [
  {
    active: true,
    provider: 'llamacpp',
    base_url: 'http://localhost:8080',
    models: [],
    settings: [],
    persist: true,
  },
]

// ═══════════════════════════════════════════════════════════════════
// Utility: Check if provider is local
// ═══════════════════════════════════════════════════════════════════

export function isLocalProvider(providerName: string): boolean {
  return providerName === 'llamacpp' || providerName === 'mlx'
}

// ═══════════════════════════════════════════════════════════════════
// Utility: Get provider display title
// ═══════════════════════════════════════════════════════════════════

export function getProviderTitle(providerName: string): string {
  return providerMetadata[providerName]?.name || providerName
}

// ═══════════════════════════════════════════════════════════════════
// Utility: Get model display name
// ═══════════════════════════════════════════════════════════════════

export function getModelDisplayName(model: { id: string; name?: string; displayName?: string }): string {
  return model.displayName || model.name || model.id
}

// ═══════════════════════════════════════════════════════════════════
// Utility: Check if provider has remote API keys
// ═══════════════════════════════════════════════════════════════════

export function providerHasRemoteApiKeys(provider: {
  api_key?: string
  api_key_fallbacks?: string[]
}): boolean {
  const primary = provider.api_key?.trim()
  const fallbacks = (provider.api_key_fallbacks ?? [])
    .map((k) => String(k).trim())
    .filter((k) => k.length > 0)
  const hasPrimary = !!primary
  const hasFallbacks = fallbacks.length > 0
  return hasPrimary || hasFallbacks
}
