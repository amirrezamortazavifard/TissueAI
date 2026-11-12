import { Outlet } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import { NavRail } from "@/components/left-sidebar/NavRail"
import { LeftSidebar } from "@/components/left-sidebar"
import { BottomDock } from "@/components/Layout/BottomDock"
import { WindowControls } from "@/components/Layout/WindowControls"

export default function ChatLayout() {
  return (
    <div className="app-layout bg-neutral-50 dark:bg-background">
      <header className="titlebar" data-tauri-drag-region>
        <div className="titlebar-left" data-tauri-drag-region>
          <span className="titlebar-title" data-tauri-drag-region>TissueAI</span>
        </div>
        <div className="titlebar-right">
          <WindowControls />
        </div>
      </header>
      <div className="chat-stage app-layout-inner flex-1 min-h-0 flex-col">
        <div className="chat-grid-bg" />
        <div className="liquid-blob" />
        <div className="relative z-10 flex flex-1 min-h-0">
          <SidebarProvider
            defaultOpen={false}
            className="min-h-0! w-full"
          >
            <NavRail />
            <LeftSidebar />
            <main className="relative flex flex-1 flex-col bg-transparent min-w-0 min-h-0">
              <Outlet />
            </main>
          </SidebarProvider>
        </div>
      </div>
      <BottomDock />
    </div>
  )
}
