import { DownloadManagement } from '@/containers/DownloadManegement'
import { NavChats } from './NavChats'
import { NavMain } from './NavMain'
import { NavProjects } from './NavProjects'
import { useLeftPanel } from '@/hooks/useLeftPanel'
import { useSearchDialog } from '@/hooks/useSearchDialog'
import { Link } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar'
import { ArrowUpRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LeftSidebar() {
  const { open: isLeftPanelOpen } = useLeftPanel()
  const setSearchOpen = useSearchDialog((state) => state.setOpen)

  return (
    <div className="relative z-50">
      <Sidebar
        variant="floating"
        collapsible="offcanvas"
        className="chat-sidebar-panel"
      >
        <SidebarHeader className="gap-3 p-3 pb-1">
          {/* Branding row */}
          <div className="flex items-center justify-between">
            <Link
              to="/llm/chat"
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-all duration-200 hover:bg-sidebar-accent/50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5BA8F5] via-[#8b5cf6] to-[#06b6d4] text-white shadow-lg shadow-primary/20 transition-shadow duration-200 hover:shadow-xl hover:shadow-primary/30">
                <ArrowUpRight size={17} strokeWidth={2.5} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground font-studio">
                TissueAI
              </span>
            </Link>
            <div className="flex items-center">
              {isLeftPanelOpen && <DownloadManagement />}
              <SidebarTrigger className="ml-0.5 -mt-0.5 relative z-50 rounded-full text-muted-foreground hover:bg-sidebar-foreground/[0.06] transition-colors duration-200" />
            </div>
          </div>

          {/* Global search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border/[0.5] bg-sidebar-foreground/[0.04] px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:border-sidebar-ring/30 hover:bg-sidebar-foreground/[0.07]"
          >
            <Search
              size={15}
              className="shrink-0 text-muted-foreground/60 group-hover:text-foreground/70 transition-colors duration-200"
            />
            <span className="truncate">Search chats</span>
            <kbd className="ml-auto hidden shrink-0 rounded-md border border-sidebar-border/[0.5] bg-sidebar-foreground/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              <span className="text-[10px] uppercase">Ctrl</span> K
            </kbd>
          </button>
        </SidebarHeader>

        <SidebarSeparator className="my-1" />

        <SidebarContent className="mask-b-from-95% mask-t-from-98% gap-1">
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="sidebar-section-label">
              {'Menu'}
            </SidebarGroupLabel>
            <NavMain />
          </SidebarGroup>
          <NavProjects />
          <NavChats />
        </SidebarContent>

        {/* Upgrade CTA */}
        <SidebarFooter className="p-3">
          <div className="sidebar-pro-card">
            <div className="flex items-start justify-between">
              <span className="badge badge-purple">PRO</span>
              <SparklesDecor />
            </div>
            <h4 className="mt-2 text-sm font-semibold text-foreground/90">
              Upgrade to PRO
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Unlock unlimited models, faster inference and priority support.
            </p>
            <button
              type="button"
              onClick={() => {}}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-2 text-xs font-semibold text-[#a78bfa] transition-all hover:bg-[#8b5cf6]/20"
            >
              Learn More
              <ArrowUpRight size={14} />
            </button>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </div>
  )
}

function SparklesDecor() {
  return (
    <span
      className={cn(
        'pointer-events-none absolute -right-8 -top-8 size-20 rounded-full',
        'bg-[#8b5cf6]/20 blur-2xl'
      )}
      aria-hidden
    />
  )
}