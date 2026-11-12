import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState } from "react";
import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (err) {
      console.error("Minimize error:", err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      const isMax = await win.isMaximized();
      setMaximized(isMax);
    } catch (err) {
      console.error("Maximize error:", err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (err) {
      console.error("Close error:", err);
    }
  };

  return (
    <div data-tauri-drag-region="false" className="flex items-center gap-1.5">
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
        title={maximized ? "Restore" : "Maximize"}
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
  );
}
