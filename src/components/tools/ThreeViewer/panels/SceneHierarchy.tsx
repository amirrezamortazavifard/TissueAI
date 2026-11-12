import { Eye, EyeOff, Box } from "lucide-react";
import { useSceneStore } from "@/stores/sceneStore";

export default function SceneHierarchy() {
  const objects = useSceneStore((s) => s.objects);
  const selectedId = useSceneStore((s) => s.selectedId);
  const selectObject = useSceneStore((s) => s.selectObject);
  const updateObject = useSceneStore((s) => s.updateObject);

  return (
    <div className="space-y-3">
      <div className="section-label">
        Scene Objects ({objects.length})
      </div>

      {objects.length === 0 ? (
        <div className="text-xs text-white/30 py-6 text-center">
          No objects in scene.
          <br />
          Add models from the Models tab.
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {objects.map((obj) => (
            <div
              key={obj.id}
              onClick={() => selectObject(obj.id)}
              className={`flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer transition-all group ${
                selectedId === obj.id
                  ? "bg-white/8 border border-white/10"
                  : "hover:bg-white/4 border border-transparent"
              }`}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${obj.color}25`,
                  border: `1px solid ${obj.color}40`,
                }}
              >
                <Box size={10} style={{ color: obj.color }} />
              </div>

              <span
                className={`text-xs flex-1 truncate ${
                  selectedId === obj.id ? "text-white/90" : "text-white/60"
                }`}
              >
                {obj.name}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateObject(obj.id, { visible: !obj.visible });
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                title={obj.visible ? "Hide" : "Show"}
              >
                {obj.visible ? (
                  <Eye size={12} className="text-white/40" />
                ) : (
                  <EyeOff size={12} className="text-white/20" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {objects.length > 0 && (
        <div className="pt-2 border-t border-white/5 text-[10px] text-white/25">
          {objects.filter((o) => o.visible).length} visible / {objects.length} total
        </div>
      )}
    </div>
  );
}
