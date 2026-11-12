import { create } from "zustand";

export type BiologicalModelType =
  | "erythrocyte"
  | "neuron"
  | "myocyte"
  | "purkinje_cell"
  | "artery";

export interface SceneObject {
  id: string;
  name: string;
  modelType: BiologicalModelType | "custom";
  modelPath?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  visible: boolean;
  wireframe: boolean;
}

interface SceneState {
  objects: SceneObject[];
  selectedId: string | null;
  backgroundColor: string;
  showGrid: boolean;
  lightIntensity: number;
  ambientIntensity: number;
  showLabels: boolean;
  wireframeMode: boolean;
  cloneCount: number;

  addObject: (obj: Omit<SceneObject, "id">) => string;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  clearScene: () => void;
  setBackgroundColor: (color: string) => void;
  setShowGrid: (show: boolean) => void;
  setLightIntensity: (v: number) => void;
  setAmbientIntensity: (v: number) => void;
  setShowLabels: (v: boolean) => void;
  setWireframeMode: (v: boolean) => void;
  setCloneCount: (v: number) => void;
  loadScene: (objects: SceneObject[]) => void;
  duplicateObject: (id: string) => void;
}

let idCounter = 0;
const genId = () => `obj_${++idCounter}_${Date.now()}`;

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: [],
  selectedId: null,
  backgroundColor: "#1A0129",
  showGrid: true,
  lightIntensity: 1.0,
  ambientIntensity: 0.4,
  showLabels: true,
  wireframeMode: false,
  cloneCount: 1,

  addObject: (obj) => {
    const id = genId();
    set((s) => ({ objects: [...s.objects, { ...obj, id }] }));
    return id;
  },

  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  selectObject: (id) => set({ selectedId: id }),

  updateObject: (id, updates) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),

  clearScene: () => set({ objects: [], selectedId: null }),

  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setShowGrid: (show) => set({ showGrid: show }),
  setLightIntensity: (v) => set({ lightIntensity: v }),
  setAmbientIntensity: (v) => set({ ambientIntensity: v }),
  setShowLabels: (v) => set({ showLabels: v }),
  setWireframeMode: (v) => set({ wireframeMode: v }),
  setCloneCount: (v) => set({ cloneCount: v }),

  loadScene: (objects) => set({ objects, selectedId: null }),

  duplicateObject: (id) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return;
    const newId = genId();
    const offset = 5;
    set((s) => ({
      objects: [
        ...s.objects,
        {
          ...obj,
          id: newId,
          name: `${obj.name} (copy)`,
          position: [
            obj.position[0] + (Math.random() - 0.5) * offset,
            obj.position[1] + (Math.random() - 0.5) * offset,
            obj.position[2] + (Math.random() - 0.5) * offset,
          ],
        },
      ],
    }));
  },
}));

export const BIOLOGICAL_MODELS: {
  type: BiologicalModelType;
  name: string;
  category: string;
  color: string;
}[] = [
  { type: "erythrocyte", name: "Erythrocyte", category: "Cells", color: "#E57373" },
  { type: "neuron", name: "Neuron", category: "Cells", color: "#81C784" },
  { type: "myocyte", name: "Myocyte", category: "Cells", color: "#64B5F6" },
  { type: "purkinje_cell", name: "Purkinje Cell", category: "Cells", color: "#F06292" },
  { type: "artery", name: "Artery", category: "Vessels & Ducts", color: "#E57373" },
];
