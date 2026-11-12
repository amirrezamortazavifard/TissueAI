/**
 * Local web search backend mirroring the `tauri-plugin-websearch` guest API
 * (`webSearch` / `webFetch`). TissueAI ships without the Rust plugin, so the
 * Exa / Tavily / SearXNG wire protocols are re-implemented here over
 * `@tauri-apps/plugin-http` fetch.
 */

import { fetch as httpFetch } from '@tauri-apps/plugin-http'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  published_at?: string
}

export interface FetchedPage {
  url: string
  title: string
  content: string
  truncated: boolean
}

const FETCH_MAX_CHARS = 40_000
const SEARCH_DEFAULT_COUNT = 5
const SEARCH_MAX_COUNT = 20

const EXA_HOSTED_URL = 'https://mcp.exa.ai/mcp'
const EXA_REST_SEARCH_URL = 'https://api.exa.ai/search'
const EXA_REST_CONTENTS_URL = 'https://api.exa.ai/contents'

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract'

const normalizeKey = (apiKey?: string): string | undefined => {
  const v = (apiKey ?? '').trim()
  return v && v !== 'YOUR_EXA_API_KEY_HERE' ? v : undefined
}

const clipChars = (s: string, max: number): string =>
  Array.from(s).length <= max ? s : Array.from(s).slice(0, max).join('')

const boundText = (s: string): { content: string; truncated: boolean } =>
  Array.from(s).length <= FETCH_MAX_CHARS
    ? { content: s, truncated: false }
    : {
        content: Array.from(s).slice(0, FETCH_MAX_CHARS).join(''),
        truncated: true,
      }

async function postText(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  const resp = await httpFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(
      `Web search request failed with HTTP ${resp.status}: ${clipChars(text, 400)}`
    )
  }
  return text
}

async function getText(url: string, headers?: Record<string, string>): Promise<string> {
  const resp = await httpFetch(url, { method: 'GET', headers })
  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(
      `Web fetch request failed with HTTP ${resp.status}: ${clipChars(text, 400)}`
    )
  }
  return text
}

function clampCount(requested?: number): number {
  if (requested === undefined || requested === 0) return SEARCH_DEFAULT_COUNT
  return Math.min(Math.max(1, requested), SEARCH_MAX_COUNT)
}

// ─────────────────────────────────────────────────────────────────────────
// Exa (keyless hosted MCP endpoint, or structured REST with a key)
// ─────────────────────────────────────────────────────────────────────────

async function exaHostedCall(tool: string, arguments_: Record<string, unknown>): Promise<string> {
  const text = await postText(
    EXA_HOSTED_URL,
    { accept: 'application/json, text/event-stream' },
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: arguments_ },
    })
  )
  const jsonStr = text
    .split('\n')
    .find((l) => l.startsWith('data:'))
    ?.slice(5)
    .trim() ?? text.trim()
  const parsed = JSON.parse(jsonStr) as {
    error?: unknown
    result?: { isError?: boolean; content?: Array<{ text?: string }> }
  }
  if (parsed.error) throw new Error(`Exa returned an error: ${String(parsed.error)}`)
  if (parsed.result?.isError === true) {
    throw new Error(
      parsed.result.content?.[0]?.text ?? 'Exa tool call failed with unknown error'
    )
  }
  const out = parsed.result?.content?.[0]?.text
  if (!out) throw new Error('Exa response had no text content')
  return out
}

function parseHostedSearchText(text: string): SearchResult[] {
  const out: SearchResult[] = []
  for (const rawBlock of text.split('\n---\n')) {
    const block = rawBlock.trim()
    if (!block) continue
    let title = ''
    let url = ''
    let published: string | undefined
    let inHighlights = false
    const snippetLines: string[] = []
    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim()
      if (line.startsWith('Title:')) {
        title = line.slice(6).trim()
      } else if (line.startsWith('URL:')) {
        url = line.slice(4).trim()
      } else if (line.startsWith('Published:')) {
        const v = line.slice(10).trim()
        if (v && v !== 'N/A') published = v
      } else if (line.startsWith('Highlights:')) {
        inHighlights = true
      } else if (inHighlights && line !== '...' && line) {
        snippetLines.push(line)
      }
    }
    if (!url && !title) continue
    out.push({
      title,
      url,
      snippet: clipChars(snippetLines.join(' '), 500),
      published_at: published,
    })
  }
  return out
}

function parseHostedFetchText(text: string, requestedUrl: string): FetchedPage {
  let title = ''
  let url = requestedUrl
  let bodyStart = 0
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (i === 0 && line.startsWith('# ')) {
      title = line.slice(2).trim()
    } else if (line.startsWith('URL:')) {
      url = line.slice(4).trim()
      bodyStart = i + 1
      break
    } else if (i > 2) {
      break
    }
  }
  const body = lines.slice(bodyStart).join('\n').trim()
  const source = body || text.trim()
  const { content, truncated } = boundText(source)
  return { url, title, content, truncated }
}

function normalizeExaRestSearch(body: Record<string, unknown>): SearchResult[] {
  const results = body.results
  if (!Array.isArray(results)) return []
  return results.map((r) => {
    const rec = (r ?? {}) as Record<string, unknown>
    const highlights = rec.highlights
    const firstHighlight = Array.isArray(highlights) ? highlights[0] : undefined
    const snippet =
      typeof firstHighlight === 'string'
        ? firstHighlight
        : typeof rec.text === 'string'
          ? clipChars(rec.text, 300)
          : ''
    return {
      title: typeof rec.title === 'string' ? rec.title : '',
      url: typeof rec.url === 'string' ? rec.url : '',
      snippet,
      published_at:
        typeof rec.publishedDate === 'string' && rec.publishedDate
          ? rec.publishedDate
          : undefined,
    }
  })
}

function normalizeExaRestFetch(body: Record<string, unknown>, requestedUrl: string): FetchedPage {
  const results = body.results
  const first = Array.isArray(results) ? results[0] : undefined
  if (!first || typeof first !== 'object') {
    throw new Error(`Exa fetch returned no content for ${requestedUrl}`)
  }
  const rec = first as Record<string, unknown>
  const { content, truncated } = boundText(
    typeof rec.text === 'string' ? rec.text : ''
  )
  return {
    url: typeof rec.url === 'string' ? rec.url : requestedUrl,
    title: typeof rec.title === 'string' ? rec.title : '',
    content,
    truncated,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tavily
// ─────────────────────────────────────────────────────────────────────────

function normalizeTavilySearch(body: Record<string, unknown>): SearchResult[] {
  const results = body.results
  if (!Array.isArray(results)) return []
  return results.map((r) => {
    const rec = (r ?? {}) as Record<string, unknown>
    return {
      title: typeof rec.title === 'string' ? rec.title : '',
      url: typeof rec.url === 'string' ? rec.url : '',
      snippet:
        typeof rec.content === 'string' ? clipChars(rec.content, 500) : '',
      published_at:
        typeof rec.published_date === 'string' && rec.published_date
          ? rec.published_date
          : undefined,
    }
  })
}

function normalizeTavilyExtract(body: Record<string, unknown>, requestedUrl: string): FetchedPage {
  const results = body.results
  const first = Array.isArray(results) ? results[0] : undefined
  if (!first || typeof first !== 'object') {
    throw new Error(`Tavily returned no content for ${requestedUrl}`)
  }
  const rec = first as Record<string, unknown>
  const { content, truncated } = boundText(
    typeof rec.raw_content === 'string' ? rec.raw_content : ''
  )
  return {
    url: typeof rec.url === 'string' ? rec.url : requestedUrl,
    title: '',
    content,
    truncated,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SearXNG
// ─────────────────────────────────────────────────────────────────────────

function normalizeSearxngSearch(body: Record<string, unknown>, count: number): SearchResult[] {
  const results = body.results
  if (!Array.isArray(results)) return []
  return results.slice(0, count).map((r) => {
    const rec = (r ?? {}) as Record<string, unknown>
    return {
      title: typeof rec.title === 'string' ? rec.title : '',
      url: typeof rec.url === 'string' ? rec.url : '',
      snippet: typeof rec.content === 'string' ? clipChars(rec.content, 500) : '',
      published_at:
        typeof rec.publishedDate === 'string' && rec.publishedDate
          ? rec.publishedDate
          : undefined,
    }
  })
}

function extractHtmlTitle(html: string): string | undefined {
  const lower = html.toLowerCase()
  const start = lower.indexOf('<title')
  if (start === -1) return undefined
  const openEnd = lower.indexOf('>', start) + 1
  if (openEnd <= 0) return undefined
  const close = lower.indexOf('</title>', openEnd)
  if (close === -1) return undefined
  const title = html.slice(openEnd, close).trim()
  return title || undefined
}

// ─────────────────────────────────────────────────────────────────────────
// Public API (mirrors `@janhq/tauri-plugin-websearch-api`)
// ─────────────────────────────────────────────────────────────────────────

export async function webSearch(
  query: string,
  count?: number,
  apiKey?: string,
  provider?: string,
  endpoint?: string
): Promise<SearchResult[]> {
  const p = (provider ?? '').trim().toLowerCase()
  const n = clampCount(count)
  const key = normalizeKey(apiKey)

  if (p === 'tavily') {
    if (!key) throw new Error('Tavily requires an API key')
    const text = await postText(
      TAVILY_SEARCH_URL,
      { authorization: `Bearer ${key}` },
      JSON.stringify({ query, max_results: n })
    )
    return normalizeTavilySearch(JSON.parse(text) as Record<string, unknown>)
  }

  if (p === 'searxng') {
    const base = (endpoint ?? '').trim().replace(/\/+$/, '')
    if (!base) throw new Error('SearXNG requires an instance URL')
    if (!/^https?:\/\//.test(base)) {
      throw new Error(`SearXNG instance URL must be an http(s) URL, got: ${base}`)
    }
    const text = await getText(
      `${base}/search?q=${encodeURIComponent(query)}&format=json`
    )
    return normalizeSearxngSearch(JSON.parse(text) as Record<string, unknown>, n)
  }

  // Default: Exa (hosted when keyless, REST when keyed)
  if (key) {
    const text = await postText(
      EXA_REST_SEARCH_URL,
      { 'x-api-key': key },
      JSON.stringify({
        query,
        type: 'auto',
        numResults: n,
        contents: {
          text: { maxCharacters: 800 },
          highlights: { numSentences: 3, highlightsPerUrl: 1 },
        },
      })
    )
    return normalizeExaRestSearch(JSON.parse(text) as Record<string, unknown>)
  }

  const text = await exaHostedCall('web_search_exa', {
    query,
    numResults: n,
  })
  return parseHostedSearchText(text)
}

export async function webFetch(
  url: string,
  apiKey?: string,
  provider?: string,
  endpoint?: string
): Promise<FetchedPage> {
  const p = (provider ?? '').trim().toLowerCase()
  const key = normalizeKey(apiKey)

  if (p === 'tavily') {
    if (!key) throw new Error('Tavily requires an API key')
    const text = await postText(
      TAVILY_EXTRACT_URL,
      { authorization: `Bearer ${key}` },
      JSON.stringify({ urls: [url] })
    )
    return normalizeTavilyExtract(JSON.parse(text) as Record<string, unknown>, url)
  }

  if (p === 'searxng') {
    const base = (endpoint ?? '').trim().replace(/\/+$/, '')
    if (!base) throw new Error('SearXNG requires an instance URL')
    const raw = await getText(url)
    const { content, truncated } = boundText(raw)
    return {
      url,
      title: extractHtmlTitle(raw) ?? '',
      content,
      truncated,
    }
  }

  if (key) {
    const text = await postText(
      EXA_REST_CONTENTS_URL,
      { 'x-api-key': key },
      JSON.stringify({ ids: [url], text: true })
    )
    return normalizeExaRestFetch(JSON.parse(text) as Record<string, unknown>, url)
  }

  // Keyless Exa hosted fetch
  const text = await exaHostedCall('web_fetch_exa', {
    urls: [url],
    maxCharacters: FETCH_MAX_CHARS,
  })
  return parseHostedFetchText(text, url)
}
