// @ts-nocheck
import { useState, useMemo, useRef } from "react";
import { Crosshair, Download, RotateCcw, Target, X, Move } from "lucide-react";
import { DetectionInfo } from "./types";
import { useNotification } from "../../../contexts/NotificationContext";

interface DetectionObjectsTableProps {
  isOpen: boolean;
  onClose: () => void;
  detections: DetectionInfo[];
  selectedDetection: number | null;
  onSelectDetection: (index: number | null) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  hiddenClasses: Set<number>;
  onToggleClassVisibility: (classId: number) => void;
  confidenceThreshold: number;
  setConfidenceThreshold: (val: number) => void;
  nmsThreshold: number;
  setNmsThreshold: (val: number) => void;
  onExportCsv: () => void;
  onResetView: () => void;
  thumbnails: Map<number, string>;
}

export default function DetectionObjectsTable({
  isOpen,
  onClose,
  detections,
  selectedDetection,
  onSelectDetection,
  focusMode,
  onToggleFocusMode,
  hiddenClasses,
  onToggleClassVisibility,
  confidenceThreshold,
  setConfidenceThreshold,
  nmsThreshold,
  setNmsThreshold,
  onExportCsv,
  onResetView,
  thumbnails,
}: DetectionObjectsTableProps) {
  const notif = useNotification();
  const [filterClass, setFilterClass] = useState<string>("all");

  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 80, y: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const uniqueClasses = useMemo(() => {
    const map = new Map<number, string>();
    detections.forEach(d => map.set(d.original_box.class_id, d.original_box.class_name));
    return Array.from(map.entries());
  }, [detections]);

  const filteredDetections = useMemo(() => {
    return detections.filter(d => {
      if (hiddenClasses.has(d.original_box.class_id)) return false;
      if (filterClass !== "all" && d.label !== filterClass) return false;
      return true;
    });
  }, [detections, hiddenClasses, filterClass]);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: Math.max(10, Math.min(window.innerWidth - 650, e.clientX - dragStartRef.current.x)),
      y: Math.max(10, Math.min(window.innerHeight - 450, e.clientY - dragStartRef.current.y)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="aw-draggable-modal aw-fade-in"
      style={{ left: position.x, top: position.y, width: 680, height: 420 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Draggable Header bar */}
      <div 
        className="aw-draggable-header"
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Move size={14} style={{ color: 'var(--text-3)' }} />
          <Target size={15} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)' }}>
            Detected Objects & ROI ({filteredDetections.length})
          </span>
        </div>

        <button className="aw-icon-btn" onClick={onClose} title="Close Modal">
          <X size={15} />
        </button>
      </div>

      {/* Toolbar controls */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-2)',
        background: 'var(--bg-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        {/* Confidence Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-2)' }}>
          <span>Conf:</span>
          <input 
            type="range" 
            min="10" 
            max="95" 
            value={confidenceThreshold} 
            onChange={e => setConfidenceThreshold(Number(e.target.value))}
            className="aw-slider"
            style={{ width: 50 }}
          />
          <span style={{ fontWeight: 700 }}>{confidenceThreshold}%</span>
        </div>

        {/* NMS Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-2)' }}>
          <span>NMS:</span>
          <input 
            type="range" 
            min="10" 
            max="90" 
            value={nmsThreshold} 
            onChange={e => setNmsThreshold(Number(e.target.value))}
            className="aw-slider"
            style={{ width: 45 }}
          />
          <span style={{ fontWeight: 700 }}>{nmsThreshold}%</span>
        </div>

        {/* Class Filter Dropdown */}
        {uniqueClasses.length > 0 && (
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border-2)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '10px',
              color: 'var(--text-1)',
              outline: 'none',
            }}
          >
            <option value="all">All Classes</option>
            {uniqueClasses.map(([id, name]) => (
              <option key={id} value={name}>{name}</option>
            ))}
          </select>
        )}

        {/* Spotlight toggle */}
        <button 
          className={`aw-footer-btn ${focusMode ? 'primary' : ''}`}
          style={{ padding: '3px 8px', fontSize: '10px' }}
          onClick={onToggleFocusMode}
          disabled={selectedDetection === null}
          title="Toggle Spotlight Focus mode on selected object"
        >
          <Crosshair size={12} /> Spotlight
        </button>

        {/* Export CSV */}
        <button 
          className="aw-footer-btn primary"
          style={{ padding: '3px 8px', fontSize: '10px' }}
          onClick={onExportCsv}
          disabled={detections.length === 0}
          title="Export detection results to CSV file"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Table Body */}
      <div className="aw-det-table-body" style={{ flex: 1, padding: '8px' }}>
        {filteredDetections.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
            {filteredDetections.map((det) => {
              const isSelected = selectedDetection === det.index;
              const thumb = thumbnails.get(det.index);
              const box = det.original_box;

              return (
                <div 
                  key={det.index} 
                  className={`aw-det-row-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectDetection(det.index)}
                >
                  <div className="aw-det-badge-idx">{det.index}</div>

                  {thumb ? (
                    <img src={thumb} alt="ROI" className="aw-det-thumb" />
                  ) : (
                    <div className="aw-det-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target size={14} style={{ color: 'var(--text-3)' }} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)' }}>
                        {det.label}
                      </span>
                      <span className="aw-badge aw-badge-green">
                        {(det.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '4px', fontFamily: 'monospace' }}>
                      X: {Math.round(box.x)} &nbsp; Y: {Math.round(box.y)} &nbsp; W: {Math.round(box.width)} &nbsp; H: {Math.round(box.height)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: '11px' }}>
            {detections.length === 0 ? "No objects detected yet. Select an image and click 'Start Detection'." : "No matching objects for selected filters."}
          </div>
        )}
      </div>
    </div>
  );
}
