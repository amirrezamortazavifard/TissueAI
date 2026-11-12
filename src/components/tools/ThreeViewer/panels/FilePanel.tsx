import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Save, Upload, Trash2, Download } from "lucide-react";
import { useSceneStore, SceneObject } from "@/stores/sceneStore";

export default function FilePanel() {
  const objects = useSceneStore((s) => s.objects);
  const loadScene = useSceneStore((s) => s.loadScene);
  const clearScene = useSceneStore((s) => s.clearScene);
  const addObject = useSceneStore((s) => s.addObject);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const path = await save({
        filters: [{ name: "TissueAI 3D Scene", extensions: ["tissue3d"] }],
        defaultPath: "scene.tissue3d",
      });
      if (!path) return;

      const sceneData = {
        version: 1,
        objects: objects.map((o) => ({
          name: o.name,
          modelType: o.modelType,
          modelPath: o.modelPath,
          position: o.position,
          rotation: o.rotation,
          scale: o.scale,
          color: o.color,
          visible: o.visible,
          wireframe: o.wireframe,
        })),
      };

      await invoke("save_scene", {
        path,
        sceneJson: JSON.stringify(sceneData, null, 2),
      });
    } catch (err) {
      console.error("Failed to save scene:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async () => {
    setLoading(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "TissueAI 3D Scene", extensions: ["tissue3d"] }],
      });
      if (!selected) return;

      const content = await invoke<string>("load_scene", { path: selected });
      const sceneData = JSON.parse(content);

      if (sceneData.objects && Array.isArray(sceneData.objects)) {
        const restoredObjects: SceneObject[] = sceneData.objects.map(
          (o: Record<string, unknown>, i: number) => ({
            id: `restored_${Date.now()}_${i}`,
            name: (o.name as string) || "Object",
            modelType: (o.modelType as SceneObject["modelType"]) || "erythrocyte",
            modelPath: o.modelPath as string | undefined,
            position: (o.position as [number, number, number]) || [0, 0, 0],
            rotation: (o.rotation as [number, number, number]) || [0, 0, 0],
            scale: (o.scale as [number, number, number]) || [1, 1, 1],
            color: (o.color as string) || "#E57373",
            visible: (o.visible as boolean) !== false,
            wireframe: (o.wireframe as boolean) || false,
          })
        );
        loadScene(restoredObjects);
      }
    } catch (err) {
      console.error("Failed to load scene:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportModel = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "3D Models",
            extensions: ["obj", "stl", "gltf", "glb", "fbx", "ply"],
          },
        ],
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      for (const path of paths) {
        const name = path.split(/[/\\]/).pop()?.split(".")[0] || "Model";
        addObject({
          name,
          modelType: "custom",
          modelPath: path,
          position: [
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
          ],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: "#64B5F6",
          visible: true,
          wireframe: false,
        });
      }
    } catch (err) {
      console.error("Failed to import model:", err);
    }
  };

  const handleExportScreenshot = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "tissueai-3d-screenshot.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="section-label">File Management</div>

      <div className="space-y-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          <Save size={14} />
          {saving ? "Saving..." : "Save Scene"}
        </button>

        <button onClick={handleLoad} disabled={loading} className="btn-glass w-full">
          <Upload size={14} />
          {loading ? "Loading..." : "Load Scene"}
        </button>

        <button onClick={handleImportModel} className="btn-glass w-full">
          <Download size={14} />
          Import 3D Model
        </button>

        <button onClick={handleExportScreenshot} className="btn-glass w-full">
          <Save size={14} />
          Screenshot (PNG)
        </button>

        <button
          onClick={() => {
            if (objects.length === 0) return;
            clearScene();
          }}
          className="btn-danger w-full"
        >
          <Trash2 size={14} />
          Clear Scene
        </button>
      </div>

      <div className="pt-3 border-t border-white/5">
        <div className="section-label mb-2">Supported Formats</div>
        <div className="text-xs text-white/30 space-y-1">
          <p>OBJ, STL, glTF, GLB, FBX, PLY</p>
          <p>Scene files: .tissue3d</p>
        </div>
      </div>
    </div>
  );
}
