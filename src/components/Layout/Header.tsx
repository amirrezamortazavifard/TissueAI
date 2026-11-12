import { Minus, Square, X, Search, Bell } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLocation } from "react-router-dom";
import { useNotification } from "../../contexts/NotificationContext";
import Logo from "../ui/Logo";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/detection": "Cell Detection",
  "/segmentation": "Segmentation",
  "/color-analysis": "Color Analysis",
  "/trainable": "Trainable Classifier",
  "/multi-slide": "Multi-Slide",
  "/editor": "Editor",
  "/chat": "AI Chat",
  "/settings": "Settings",
  "/help": "Help",
  "/about": "About",
  "/agent-workspace": "Unified Pathologist Workspace",
};

export default function Header() {
  const location = useLocation();
  const pageLabel = routeLabels[location.pathname] || "Dashboard";
  const { notifications } = useNotification();
  const notifCount = notifications.length;

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
    } catch (err) {
      console.error("Failed to toggle maximize window:", err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (err) {
      console.error("Failed to close window:", err);
    }
  };

  return (
    <header
      data-tauri-drag-region
      className="h-12 flex items-center justify-between px-5 border-b border-glass-border bg-surface-1/40 backdrop-blur-xl select-none shrink-0 z-20 relative"
    >
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none" />

      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
          <Logo size={22} variant="full" animated />
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-4th opacity-40">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="text-[12px] text-text-tertiary font-medium tracking-wide">{pageLabel}</span>
      </div>

      <div data-tauri-drag-region="false" className="flex items-center gap-1.5">
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.05] transition-all duration-200">
          <Search size={15} />
        </button>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.05] transition-all duration-200 relative">
          <Bell size={15} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-[#5BA8F5] rounded-full text-[8px] font-bold text-white px-1 shadow-[0_0_8px_rgba(91,168,245,0.5)]">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>
        <div className="w-px h-4 bg-glass-border mx-1.5" />
        
        {/* Titlebar Window Control Buttons */}
        <button
          data-tauri-drag-region="false"
          onClick={handleMinimize}
          className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          data-tauri-drag-region="false"
          onClick={handleMaximize}
          className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
          title="Maximize / Restore"
        >
          <Square size={10} />
        </button>
        <button
          data-tauri-drag-region="false"
          onClick={handleClose}
          className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-white hover:bg-danger/80 transition-all duration-200 cursor-pointer"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
}
