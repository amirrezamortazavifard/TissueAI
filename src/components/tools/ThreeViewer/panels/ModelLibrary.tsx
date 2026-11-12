import { useState } from "react";
import { ChevronDown, ChevronRight, Box } from "lucide-react";
import {
  useSceneStore,
  BIOLOGICAL_MODELS,
  BiologicalModelType,
} from "@/stores/sceneStore";

interface ModelCategory {
  name: string;
  models: typeof BIOLOGICAL_MODELS;
}

export default function ModelLibrary() {
  const addObject = useSceneStore((s) => s.addObject);
  const cloneCount = useSceneStore((s) => s.cloneCount);
  const setCloneCount = useSceneStore((s) => s.setCloneCount);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({ Cells: true, "Vessels & Ducts": true });

  const categories: ModelCategory[] = BIOLOGICAL_MODELS.reduce<ModelCategory[]>((acc, model) => {
    let cat = acc.find((c) => c.name === model.category);
    if (!cat) {
      cat = { name: model.category, models: [] };
      acc.push(cat);
    }
    cat.models.push(model);
    return acc;
  }, []);

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleAddModel = (type: BiologicalModelType, color: string, name: string) => {
    for (let i = 0; i < cloneCount; i++) {
      const offsetX = (Math.random() - 0.5) * 30;
      const offsetY = (Math.random() - 0.5) * 30;
      const offsetZ = (Math.random() - 0.5) * 30;
      addObject({
        name: cloneCount > 1 ? `${name} ${i + 1}` : name,
        modelType: type,
        position: [offsetX, offsetY, offsetZ],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color,
        visible: true,
        wireframe: false,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="section-label">Model Library</div>

      {categories.map((cat) => (
        <div key={cat.name}>
          <button
            onClick={() => toggleCategory(cat.name)}
            className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {expandedCategories[cat.name] ? (
              <ChevronDown size={14} className="text-white/40" />
            ) : (
              <ChevronRight size={14} className="text-white/40" />
            )}
            <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
              {cat.name}
            </span>
          </button>

          {expandedCategories[cat.name] && (
            <div className="ml-4 space-y-1 mt-1">
              {cat.models.map((model) => (
                <button
                  key={model.type}
                  onClick={() => handleAddModel(model.type, model.color, model.name)}
                  className="flex items-center gap-3 w-full text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-all group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{
                      background: `${model.color}20`,
                      border: `1px solid ${model.color}30`,
                    }}
                  >
                    <Box size={14} style={{ color: model.color }} />
                  </div>
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                    {model.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="pt-3 border-t border-white/5">
        <div className="section-label mb-2">Clone Control</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/40">Count:</label>
          <input
            type="number"
            min={1}
            max={50}
            value={cloneCount}
            onChange={(e) => setCloneCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="input-field w-16 text-center"
          />
        </div>
      </div>
    </div>
  );
}
