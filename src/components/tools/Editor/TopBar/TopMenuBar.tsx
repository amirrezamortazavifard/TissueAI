import { useState, useRef, useEffect } from "react";

interface TopMenuBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoom100: () => void;
  onToggleRulers: () => void;
  onToggleGrid: () => void;
  onToggleStatusBar: () => void;
  onResize: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onRotate180: () => void;
  onCropToSelection: () => void;
  
  // New handlers
  onFilterBlur?: () => void;
  onFilterSharpen?: () => void;
  onFilterEdge?: () => void;
  onAnalysisCellCount?: () => void;
  onAnalysisStain?: () => void;

  showRulers: boolean;
  showGrid: boolean;
  showStatusBar: boolean;
  canUndo: boolean;
  canRedo: boolean;
  imageLoaded: boolean;
}

interface MenuDef {
  label: string;
  items: { label: string; shortcut?: string; action?: () => void; disabled?: boolean; divider?: boolean }[];
}

export default function TopMenuBar(props: TopMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "New...", shortcut: "Ctrl+N", action: props.onNew },
        { label: "Open...", shortcut: "Ctrl+O", action: props.onOpen },
        { label: "", divider: true },
        { label: "Save", shortcut: "Ctrl+S", action: props.onSave, disabled: !props.imageLoaded },
        { label: "Save As...", shortcut: "Ctrl+Shift+S", action: props.onSaveAs, disabled: !props.imageLoaded },
        { label: "", divider: true },
        { label: "Export to DICOM...", disabled: !props.imageLoaded },
        { label: "Export to OME-TIFF...", disabled: !props.imageLoaded },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", action: props.onUndo, disabled: !props.canUndo },
        { label: "Redo", shortcut: "Ctrl+Y", action: props.onRedo, disabled: !props.canRedo },
        { label: "", divider: true },
        { label: "Cut", shortcut: "Ctrl+X", disabled: true },
        { label: "Copy", shortcut: "Ctrl+C", disabled: true },
        { label: "Paste", shortcut: "Ctrl+V", disabled: true },
        { label: "", divider: true },
        { label: "Fill...", shortcut: "Shift+F5", disabled: !props.imageLoaded },
        { label: "Stroke...", disabled: !props.imageLoaded },
      ],
    },
    {
      label: "Image",
      items: [
        { label: "Image Size...", action: props.onResize, disabled: !props.imageLoaded },
        { label: "Canvas Size...", disabled: !props.imageLoaded },
        { label: "Crop to Selection", action: props.onCropToSelection, disabled: !props.imageLoaded },
        { label: "", divider: true },
        { label: "Flip Horizontal", action: props.onFlipH, disabled: !props.imageLoaded },
        { label: "Flip Vertical", action: props.onFlipV, disabled: !props.imageLoaded },
        { label: "", divider: true },
        { label: "Rotate 90° CW", action: props.onRotateRight, disabled: !props.imageLoaded },
        { label: "Rotate 90° CCW", action: props.onRotateLeft, disabled: !props.imageLoaded },
        { label: "Rotate 180°", action: props.onRotate180, disabled: !props.imageLoaded },
      ],
    },
    {
      label: "Layer",
      items: [
        { label: "New Layer", shortcut: "Ctrl+Shift+N" },
        { label: "Duplicate Layer", shortcut: "Ctrl+J" },
        { label: "Delete Layer" },
        { label: "", divider: true },
        { label: "Merge Down", shortcut: "Ctrl+E" },
        { label: "Merge Visible", shortcut: "Ctrl+Shift+E" },
        { label: "Flatten Image" },
      ],
    },
    {
      label: "Select",
      items: [
        { label: "All", shortcut: "Ctrl+A" },
        { label: "Deselect", shortcut: "Ctrl+D" },
        { label: "Reselect", shortcut: "Ctrl+Shift+D" },
        { label: "Inverse", shortcut: "Ctrl+Shift+I" },
        { label: "", divider: true },
        { label: "Color Range..." },
        { label: "Tissue Region (Auto)" },
      ],
    },
    {
      label: "Filter",
      items: [
        { label: "Gaussian Blur...", action: props.onFilterBlur, disabled: !props.imageLoaded },
        { label: "Unsharp Mask...", action: props.onFilterSharpen, disabled: !props.imageLoaded },
        { label: "Find Edges (Sobel)", action: props.onFilterEdge, disabled: !props.imageLoaded },
        { label: "", divider: true },
        { label: "Noise Reduction..." },
        { label: "Background Correction..." },
      ],
    },
    {
      label: "Analysis",
      items: [
        { label: "Cell Detection (AI)...", action: props.onAnalysisCellCount, disabled: !props.imageLoaded },
        { label: "Nuclei Segmentation...", disabled: !props.imageLoaded },
        { label: "Tissue Classification...", disabled: !props.imageLoaded },
        { label: "", divider: true },
        { label: "Stain Deconvolution...", action: props.onAnalysisStain, disabled: !props.imageLoaded },
        { label: "Calculate IHC Score..." },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Zoom In", shortcut: "Ctrl++", action: props.onZoomIn },
        { label: "Zoom Out", shortcut: "Ctrl+-", action: props.onZoomOut },
        { label: "Fit on Screen", shortcut: "Ctrl+0", action: props.onZoomFit },
        { label: "100%", shortcut: "Ctrl+1", action: props.onZoom100 },
        { label: "", divider: true },
        { label: `${props.showRulers ? "✓ " : "  "}Rulers`, shortcut: "Ctrl+R", action: props.onToggleRulers },
        { label: `${props.showGrid ? "✓ " : "  "}Grid`, shortcut: "Ctrl+'", action: props.onToggleGrid },
        { label: `${props.showStatusBar ? "✓ " : "  "}Status Bar`, action: props.onToggleStatusBar },
      ],
    },
  ];

  return (
    <div ref={menuRef} className="ed-topbar">
      <div className="flex items-center">
        {menus.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
              className={`px-3 py-1 text-xs rounded hover:bg-white/10 transition-colors ${
                openMenu === menu.label ? "bg-white/10 text-white" : "text-white/70"
              }`}
            >
              {menu.label}
            </button>
            
            {openMenu === menu.label && (
              <div className="absolute top-full left-0 mt-1 min-w-[220px] py-1.5 rounded-lg bg-[rgba(15,20,30,0.95)] backdrop-blur-xl border border-white/10 shadow-2xl z-50 animate-fade-in">
                {menu.items.map((item, i) =>
                  item.divider ? (
                    <div key={i} className="h-px bg-white/10 my-1.5 mx-2" />
                  ) : (
                    <button
                      key={i}
                      onClick={() => {
                        item.action?.();
                        setOpenMenu(null);
                      }}
                      disabled={item.disabled}
                      className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="text-white/40 ml-4 font-mono">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
