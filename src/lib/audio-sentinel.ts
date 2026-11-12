// Audio attachments enter the AI SDK as `file` parts with audio mediaType,
// but `@ai-sdk/openai-compatible` rejects any non-image file part. To bypass
// that converter without forking the provider, we encode each audio part as a
// text sentinel before `streamText` and decode it back into an OpenAI
// `input_audio` content part inside the request fetch.

export type AudioFormat = 'wav' | 'mp3'

const PREFIX = ' __JAN_AUDIO__'
const SUFFIX = ' '

// eslint-disable-next-line no-control-regex
const SENTINEL_REGEX = / __JAN_AUDIO__(wav|mp3)([A-Za-z0-9+/=]+) /g

export function encodeAudioSentinel(format: AudioFormat, base64: string): string {
  return `${PREFIX}${format}${base64}${SUFFIX}`
}

export function hasAudioSentinel(text: string): boolean {
  return text.includes(PREFIX)
}

export type AudioPart = { type: 'input_audio'; input_audio: { data: string; format: AudioFormat } }

// Splits a sentinel-bearing string into an ordered array of OpenAI content
// parts. Returns null when no sentinel is present so callers can keep the
// original string form.
export function splitAudioSentinels(
  text: string
): Array<{ type: 'text'; text: string } | AudioPart> | null {
  if (!hasAudioSentinel(text)) return null
  const parts: Array<{ type: 'text'; text: string } | AudioPart> = []
  let lastIndex = 0
  SENTINEL_REGEX.lastIndex = 0
  for (let m = SENTINEL_REGEX.exec(text); m !== null; m = SENTINEL_REGEX.exec(text)) {
    const [match, format, data] = m
    if (m.index > lastIndex) {
      const chunk = text.slice(lastIndex, m.index)
      if (chunk.length > 0) parts.push({ type: 'text', text: chunk })
    }
    parts.push({ type: 'input_audio', input_audio: { data, format: format as AudioFormat } })
    lastIndex = m.index + match.length
  }
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex)
    if (tail.length > 0) parts.push({ type: 'text', text: tail })
  }
  return parts
}

// Extracts the base64 payload from a `data:audio/<x>;base64,...` URL.
// Returns null on shapes we don't recognise.
export function parseAudioDataUrl(url: string): { format: AudioFormat; data: string } | null {
  const match = /^data:audio\/(mpeg|mp3|wav|wave|x-wav);base64,(.+)$/i.exec(url)
  if (!match) return null
  const mime = match[1].toLowerCase()
  const format: AudioFormat = mime === 'wav' || mime === 'wave' || mime === 'x-wav' ? 'wav' : 'mp3'
  return { format, data: match[2] }
}
