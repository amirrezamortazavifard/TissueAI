import { LayerHistoryEntry, LayerSnapshot, Layer } from "../Utils/types";

const MAX_HISTORY = 50;

export class HistoryManager {
  private history: LayerHistoryEntry[] = [];
  private redoStack: LayerHistoryEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = MAX_HISTORY) {
    this.maxSize = maxSize;
  }

  push(entry: LayerHistoryEntry): void {
    this.history.push(entry);
    this.redoStack = [];
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  popForUndo(): LayerHistoryEntry | null {
    if (this.history.length <= 1) return null;
    const current = this.history.pop()!;
    this.redoStack.push(current);
    return this.history[this.history.length - 1] || null;
  }

  redo(): LayerHistoryEntry | null {
    if (this.redoStack.length === 0) return null;
    const entry = this.redoStack.pop()!;
    this.history.push(entry);
    return entry;
  }

  canUndo(): boolean {
    return this.history.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.history = [];
    this.redoStack = [];
  }

  getHistoryLength(): number {
    return this.history.length;
  }
  
  getHistoryIndex(): number {
    return this.history.length;
  }

  getRedoLength(): number {
    return this.redoStack.length;
  }

  getCurrent(): LayerHistoryEntry | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}

export function saveMultiLayerToHistory(
  layers: Layer[],
  activeLayerId: string,
  getCanvasForLayer: (id: string) => HTMLCanvasElement | null,
  historyManager: HistoryManager,
  label: string = "State change"
): void {
  const snapshots: LayerSnapshot[] = [];
  
  for (const layer of layers) {
    const canvas = getCanvasForLayer(layer.id);
    if (!canvas) continue;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    
    // We clone the image data so it's fully isolated in memory
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    snapshots.push({
      id: layer.id,
      imageData,
      width: canvas.width,
      height: canvas.height
    });
  }
  
  historyManager.push({
    layers: snapshots,
    activeLayerId,
    label
  });
}

export function restoreMultiLayerFromHistory(
  entry: LayerHistoryEntry,
  getCanvasForLayer: (id: string) => HTMLCanvasElement | null
): void {
  for (const snapshot of entry.layers) {
    const canvas = getCanvasForLayer(snapshot.id);
    if (!canvas || !snapshot.imageData) continue;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    
    canvas.width = snapshot.width;
    canvas.height = snapshot.height;
    ctx.putImageData(snapshot.imageData, 0, 0);
  }
}
