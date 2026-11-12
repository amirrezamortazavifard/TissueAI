import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarGroupAction,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useThreads } from "@/hooks/useThreads"
import ThreadList from "@/containers/ThreadList"
import { DeleteAllThreadsDialog } from "@/containers/dialogs/DeleteAllThreadsDialog"
import { useNavSectionFocus } from "@/stores/nav-section-focus-store"
import { cn } from "@/lib/utils"
import type { Thread } from '@/types/core'
import { TEMPORARY_CHAT_ID } from "@/constants/chat"

export function NavChats() {
  const { t } = useTranslation()
  const threads = useThreads((state) => state.threads)
  const isLoadingThreads = useThreads((state) => state.isLoadingThreads)
  const deleteAllThreads = useThreads((state) => state.deleteAllThreads)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return useNavSectionFocus.subscribe((state) => {
      if (state.section === 'chats') {
        setFlash(true)
        groupRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlash(false), 1600)
      }
    })
  }, [])

  // Show ALL non-temporary threads here (including ones that belong to a
  // project). Previously project-scoped chats were filtered out, so the section
  // rendered "No chats" even when history existed — the reported bug.
  // Using Object.values(threads) guarantees we bypass any searchIndex/getFilteredThreads cache issues.
  const recentChats = useMemo(() => {
    return Object.values(threads).filter((t) => t.id !== TEMPORARY_CHAT_ID && !t.metadata?.isTemporary)
  }, [threads])

  if (recentChats.length === 0) {
    if (isLoadingThreads) {
      return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="sidebar-section-label">
            {t('common:recentChats')}
          </SidebarGroupLabel>
          <div className="flex items-center justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        </SidebarGroup>
      )
    }
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="sidebar-section-label">
          {t('common:recentChats')}
        </SidebarGroupLabel>
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {t('common:noChats')}
        </p>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup
      ref={groupRef}
      className={cn(
        'group-data-[collapsible=icon]:hidden transition-shadow rounded-lg',
        flash && 'ring-1 ring-primary/60 shadow-lg shadow-primary/10'
      )}
    >
      <SidebarGroupLabel className="sidebar-section-label">
        {t('common:recentChats')}
      </SidebarGroupLabel>
      {recentChats.length > 1 && 
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarGroupAction className="hover:bg-sidebar-foreground/[0.08] transition-colors duration-200">
              <MoreHorizontal className="text-muted-foreground" />
              <span className="sr-only">More</span>
            </SidebarGroupAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DeleteAllThreadsDialog
              onDeleteAll={deleteAllThreads}
              onDropdownClose={() => setDropdownOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      }
      <SidebarMenu>
        <ThreadList threads={recentChats as Thread[]} />
      </SidebarMenu>
    </SidebarGroup>
  )
}
