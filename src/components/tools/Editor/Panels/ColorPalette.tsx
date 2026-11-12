import { MS_PAINT_COLORS } from "../Utils/types";

interface ColorPaletteProps {
  primaryColor: string;
  secondaryColor: string;
  onPrimaryChange: (color: string) => void;
  onSecondaryChange: (color: string) => void;
  onSwap: () => void;
}

export default function ColorPalette({
  primaryColor,
  secondaryColor,
  onPrimaryChange,
  onSecondaryChange,
  onSwap,
}: ColorPaletteProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="relative flex-shrink-0" style={{ width: 42, height: 42 }}>
        <div
          className="absolute top-0 left-0 rounded border border-white/20"
          style={{
            width: 26,
            height: 26,
            backgroundColor: primaryColor,
            zIndex: 2,
          }}
          title="Color 1 (Left Click)"
        />
        <div
          className="absolute bottom-0 right-0 rounded border border-white/20"
          style={{
            width: 26,
            height: 26,
            backgroundColor: secondaryColor,
            zIndex: 1,
          }}
          title="Color 2 (Right Click)"
        />
        <button
          onClick={onSwap}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[8px] text-white/50 z-10"
          title="Swap Colors"
        >
          ⇄
        </button>
      </div>

      <div className="flex flex-wrap gap-[2px]" style={{ maxWidth: 200 }}>
        {MS_PAINT_COLORS.map((color) => (
          <button
            key={color}
            onClick={(e) => {
              if (e.button === 2) {
                e.preventDefault();
                onSecondaryChange(color);
              } else {
                onPrimaryChange(color);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onSecondaryChange(color);
            }}
            className="w-[18px] h-[18px] rounded-[3px] border border-white/10 hover:scale-125 hover:z-10 transition-transform cursor-pointer"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1 ml-2">
        <label className="text-[10px] text-white/40">1</label>
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => onPrimaryChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
        />
        <label className="text-[10px] text-white/40">2</label>
        <input
          type="color"
          value={secondaryColor}
          onChange={(e) => onSecondaryChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
        />
      </div>
    </div>
  );
}
