import {
  ArrowUpRight,
  Bot,
  Folder,
  Mail,
  Menu,
  MessageSquarePlus,
  Settings,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSidebar } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAgentMode } from '@/hooks/useAgentMode'
import { TEMPORARY_CHAT_ID } from '@/constants/chat'
import { useNavSectionFocus } from '@/stores/nav-section-focus-store'
import { cn } from '@/lib/utils'

function RailButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            'flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-white/[0.08] hover:text-foreground',
            active && 'bg-primary/[0.12] text-primary shadow-sm shadow-primary/[0.15]'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function NavRail() {
  const navigate = useNavigate()
  const { setOpen, toggleSidebar } = useSidebar()
  const focus = useNavSectionFocus((state) => state.focus)

  // Agent mode for the current thread (or temporary chat)
  const agentModeKey = TEMPORARY_CHAT_ID
  const isAgentMode = useAgentMode((state) =>
    state.agentThreads[agentModeKey] === true
  )
  const toggleAgentMode = useAgentMode((state) => state.toggleAgentMode)

  const startNewChat = () => {
    useAgentMode.getState().removeThread(TEMPORARY_CHAT_ID)
    navigate('/llm/chat')
  }

  const handleAgentToggle = () => {
    toggleAgentMode(agentModeKey)
  }

  return (
    <div className="chat-nav-rail hidden md:flex w-14 shrink-0 flex-col items-center justify-between py-4 pb-20 border-r-0 z-40">
      <div className="flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="TissueAI home"
              onClick={() => navigate('/llm/chat')}
              className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5BA8F5] via-[#8b5cf6] to-[#06b6d4] text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
            >
              <ArrowUpRight size={18} strokeWidth={2.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            TissueAI
          </TooltipContent>
        </Tooltip>

        <RailButton label="Menu" onClick={toggleSidebar}>
          <Menu size={19} />
        </RailButton>
        <RailButton label="New chat" onClick={startNewChat}>
          <MessageSquarePlus size={19} />
        </RailButton>
        <RailButton
          label={isAgentMode ? 'Agent mode active' : 'Enable agent mode'}
          active={isAgentMode}
          onClick={handleAgentToggle}
        >
          <Bot size={19} />
        </RailButton>
        <RailButton
          label="Chat history"
          onClick={() => {
            setOpen(true)
            focus('chats')
          }}
        >
          <Mail size={19} />
        </RailButton>
        <RailButton
          label="Projects"
          onClick={() => {
            setOpen(true)
            focus('projects')
          }}
        >
          <Folder size={19} />
        </RailButton>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="h-px w-7 bg-white/[0.08]" />
        <RailButton
          label="Settings"
          onClick={() => navigate('/settings')}
        >
          <Settings size={19} />
        </RailButton>
        <RailButton
          label="Profile"
          onClick={() => navigate('/settings')}
        >
          <UserRound size={19} />
        </RailButton>
      </div>
    </div>
  )
}
