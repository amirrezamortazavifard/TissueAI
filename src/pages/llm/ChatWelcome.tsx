import { memo, useEffect, useState } from 'react'
import { Globe, LineChart, FileText, ArrowUpRight } from 'lucide-react'
import { useWelcomePrompt } from '@/stores/welcome-prompt-store'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'
import { invoke } from '@tauri-apps/api/core'

const SUGGESTIONS = [
  {
    id: 'tissue-analysis',
    title: 'Tissue Analysis',
    description: 'Analyze tissue samples with AI-powered detection and segmentation',
    prompt: 'Help me analyze tissue samples using AI detection and segmentation tools',
    icon: Globe,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
  },
  {
    id: 'image-editor',
    title: 'Image Enhancement',
    description: 'Edit and enhance your microscopy images with professional tools',
    prompt: 'Help me edit and enhance my microscopy images with available tools',
    icon: LineChart,
    color: '#5BA8F5',
    bgColor: 'rgba(91, 168, 245, 0.12)',
  },
  {
    id: 'research-hub',
    title: 'Research Hub',
    description: 'Access research tools, batch processing, and deep analysis',
    prompt: 'Help me with batch processing and deep analysis of my research data',
    icon: FileText,
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
  },
]

function getUserName(): { full: string; first: string } {
  try {
    const stored = localStorage.getItem('tissueai_display_name')
    if (stored?.trim()) {
      const full = stored.trim()
      const first = full.split(/\s+/)[0] || full
      return { full, first }
    }
  } catch {
    // ignore
  }
  return { full: 'User', first: 'User' }
}

async function fetchOsUsername(): Promise<string> {
  try {
    return await invoke<string>('get_os_username')
  } catch {
    return 'User'
  }
}

const ChatWelcome = memo(function ChatWelcome({
  className,
}: {
  className?: string
}) {
  const [userName, setUserName] = useState(getUserName())
  const setPrompt = useWelcomePrompt((s) => s.setPrompt)

  useEffect(() => {
    const loadUsername = async () => {
      const osName = await fetchOsUsername()
      const stored = localStorage.getItem('tissueai_display_name')
      if (!stored?.trim()) {
        setUserName({ full: osName, first: osName.split(/\s+/)[0] || osName })
      }
    }
    loadUsername()
  }, [])

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-12 px-6 relative z-10',
        className
      )}
    >
      {/* Welcome heading */}
      <div className="chat-welcome-heading flex flex-col items-center gap-5 text-center">
        <span className="sd-welcome-enter sd-welcome-badge">
          <span className="size-1.5 rounded-full bg-[#5BA8F5] shadow-[0_0_8px_rgba(91,168,245,0.8)]" />
          TissueAI · AI Workspace
        </span>
        <div className="sd-welcome-enter sd-welcome-delay-1 flex flex-col items-center gap-3">
          <h1 className="chat-welcome-gradient text-6xl font-bold tracking-tight leading-tight">
            Hello {userName.first}
          </h1>
          <p className="text-2xl font-medium text-muted-foreground/60">
            How can I help you today?
          </p>
        </div>
      </div>

      {/* Suggestion cards */}
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3 sd-welcome-enter sd-welcome-delay-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setPrompt(s.prompt)}
            className="chat-suggestion-card-clean group flex flex-col items-start gap-3 text-left"
          >
            <div
              className="flex size-11 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-110"
              style={{
                background: s.bgColor,
              }}
            >
              <s.icon size={21} style={{ color: s.color }} />
            </div>
            <div className="flex flex-col gap-1.5 pr-4">
              <span className="text-sm font-semibold text-foreground/85">
                {s.title}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground/60">
                {s.description}
              </span>
            </div>
            <ArrowUpRight
              size={16}
              className="sd-card-arrow"
              strokeWidth={2.5}
            />
          </button>
        ))}
      </div>

      {/* Keyboard hints */}
      <div className="sd-welcome-enter sd-welcome-delay-3 flex items-center gap-2 text-xs text-muted-foreground/40">
        <Kbd>
          <span className="uppercase">Ctrl</span> K
        </Kbd>
        <span>Search chats</span>
        <span className="mx-1 opacity-50">·</span>
        <Kbd>
          <span className="uppercase">{'Enter'}</span>
        </Kbd>
        <span>Send message</span>
      </div>
    </div>
  )
})

export default ChatWelcome
