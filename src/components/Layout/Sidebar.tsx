import { NavLink } from "react-router-dom";
import { Home, Microscope, Layers, Palette, BrainCircuit, Beaker, MessageSquare, Image, Settings, HelpCircle, Info } from "lucide-react";
import Logo from "../ui/Logo";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const topNav: NavItem[] = [
  { to: "/", icon: <Home size={18} />, label: "Home" },
  { to: "/detection", icon: <Microscope size={18} />, label: "Detection" },
  { to: "/segmentation", icon: <Layers size={18} />, label: "Segmentation" },
  { to: "/color-analysis", icon: <Palette size={18} />, label: "Color Analysis" },
  { to: "/trainable", icon: <BrainCircuit size={18} />, label: "Trainable" },
  { to: "/multi-slide", icon: <Beaker size={18} />, label: "Multi-Slide" },
  { to: "/editor", icon: <Image size={18} />, label: "Editor" },
  { to: "/llm/chat", icon: <MessageSquare size={18} />, label: "AI Chat" },
];

const bottomNav: NavItem[] = [
  { to: "/help", icon: <HelpCircle size={18} />, label: "Help" },
  { to: "/about", icon: <Info size={18} />, label: "About" },
  { to: "/settings", icon: <Settings size={18} />, label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-[68px] h-full flex flex-col items-center py-5 bg-surface-1/60 border-r border-glass-border shrink-0 z-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.03] via-transparent to-purple-500/[0.02] pointer-events-none" />

      <div className="mb-6 relative z-10">
        <NavLink to="/" title="TissueAI Dashboard">
          <Logo size={36} variant="icon" animated />
        </NavLink>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1 relative z-10">
        {topNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={item.label}
            className={({ isActive }) =>
              `group w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
                isActive
                  ? "bg-accent/15 text-accent shadow-[0_0_16px_rgba(91,168,245,0.2)]"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-white/[0.05]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent shadow-[0_0_8px_rgba(91,168,245,0.5)]" />
                )}
                {item.icon}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-1 relative z-10">
        <div className="w-6 h-[1px] bg-glass-border mb-2" />
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-white/[0.05]"
              }`
            }
          >
            {item.icon}
          </NavLink>
        ))}
      </div>

      <div className="mt-4 relative z-10">
        <div className="text-[9px] text-text-4th font-medium tracking-wider">v0.1</div>
      </div>
    </aside>
  );
}
