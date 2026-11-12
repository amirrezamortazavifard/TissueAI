import { useState, useCallback, memo } from 'react'
import { IconCheck, IconCopy } from '@tabler/icons-react'

type CopyButtonProps = {
  text: string
  className?: string
}

export const CopyButton = memo(function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={className || 'p-1 rounded hover:bg-[var(--bg-3)] transition-colors'}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
    </button>
  )
})
