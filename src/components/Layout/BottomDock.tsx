import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Microscope,
  Layers,
  Brain,
  Palette,
  Paintbrush,
  Box,
  Scissors,
  Settings,
  BookOpen,
  Info,
  Sun,
  Moon,
  MessageSquare,
  Cpu,
  Bot,
  Wrench,
  Puzzle,
  Heart,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const toolItems = [
  { to: "/detection", label: "Detection", icon: Microscope },
  { to: "/segmentation", label: "Segmentation", icon: Scissors },
  { to: "/multi-slide", label: "Multi-Slide", icon: Layers },
  { to: "/trainable", label: "Trainable", icon: Brain },
  { to: "/color-analysis", label: "Colors", icon: Palette },
  { to: "/editor", label: "Editor", icon: Paintbrush },
  { to: "/three", label: "3D View", icon: Box },
];

const systemItems = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: BookOpen },
  { to: "/about", label: "About", icon: Info },
];

function DropdownGroup({
  label,
  icon: Icon,
  items,
  isActive,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  items: { to: string; label: string; icon: React.ComponentType<{ size?: number }> }[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="agent-dropdown-wrap" ref={ref}>
      <button
        className={`dock-item agent-trigger ${isActive ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        title={label}
      >
        <Icon size={16} />
        <span className="dock-label">{label}</span>
      </button>

      <div className={`agent-menu ${open ? "open" : ""}`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="agent-menu-item"
            onClick={() => setOpen(false)}
          >
            <item.icon size={15} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function BottomDock() {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const isToolsActive = toolItems.some((item) => location.pathname.startsWith(item.to));
  const isAgentActive = location.pathname.startsWith("/llm") || location.pathname.startsWith("/chat") || location.pathname.startsWith("/mcp-settings");
  const isSystemActive = systemItems.some((item) => location.pathname.startsWith(item.to));
  const isAnatomyActive = location.pathname.startsWith("/anatomy");

  return (
    <div className="bottom-dock">
      <div className="dock-container">
        <NavLink
          to="/"
          className={`dock-item ${location.pathname === "/" ? "active" : ""}`}
        >
          <LayoutDashboard size={16} />
          <span className="dock-label">Home</span>
        </NavLink>

        <div className="dock-divider" />

        <DropdownGroup
          label="Tools"
          icon={Wrench}
          items={toolItems}
          isActive={isToolsActive}
        />

        <DropdownGroup
          label="Agent"
          icon={Bot}
          items={[
            { to: "/llm", label: "Models", icon: Cpu },
            { to: "/llm/chat", label: "Chat", icon: MessageSquare },
            { to: "/agent-workspace", label: "ایجنت", icon: Bot },
            { to: "/mcp-settings", label: "MCP Servers", icon: Puzzle },
          ]}
          isActive={isAgentActive}
        />

        <DropdownGroup
          label="Anatomy"
          icon={Heart}
          items={[
            { to: "/anatomy", label: "Anatomy Atelier", icon: Heart },
          ]}
          isActive={isAnatomyActive}
        />

        <DropdownGroup
          label="System"
          icon={Settings}
          items={systemItems}
          isActive={isSystemActive}
        />

        <div className="dock-divider" />

        <button
          className="theme-toggle"
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  );
}
