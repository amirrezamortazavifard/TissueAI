import { Outlet } from "react-router-dom";
import { BottomDock } from "./BottomDock";
import { WindowControls } from "./WindowControls";

export default function MainLayout() {
  return (
    <div className="app-layout">
      <div className="app-bg-orb app-bg-orb-1" />
      <div className="app-bg-orb app-bg-orb-2" />
      <div className="app-bg-orb app-bg-orb-3" />

      <header className="titlebar" data-tauri-drag-region>
        <div className="titlebar-left" data-tauri-drag-region>
          <span className="titlebar-title" data-tauri-drag-region>TissueAI</span>
        </div>
        <div className="titlebar-right">
          <WindowControls />
        </div>
      </header>

      <div className="app-layout-inner">
        <main className="app-main page-enter">
          <Outlet />
        </main>
      </div>

      <BottomDock />
    </div>
  );
}
