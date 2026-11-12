import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl" | number;
  variant?: "icon" | "full";
  animated?: boolean;
  className?: string;
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = "md",
  variant = "full",
  animated = false,
  className = "",
  showSubtitle = false,
}) => {
  // Dimensions map
  const pixelSizes: Record<string, number> = {
    sm: 20,
    md: 28,
    lg: 40,
    xl: 64,
  };

  const px = typeof size === "number" ? size : pixelSizes[size] || 28;

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Glassmorphic Brain & Tissue Emblem */}
      <div
        className={`relative flex items-center justify-center shrink-0 transition-transform duration-300 ${
          animated ? "hover:scale-105" : ""
        }`}
        style={{ width: px, height: px }}
      >
        {/* Glow backdrop */}
        <div
          className={`absolute inset-0 rounded-xl bg-gradient-to-tr from-[#ec4899] via-[#c084fc] to-[#5BA8F5] opacity-40 blur-md ${
            animated ? "animate-pulse" : ""
          }`}
          style={{ transform: "scale(0.9)" }}
        />

        {/* Glass badge container */}
        <div
          className="w-full h-full relative z-10 rounded-xl p-[1.5px] overflow-hidden filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(192, 132, 252, 0.25), rgba(91, 168, 245, 0.35))",
          }}
        >
          <div className="w-full h-full rounded-[10px] bg-black/40 backdrop-blur-md overflow-hidden flex items-center justify-center">
            <img
              src="/logo.png"
              alt="TissueAI Logo"
              className="w-full h-full object-cover rounded-[10px] filter drop-shadow-[0_2px_8px_rgba(91,168,245,0.4)]"
            />
          </div>
        </div>
      </div>

      {/* Typography Wordmark */}
      {variant === "full" && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center tracking-tight">
            <span
              className={`font-bold text-white ${
                px <= 24 ? "text-xs" : px <= 32 ? "text-sm" : px >= 48 ? "text-2xl" : "text-base"
              }`}
            >
              Tissue
            </span>
            <span
              className={`font-black bg-gradient-to-r from-[#5BA8F5] via-[#c084fc] to-[#ec4899] bg-clip-text text-transparent ${
                px <= 24 ? "text-xs" : px <= 32 ? "text-sm" : px >= 48 ? "text-2xl" : "text-base"
              }`}
            >
              AI
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[8px] uppercase font-semibold tracking-wider text-white/50 mt-0.5">
              Histopathology Intelligence
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
